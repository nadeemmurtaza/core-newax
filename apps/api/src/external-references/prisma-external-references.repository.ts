import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type {
  ExternalReferenceRecord,
  ExternalReferenceRepository,
  FindOrganizationExternalReferenceByKeyRecordInput,
  FindOrganizationExternalReferenceByKeyResult,
  FindTenantExternalReferenceByKeyRecordInput,
  FindTenantExternalReferenceByKeyResult,
  ListOrganizationExternalReferencesRecordInput,
  ListOrganizationExternalReferencesResult,
  RegisterOrganizationExternalReferenceRecordInput,
  RegisterOrganizationExternalReferenceResult,
  UpdateOrganizationExternalReferenceEntityRecordInput,
  UpdateOrganizationExternalReferenceEntityResult,
} from '@newax/external-references';

import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

interface ExternalReferenceDatabaseRecord {
  readonly id: string;
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly domainCode: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalSystem: string;
  readonly externalKey: string;
  readonly metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaExternalReferencesRepository implements ExternalReferenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerOrganizationExternalReference(
    input: RegisterOrganizationExternalReferenceRecordInput,
  ): Promise<RegisterOrganizationExternalReferenceResult> {
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
        return { status: 'organization_unavailable' } as const;
      }

      const actor = await transaction.coreUser.findFirst({
        where: {
          id: input.actorUserId,
          status: 'active',
          deletedAt: null,
          OR: [
            { person: { is: { status: 'active', deletedAt: null } } },
            { serviceAccount: { is: { status: 'active', deletedAt: null } } },
          ],
        },
        select: { id: true },
      });
      if (actor === null) {
        return { status: 'actor_unavailable' } as const;
      }

      const lockFingerprint = createHash('sha256')
        .update(input.tenantId)
        .update('\0')
        .update(input.organizationId)
        .update('\0')
        .update(input.externalSystem)
        .update('\0')
        .update(input.externalKey)
        .digest('hex');
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`external-reference|${lockFingerprint}`}, 0))
      `;

      const existing = await transaction.coreExternalReference.findFirst({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          externalSystem: input.externalSystem,
          externalKey: input.externalKey,
        },
        select: { id: true },
      });
      if (existing !== null) {
        return { status: 'conflict' } as const;
      }

      const externalReference = await transaction.coreExternalReference.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          domainCode: input.domainCode,
          entityType: input.entityType,
          entityId: input.entityId,
          externalSystem: input.externalSystem,
          externalKey: input.externalKey,
          metadata:
            input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue),
        },
      });

      return {
        status: 'created',
        externalReference: this.mapExternalReference(externalReference),
      } as const;
    });
  }

  async listOrganizationExternalReferences(
    input: ListOrganizationExternalReferencesRecordInput,
  ): Promise<ListOrganizationExternalReferencesResult> {
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
        return { status: 'organization_unavailable' } as const;
      }

      if (input.afterId !== undefined) {
        const cursor = await transaction.coreExternalReference.findFirst({
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

      const records = await transaction.coreExternalReference.findMany({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        },
        orderBy: { id: 'asc' },
        take: input.limit + 1,
        ...(input.afterId === undefined ? {} : { cursor: { id: input.afterId }, skip: 1 }),
      });

      const hasMore = records.length > input.limit;
      const pageRecords = hasMore ? records.slice(0, input.limit) : records;
      const lastRecord = pageRecords.at(-1);
      return {
        status: 'available',
        items: pageRecords.map((record) => this.mapExternalReference(record)),
        nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
      } as const;
    });
  }

  private mapExternalReference(record: ExternalReferenceDatabaseRecord): ExternalReferenceRecord {
    if (record.tenantId === null || record.organizationId === null) {
      throw new Error('Organization External Reference persistence boundary was violated.');
    }
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      domainCode: record.domainCode,
      entityType: record.entityType,
      entityId: record.entityId,
      externalSystem: record.externalSystem,
      externalKey: record.externalKey,
      metadata: this.asMetadataRecord(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private asMetadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  async findOrganizationExternalReferenceByKey(
    input: FindOrganizationExternalReferenceByKeyRecordInput,
  ): Promise<FindOrganizationExternalReferenceByKeyResult> {
    const organization = await this.prisma.coreOrganization.findFirst({
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
      return { status: 'organization_unavailable' } as const;
    }

    const record = await this.prisma.coreExternalReference.findFirst({
      where: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        externalSystem: input.externalSystem,
        externalKey: input.externalKey,
      },
    });
    if (record === null) {
      return { status: 'not_found' } as const;
    }
    return { status: 'found', externalReference: this.mapExternalReference(record) } as const;
  }

  async findTenantExternalReferenceByKey(
    input: FindTenantExternalReferenceByKeyRecordInput,
  ): Promise<FindTenantExternalReferenceByKeyResult> {
    const record = await this.prisma.coreExternalReference.findFirst({
      where: {
        tenantId: input.tenantId,
        externalSystem: input.externalSystem,
        externalKey: input.externalKey,
      },
    });
    if (record === null) {
      return { status: 'not_found' } as const;
    }
    return { status: 'found', externalReference: this.mapExternalReference(record) } as const;
  }

  async updateOrganizationExternalReferenceEntity(
    input: UpdateOrganizationExternalReferenceEntityRecordInput,
  ): Promise<UpdateOrganizationExternalReferenceEntityResult> {
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
        return { status: 'organization_unavailable' } as const;
      }

      const existing = await transaction.coreExternalReference.findFirst({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          externalSystem: input.externalSystem,
          externalKey: input.externalKey,
        },
        select: { id: true },
      });
      if (existing === null) {
        return { status: 'not_found' } as const;
      }

      const updated = await transaction.coreExternalReference.update({
        where: { id: existing.id },
        data: {
          entityId: input.entityId,
          ...(input.metadata === undefined
            ? {}
            : {
                metadata:
                  input.metadata === null
                    ? Prisma.JsonNull
                    : (input.metadata as Prisma.InputJsonValue),
              }),
        },
      });

      return {
        status: 'updated',
        externalReference: this.mapExternalReference(updated),
      } as const;
    });
  }
}
