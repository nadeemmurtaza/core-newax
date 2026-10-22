import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateTenantRecordInput,
  TenantListQuery,
  TenantPage,
  TenantRecord,
  TenantRepository,
  TenantStatus,
} from '@newax/tenants';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface TenantDatabaseRecord {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateTenantRecordInput): Promise<TenantRecord> {
    return this.mapRecord(await this.prisma.coreTenant.create({ data: { name: input.name } }));
  }

  async findById(id: string): Promise<TenantRecord | null> {
    const record = await this.prisma.coreTenant.findUnique({ where: { id } });
    return record === null ? null : this.mapRecord(record);
  }

  async list(query: TenantListQuery): Promise<TenantPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CoreTenantWhereInput = {};
    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.deletedAt = null;
    }
    if (query.search !== undefined) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    const records = await this.prisma.coreTenant.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    return {
      items: page.map((record) => this.mapRecord(record)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private mapRecord(record: TenantDatabaseRecord): TenantRecord {
    return { ...record, status: this.mapStatus(record.status) };
  }

  private mapStatus(value: string): TenantStatus {
    if (value === 'active' || value === 'suspended' || value === 'archived') {
      return value;
    }
    throw new Error(`Unsupported tenant status: ${value}`);
  }
}
