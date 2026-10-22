import { Inject, Injectable } from '@nestjs/common';
import type {
  FileRecord,
  FileRepository,
  ListOrganizationFilesRecordInput,
  ListOrganizationFilesResult,
  RegisterOrganizationFileRecordInput,
  RegisterOrganizationFileResult,
} from '@newax/files';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface FileDatabaseRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: bigint;
  readonly createdAt: Date;
}

@Injectable()
export class PrismaFilesRepository implements FileRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registerOrganizationFile(
    input: RegisterOrganizationFileRecordInput,
  ): Promise<RegisterOrganizationFileResult> {
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
          person: { is: { status: 'active', deletedAt: null } },
        },
        select: { id: true },
      });
      if (actor === null) {
        return { status: 'actor_unavailable' } as const;
      }

      const lockKey = `file-storage|${input.storageProvider}|${input.storageKey}`;
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;

      const existing = await transaction.coreFile.findUnique({
        where: {
          storageProvider_storageKey: {
            storageProvider: input.storageProvider,
            storageKey: input.storageKey,
          },
        },
        select: { id: true },
      });
      if (existing !== null) {
        return { status: 'conflict' } as const;
      }

      const record = await transaction.coreFile.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          storageProvider: input.storageProvider,
          storageKey: input.storageKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          checksum: input.checksum,
          status: 'active',
          createdByUserId: input.actorUserId,
        },
      });

      return { status: 'created', file: this.mapFile(record) } as const;
    });
  }

  async listOrganizationFiles(
    input: ListOrganizationFilesRecordInput,
  ): Promise<ListOrganizationFilesResult> {
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
        const cursor = await transaction.coreFile.findFirst({
          where: {
            id: input.afterId,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            status: 'active',
          },
          select: { id: true },
        });
        if (cursor === null) {
          return { status: 'cursor_invalid' } as const;
        }
      }

      const records = await transaction.coreFile.findMany({
        where: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          status: 'active',
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
        items: pageRecords.map((record) => this.mapFile(record)),
        nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
      } as const;
    });
  }

  private mapFile(record: FileDatabaseRecord): FileRecord {
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      createdAt: record.createdAt,
    };
  }
}
