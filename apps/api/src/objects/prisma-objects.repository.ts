import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateOrganizationObjectRecordInput,
  CreateOrganizationObjectResult,
  ListOrganizationObjectsRecordInput,
  ListOrganizationObjectsResult,
  ObjectRecord,
  ObjectRepository,
  ObjectTypeRecord,
  RegisterObjectTypeRecordInput,
  RegisterObjectTypeResult,
} from '@newax/objects';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface ObjectTypeDatabaseRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
}

interface ObjectDatabaseRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly owningOrganizationId: string;
  readonly objectTypeId: string;
  readonly parentObjectId: string | null;
  readonly name: string;
  readonly referenceCode: string | null;
  readonly serialNumber: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly objectType: {
    readonly code: string;
  };
}

@Injectable()
export class PrismaObjectsRepository implements ObjectRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerObjectType(
    input: RegisterObjectTypeRecordInput,
  ): Promise<RegisterObjectTypeResult> {
    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`object-type|${input.code}`}, 0))
      `;

      const existing = await transaction.coreObjectType.findUnique({
        where: { code: input.code },
        select: { id: true },
      });
      if (existing !== null) {
        return { status: 'conflict' } as const;
      }

      const objectType = await transaction.coreObjectType.create({ data: input });
      return { status: 'created', objectType: this.mapObjectType(objectType) } as const;
    });
  }

  async createOrganizationObject(
    input: CreateOrganizationObjectRecordInput,
  ): Promise<CreateOrganizationObjectResult> {
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

      const objectType = await transaction.coreObjectType.findFirst({
        where: { code: input.objectTypeCode, status: 'active' },
        select: { id: true },
      });
      if (objectType === null) {
        return { status: 'object_type_unavailable' } as const;
      }

      if (input.parentObjectId !== null) {
        const parent = await transaction.coreObject.findFirst({
          where: {
            id: input.parentObjectId,
            tenantId: input.tenantId,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (parent === null) {
          return { status: 'parent_unavailable' } as const;
        }
      }

      if (input.referenceCode !== null) {
        const lockKey = `object-reference|${input.tenantId}|${input.organizationId}|${input.referenceCode}`;
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        const existing = await transaction.coreObject.findFirst({
          where: {
            owningOrganizationId: input.organizationId,
            referenceCode: input.referenceCode,
          },
          select: { id: true },
        });
        if (existing !== null) {
          return { status: 'conflict' } as const;
        }
      }

      const record = await transaction.coreObject.create({
        data: {
          tenantId: input.tenantId,
          owningOrganizationId: input.organizationId,
          objectTypeId: objectType.id,
          parentObjectId: input.parentObjectId,
          name: input.name,
          referenceCode: input.referenceCode,
          serialNumber: input.serialNumber,
          description: input.description,
          status: 'active',
        },
        include: { objectType: { select: { code: true } } },
      });

      return { status: 'created', object: this.mapObject(record) } as const;
    });
  }

  async listOrganizationObjects(
    input: ListOrganizationObjectsRecordInput,
  ): Promise<ListOrganizationObjectsResult> {
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
        const cursor = await transaction.coreObject.findFirst({
          where: {
            id: input.afterId,
            tenantId: input.tenantId,
            owningOrganizationId: input.organizationId,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (cursor === null) {
          return { status: 'cursor_invalid' } as const;
        }
      }

      const records = await transaction.coreObject.findMany({
        where: {
          tenantId: input.tenantId,
          owningOrganizationId: input.organizationId,
          status: 'active',
          deletedAt: null,
          ...(input.objectTypeCode === undefined
            ? {}
            : { objectType: { is: { code: input.objectTypeCode, status: 'active' } } }),
        },
        include: { objectType: { select: { code: true } } },
        orderBy: { id: 'asc' },
        take: input.limit + 1,
        ...(input.afterId === undefined ? {} : { cursor: { id: input.afterId }, skip: 1 }),
      });

      const hasMore = records.length > input.limit;
      const pageRecords = hasMore ? records.slice(0, input.limit) : records;
      const lastRecord = pageRecords.at(-1);
      return {
        status: 'available',
        items: pageRecords.map((record) => this.mapObject(record)),
        nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
      } as const;
    });
  }

  private mapObjectType(record: ObjectTypeDatabaseRecord): ObjectTypeRecord {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      category: record.category,
      description: record.description,
      createdAt: record.createdAt,
    };
  }

  private mapObject(record: ObjectDatabaseRecord): ObjectRecord {
    return {
      id: record.id,
      tenantId: record.tenantId,
      owningOrganizationId: record.owningOrganizationId,
      objectTypeId: record.objectTypeId,
      objectTypeCode: record.objectType.code,
      parentObjectId: record.parentObjectId,
      name: record.name,
      referenceCode: record.referenceCode,
      serialNumber: record.serialNumber,
      description: record.description,
      createdAt: record.createdAt,
    };
  }
}
