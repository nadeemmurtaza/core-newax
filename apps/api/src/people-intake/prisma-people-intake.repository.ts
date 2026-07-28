import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePeopleIntakeRecordInput,
  CreatePeopleIntakeRecordResult,
  ListPeopleIntakesRecordInput,
  ListPeopleIntakesRecordResult,
  PeopleIntakeIdentityInput,
  PeopleIntakeRepository,
  PeopleIntakeReviewDecision,
  PeopleIntakeStatus,
  PeopleIntakeSummary,
  ReviewPeopleIntakeRecordInput,
  ReviewPeopleIntakeRecordResult,
  StoredPeopleIntakeRecord,
  SubmitPeopleIntakeRecordInput,
  SubmitPeopleIntakeRecordResult,
  UpdatePeopleIntakeRecordInput,
  UpdatePeopleIntakeRecordResult,
} from '@newax/people-intake';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface DatabaseIntakeRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly title: string;
  readonly sourceType: string;
  readonly sourceReference: string | null;
  readonly status: string;
  readonly payload: unknown;
  readonly personCount: number;
  readonly relationshipCount: number;
  readonly version: number;
  readonly createdByUserId: string;
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedByUserId: string | null;
  readonly reviewDecision: string | null;
  readonly reviewNotes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaPeopleIntakeRepository implements PeopleIntakeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createDraft(input: CreatePeopleIntakeRecordInput): Promise<CreatePeopleIntakeRecordResult> {
    return this.prisma.$transaction(async (transaction) => {
      if (!(await this.organizationAvailable(transaction, input.tenantId, input.organizationId))) {
        return { status: 'organization_unavailable' };
      }
      const record = await transaction.corePeopleIntake.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          title: input.title,
          sourceType: input.sourceType,
          sourceReference: input.sourceReference,
          status: 'draft',
          payload: input.payload as unknown as Prisma.InputJsonValue,
          personCount: input.personCount,
          relationshipCount: input.relationshipCount,
          createdByUserId: input.actorUserId,
        },
      });
      return { status: 'created', intake: this.mapRecord(record) };
    });
  }

  async findById(input: PeopleIntakeIdentityInput): Promise<StoredPeopleIntakeRecord | null> {
    const record = await this.prisma.corePeopleIntake.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
      },
    });
    return record === null ? null : this.mapRecord(record);
  }

  async list(input: ListPeopleIntakesRecordInput): Promise<ListPeopleIntakesRecordResult> {
    return this.prisma.$transaction(async (transaction) => {
      if (!(await this.organizationAvailable(transaction, input.tenantId, input.organizationId))) {
        return { status: 'organization_unavailable' };
      }
      if (input.afterId !== undefined) {
        const cursor = await transaction.corePeopleIntake.findFirst({
          where: {
            id: input.afterId,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
          },
          select: { id: true },
        });
        if (cursor === null) {
          return { status: 'cursor_invalid' };
        }
      }
      const records = await transaction.corePeopleIntake.findMany({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          ...(input.status === undefined ? {} : { status: input.status }),
        },
        orderBy: { id: 'asc' },
        take: input.limit + 1,
        ...(input.afterId === undefined ? {} : { cursor: { id: input.afterId }, skip: 1 }),
      });
      const hasMore = records.length > input.limit;
      const page = hasMore ? records.slice(0, input.limit) : records;
      return {
        status: 'available',
        items: page.map((record) => this.mapSummary(record)),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    });
  }

  async updateDraft(input: UpdatePeopleIntakeRecordInput): Promise<UpdatePeopleIntakeRecordResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lock(transaction, input.tenantId, input.organizationId, input.id);
      const current = await transaction.corePeopleIntake.findFirst({
        where: { id: input.id, tenantId: input.tenantId, organizationId: input.organizationId },
      });
      if (current === null) {
        return { status: 'not_found' };
      }
      if (current.createdByUserId !== input.actorUserId) {
        return { status: 'creator_mismatch' };
      }
      if (current.status !== 'draft') {
        return { status: 'state_conflict' };
      }
      if (current.version !== input.expectedVersion) {
        return { status: 'version_conflict' };
      }
      const record = await transaction.corePeopleIntake.update({
        where: { id: input.id },
        data: {
          title: input.title,
          sourceType: input.sourceType,
          sourceReference: input.sourceReference,
          payload: input.payload as unknown as Prisma.InputJsonValue,
          personCount: input.personCount,
          relationshipCount: input.relationshipCount,
          version: { increment: 1 },
        },
      });
      return { status: 'updated', intake: this.mapRecord(record) };
    });
  }

  async submit(input: SubmitPeopleIntakeRecordInput): Promise<SubmitPeopleIntakeRecordResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lock(transaction, input.tenantId, input.organizationId, input.id);
      const current = await transaction.corePeopleIntake.findFirst({
        where: { id: input.id, tenantId: input.tenantId, organizationId: input.organizationId },
      });
      if (current === null) {
        return { status: 'not_found' };
      }
      if (current.createdByUserId !== input.actorUserId) {
        return { status: 'creator_mismatch' };
      }
      if (current.status !== 'draft') {
        return { status: 'state_conflict' };
      }
      if (current.version !== input.expectedVersion) {
        return { status: 'version_conflict' };
      }
      const record = await transaction.corePeopleIntake.update({
        where: { id: input.id },
        data: {
          status: 'submitted',
          submittedAt: input.submittedAt,
          version: { increment: 1 },
        },
      });
      return { status: 'submitted', intake: this.mapRecord(record) };
    });
  }

  async review(input: ReviewPeopleIntakeRecordInput): Promise<ReviewPeopleIntakeRecordResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lock(transaction, input.tenantId, input.organizationId, input.id);
      const current = await transaction.corePeopleIntake.findFirst({
        where: { id: input.id, tenantId: input.tenantId, organizationId: input.organizationId },
      });
      if (current === null) {
        return { status: 'not_found' };
      }
      if (current.createdByUserId === input.reviewerUserId) {
        return { status: 'self_review' };
      }
      if (current.status !== 'submitted') {
        return { status: 'state_conflict' };
      }
      if (current.version !== input.expectedVersion) {
        return { status: 'version_conflict' };
      }
      const record = await transaction.corePeopleIntake.update({
        where: { id: input.id },
        data: {
          status: input.decision,
          reviewedAt: input.reviewedAt,
          reviewedByUserId: input.reviewerUserId,
          reviewDecision: input.decision,
          reviewNotes: input.notes,
          version: { increment: 1 },
        },
      });
      return { status: 'reviewed', intake: this.mapRecord(record) };
    });
  }

  private async organizationAvailable(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    organizationId: string,
  ): Promise<boolean> {
    const organization = await transaction.coreOrganization.findFirst({
      where: {
        id: organizationId,
        tenantId,
        status: 'active',
        deletedAt: null,
        tenant: { is: { status: 'active', deletedAt: null } },
      },
      select: { id: true },
    });
    return organization !== null;
  }

  private async lock(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    organizationId: string,
    intakeId: string,
  ): Promise<void> {
    const key = `people-intake|${tenantId}|${organizationId}|${intakeId}`;
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
    `;
  }

  private mapRecord(record: DatabaseIntakeRecord): StoredPeopleIntakeRecord {
    return { ...this.mapSummary(record), payload: record.payload };
  }

  private mapSummary(record: DatabaseIntakeRecord): PeopleIntakeSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      title: record.title,
      sourceType: record.sourceType,
      sourceReference: record.sourceReference,
      status: this.status(record.status),
      personCount: record.personCount,
      relationshipCount: record.relationshipCount,
      version: record.version,
      createdByUserId: record.createdByUserId,
      submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt,
      reviewedByUserId: record.reviewedByUserId,
      reviewDecision: this.decision(record.reviewDecision),
      reviewNotes: record.reviewNotes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private status(value: string): PeopleIntakeStatus {
    if (
      value === 'draft' ||
      value === 'submitted' ||
      value === 'approved' ||
      value === 'rejected'
    ) {
      return value;
    }
    throw new Error(`Unsupported People Intake status: ${value}`);
  }

  private decision(value: string | null): PeopleIntakeReviewDecision | null {
    if (value === null || value === 'approved' || value === 'rejected') {
      return value;
    }
    throw new Error(`Unsupported People Intake review decision: ${value}`);
  }
}
