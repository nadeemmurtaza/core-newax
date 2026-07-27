import { Inject, Injectable } from '@nestjs/common';
import type {
  AuditEntry,
  AuditRepository,
  ListOrganizationAuditEntriesRecordInput,
  ListOrganizationAuditEntriesResult,
  RecordTrustedAuditEntryRecordInput,
  RecordTrustedAuditEntryResult,
} from '@newax/audit';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface AuditDatabaseRecord {
  readonly id: string;
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly moduleCode: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly outcome: string;
  readonly sensitivity: string;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordTrustedEntry(
    input: RecordTrustedAuditEntryRecordInput,
  ): Promise<RecordTrustedAuditEntryResult> {
    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      let tenantId = input.tenantId;
      if (input.organizationId !== null) {
        const organization = await transaction.coreOrganization.findFirst({
          where: {
            id: input.organizationId,
            ...(tenantId === null ? {} : { tenantId }),
          },
          select: { tenantId: true },
        });
        if (organization === null) {
          return { status: 'scope_unavailable' } as const;
        }
        tenantId = organization.tenantId;
      } else if (tenantId !== null) {
        const tenant = await transaction.coreTenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        });
        if (tenant === null) {
          return { status: 'scope_unavailable' } as const;
        }
      }

      if (input.actorUserId !== null) {
        const actor = await transaction.coreUser.findUnique({
          where: { id: input.actorUserId },
          select: { id: true },
        });
        if (actor === null) {
          return { status: 'actor_unavailable' } as const;
        }
      }

      const record = await transaction.coreAuditLog.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          moduleCode: input.moduleCode,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          outcome: input.outcome,
          sensitivity: input.sensitivity,
          metadata: input.metadata as unknown as Prisma.InputJsonValue,
          correlationId: input.correlationId,
          requestId: input.requestId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          createdAt: input.occurredAt,
        },
      });
      return { status: 'created', entry: this.mapEntry(record) } as const;
    });
  }

  async listOrganizationEntries(
    input: ListOrganizationAuditEntriesRecordInput,
  ): Promise<ListOrganizationAuditEntriesResult> {
    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const organization = await transaction.coreOrganization.findFirst({
        where: {
          id: input.organizationId,
          tenantId: input.tenantId,
          status: 'active',
          deletedAt: null,
          tenant: { is: { status: 'active', deletedAt: null } },
        },
        select: { id: true },
      });
      if (organization === null) {
        return { status: 'scope_unavailable' } as const;
      }

      if (input.afterId !== undefined) {
        const cursor = await transaction.coreAuditLog.findFirst({
          where: {
            id: input.afterId,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
          },
          select: { id: true },
        });
        if (cursor === null) {
          return { status: 'cursor_invalid' } as const;
        }
      }

      const records = await transaction.coreAuditLog.findMany({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.afterId === undefined ? {} : { cursor: { id: input.afterId }, skip: 1 }),
      });

      const hasMore = records.length > input.limit;
      const pageRecords = hasMore ? records.slice(0, input.limit) : records;
      const lastRecord = pageRecords.at(-1);
      return {
        status: 'available',
        items: pageRecords.map((record) => this.mapEntry(record)),
        nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
      } as const;
    });
  }

  private mapEntry(record: AuditDatabaseRecord): AuditEntry {
    const outcome = record.outcome;
    const sensitivity = record.sensitivity;
    if (
      (outcome !== 'allowed' &&
        outcome !== 'denied' &&
        outcome !== 'failed' &&
        outcome !== 'success') ||
      (sensitivity !== 'security' && sensitivity !== 'sensitive' && sensitivity !== 'standard')
    ) {
      throw new Error('The stored Audit classification is invalid.');
    }
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      actorUserId: record.actorUserId,
      moduleCode: record.moduleCode,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      outcome,
      sensitivity,
      requestId: record.requestId,
      createdAt: record.createdAt,
    };
  }
}
