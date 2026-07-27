import { Inject, Injectable } from '@nestjs/common';
import type {
  AddressRepository,
  CreateOrganizationAddressRecordInput,
  CreateOrganizationAddressResult,
  ListOrganizationAddressesRecordInput,
  ListOrganizationAddressesResult,
  OrganizationAddressRecord,
  OrganizationAddressType,
} from '@newax/addresses';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface OrganizationAddressDatabaseRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly addressId: string;
  readonly addressType: string;
  readonly isPrimary: boolean;
  readonly createdAt: Date;
  readonly organization: {
    readonly tenantId: string;
  };
  readonly address: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly province: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
}

@Injectable()
export class PrismaAddressesRepository implements AddressRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrganizationAddress(
    input: CreateOrganizationAddressRecordInput,
  ): Promise<CreateOrganizationAddressResult> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreateOrganizationAddressResult> => {
        const organization = await transaction.coreOrganization.findFirst({
          where: {
            id: input.organizationId,
            tenantId: input.tenantId,
            status: 'active',
            deletedAt: null,
            tenant: { is: { status: 'active', deletedAt: null } },
          },
          select: { id: true, tenantId: true },
        });
        if (organization === null) {
          return { status: 'organization_unavailable' };
        }

        const addressLockKey = `address-canonical|${input.canonicalKey}`;
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${addressLockKey}, 0))
        `;

        if (input.isPrimary) {
          const primaryLockKey = `address-primary|${input.tenantId}|${input.organizationId}|${input.addressType}`;
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${primaryLockKey}, 0))
          `;
        }

        let address = await transaction.coreAddress.findFirst({
          where: {
            line1: { equals: input.line1, mode: 'insensitive' },
            line2: input.line2 === null ? null : { equals: input.line2, mode: 'insensitive' },
            city: { equals: input.city, mode: 'insensitive' },
            province:
              input.stateRegion === null
                ? null
                : { equals: input.stateRegion, mode: 'insensitive' },
            postalCode:
              input.postalCode === null ? null : { equals: input.postalCode, mode: 'insensitive' },
            countryCode: input.countryCode,
          },
        });

        if (address === null) {
          address = await transaction.coreAddress.create({
            data: {
              line1: input.line1,
              line2: input.line2,
              city: input.city,
              province: input.stateRegion,
              postalCode: input.postalCode,
              countryCode: input.countryCode,
            },
          });
        }

        const existing = await transaction.coreOrganizationAddress.findFirst({
          where: {
            organizationId: input.organizationId,
            addressId: address.id,
            addressType: input.addressType,
            status: 'active',
          },
          select: { id: true },
        });
        if (existing !== null) {
          return { status: 'conflict' };
        }

        if (input.isPrimary) {
          await transaction.coreOrganizationAddress.updateMany({
            where: {
              organizationId: input.organizationId,
              addressType: input.addressType,
              status: 'active',
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        }

        const record = await transaction.coreOrganizationAddress.create({
          data: {
            organizationId: input.organizationId,
            addressId: address.id,
            addressType: input.addressType,
            isPrimary: input.isPrimary,
            status: 'active',
          },
          include: {
            organization: { select: { tenantId: true } },
            address: true,
          },
        });

        return { status: 'created', address: this.mapRecord(record) };
      },
    );
  }

  async listOrganizationAddresses(
    input: ListOrganizationAddressesRecordInput,
  ): Promise<ListOrganizationAddressesResult> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<ListOrganizationAddressesResult> => {
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
          return { status: 'organization_unavailable' };
        }

        if (input.afterId !== undefined) {
          const cursor = await transaction.coreOrganizationAddress.findFirst({
            where: {
              id: input.afterId,
              organizationId: input.organizationId,
              status: 'active',
              organization: { is: { tenantId: input.tenantId } },
            },
            select: { id: true },
          });
          if (cursor === null) {
            return { status: 'cursor_invalid' };
          }
        }

        const records = await transaction.coreOrganizationAddress.findMany({
          where: {
            organizationId: input.organizationId,
            status: 'active',
            organization: { is: { tenantId: input.tenantId } },
            ...(input.addressType === undefined ? {} : { addressType: input.addressType }),
          },
          include: {
            organization: { select: { tenantId: true } },
            address: true,
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
          items: pageRecords.map((record) => this.mapRecord(record)),
          nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
        };
      },
    );
  }

  private mapRecord(record: OrganizationAddressDatabaseRecord): OrganizationAddressRecord {
    return {
      id: record.id,
      tenantId: record.organization.tenantId,
      organizationId: record.organizationId,
      addressId: record.addressId,
      addressType: this.mapAddressType(record.addressType),
      isPrimary: record.isPrimary,
      line1: record.address.line1,
      line2: record.address.line2,
      city: record.address.city,
      stateRegion: record.address.province,
      postalCode: record.address.postalCode,
      countryCode: record.address.countryCode,
      createdAt: record.createdAt,
    };
  }

  private mapAddressType(value: string): OrganizationAddressType {
    if (
      value === 'registered' ||
      value === 'office' ||
      value === 'billing' ||
      value === 'shipping' ||
      value === 'mailing' ||
      value === 'campus' ||
      value === 'facility' ||
      value === 'other'
    ) {
      return value;
    }
    throw new Error(`Unsupported organization address type: ${value}`);
  }
}
