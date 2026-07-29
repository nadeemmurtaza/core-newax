import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateMembershipRecordInput,
  CreateMembershipResult,
  MembershipListQuery,
  MembershipPage,
  MembershipRecord,
  MembershipStatus,
  MembershipsRepository,
  UpdateMembershipRecordInput,
} from '@newax/memberships';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface MembershipDatabaseRecord {
  readonly id: string;
  // Nullable at the database level because a CoreMembership may instead be
  // backed by a CoreServiceAccount (see ADR 0035) -- @newax/memberships only
  // supports person-backed memberships, so mapMembership() below narrows this
  // to a non-null string or throws.
  readonly personId: string | null;
  readonly organizationId: string;
  readonly membershipType: string;
  readonly referenceNumber: string | null;
  readonly jobTitle: string | null;
  readonly status: string;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaMembershipsRepository implements MembershipsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateMembershipRecordInput): Promise<CreateMembershipResult> {
    const lockKey = [input.organizationId, input.personId, input.membershipType].join('|');

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreateMembershipResult> => {
        await transaction.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        const existing = await transaction.coreMembership.findFirst({
          where: {
            organizationId: input.organizationId,
            personId: input.personId,
            membershipType: input.membershipType,
            status: { in: ['active', 'suspended'] },
          },
          select: { id: true },
        });

        if (existing !== null) {
          return {
            status: 'conflict',
            existingMembershipId: existing.id,
          };
        }

        const data: Prisma.CoreMembershipUncheckedCreateInput = {
          personId: input.personId,
          organizationId: input.organizationId,
          membershipType: input.membershipType,
          referenceNumber: input.referenceNumber,
          jobTitle: input.jobTitle,
          startDate: input.startDate,
        };

        const record = await transaction.coreMembership.create({ data });
        return {
          status: 'created',
          membership: this.mapMembership(record),
        };
      },
    );
  }

  async findById(id: string): Promise<MembershipRecord | null> {
    const record = await this.prisma.coreMembership.findUnique({ where: { id } });
    return record === null ? null : this.mapMembership(record);
  }

  async list(organizationId: string, query: MembershipListQuery): Promise<MembershipPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CoreMembershipWhereInput = { organizationId };

    if (query.personId !== undefined) {
      where.personId = query.personId;
    }

    if (query.membershipType !== undefined) {
      where.membershipType = query.membershipType;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.status = { in: ['active', 'suspended'] };
    }

    if (query.search !== undefined) {
      where.OR = [
        { membershipType: { contains: query.search, mode: 'insensitive' } },
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
        { jobTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.coreMembership.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const lastRecord = pageRecords.at(-1);

    return {
      items: pageRecords.map((record) => this.mapMembership(record)),
      nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
    };
  }

  async remove(id: string, endedAt: Date): Promise<MembershipRecord> {
    const record = await this.prisma.coreMembership.update({
      where: { id },
      data: {
        status: 'ended',
        endDate: endedAt,
      },
    });

    return this.mapMembership(record);
  }

  async update(id: string, input: UpdateMembershipRecordInput): Promise<MembershipRecord> {
    const data: Prisma.CoreMembershipUncheckedUpdateInput = {};

    if ('referenceNumber' in input) {
      data.referenceNumber = input.referenceNumber ?? null;
    }

    if ('jobTitle' in input) {
      data.jobTitle = input.jobTitle ?? null;
    }

    if (input.startDate !== undefined) {
      data.startDate = input.startDate;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    const record = await this.prisma.coreMembership.update({ where: { id }, data });
    return this.mapMembership(record);
  }

  private mapMembership(record: MembershipDatabaseRecord): MembershipRecord {
    return {
      ...record,
      personId: this.requirePersonBackedMembership(record.personId),
      status: this.mapStatus(record.status),
    };
  }

  // @newax/memberships only supports person-backed memberships; a
  // service-account-backed CoreMembership (see ADR 0035) reaching this
  // repository's read paths would be a caller bug.
  private requirePersonBackedMembership(personId: string | null): string {
    if (personId === null) {
      throw new Error('This membership is a service-account identity, not a person-backed one.');
    }
    return personId;
  }

  private mapStatus(status: string): MembershipStatus {
    if (status === 'active' || status === 'suspended' || status === 'ended') {
      return status;
    }

    throw new Error(`Unsupported membership status: ${status}`);
  }
}
