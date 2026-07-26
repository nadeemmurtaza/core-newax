import { Inject, Injectable } from '@nestjs/common';
import type {
  ContactType,
  ContactsRepository,
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  OrganizationContactRecord,
  OrganizationContactStatus,
} from '@newax/contacts';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

interface OrganizationContactDatabaseRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly contactMethodId: string;
  readonly label: string | null;
  readonly isPrimary: boolean;
  readonly status: string;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
  readonly contactMethod: {
    readonly id: string;
    readonly contactType: string;
    readonly contactValue: string;
    readonly normalizedValue: string;
  };
}

@Injectable()
export class PrismaContactsRepository implements ContactsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrganizationContact(
    input: CreateOrganizationContactRecordInput,
  ): Promise<CreateOrganizationContactResult> {
    const lockKey = `contact-method|${input.contactType}|${input.normalizedValue}`;

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreateOrganizationContactResult> => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        if (input.isPrimary) {
          const primaryLockKey = `contact-primary|${input.organizationId}|${input.contactType}`;
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${primaryLockKey}, 0))
          `;
        }

        const organization = await transaction.coreOrganization.findFirst({
          where: {
            id: input.organizationId,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (organization === null) {
          return { status: 'organization_unavailable' };
        }

        let contactMethod = await transaction.coreContactMethod.findFirst({
          where: {
            contactType: input.contactType,
            normalizedValue: input.normalizedValue,
          },
        });

        if (contactMethod === null) {
          contactMethod = await transaction.coreContactMethod.create({
            data: {
              contactType: input.contactType,
              contactValue: input.contactValue,
              normalizedValue: input.normalizedValue,
            },
          });
        }

        const existing = await transaction.coreOrganizationContactMethod.findFirst({
          where: {
            organizationId: input.organizationId,
            contactMethodId: contactMethod.id,
          },
          select: { id: true },
        });
        if (existing !== null) {
          return { status: 'conflict' };
        }

        if (input.isPrimary) {
          await transaction.$executeRaw`
            UPDATE core_organization_contact_methods AS organization_contact
            SET is_primary = FALSE
            FROM core_contact_methods AS contact_method
            WHERE organization_contact.contact_method_id = contact_method.id
              AND organization_contact.organization_id = ${input.organizationId}::uuid
              AND organization_contact.status = 'active'
              AND organization_contact.is_primary = TRUE
              AND contact_method.contact_type = ${input.contactType}
          `;
        }

        const record = await transaction.coreOrganizationContactMethod.create({
          data: {
            organizationId: input.organizationId,
            contactMethodId: contactMethod.id,
            label: input.label,
            isPrimary: input.isPrimary,
            status: 'active',
            validFrom: input.validFrom,
            validUntil: input.validUntil,
          },
          include: { contactMethod: true },
        });

        return { status: 'created', contact: this.mapRecord(record) };
      },
    );
  }

  async listOrganizationContacts(
    input: ListOrganizationContactsRecordInput,
  ): Promise<ListOrganizationContactsResult> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<ListOrganizationContactsResult> => {
        const organization = await transaction.coreOrganization.findFirst({
          where: {
            id: input.organizationId,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (organization === null) {
          return { status: 'organization_unavailable' };
        }

        if (input.afterId !== undefined) {
          const cursor = await transaction.coreOrganizationContactMethod.findFirst({
            where: {
              id: input.afterId,
              organizationId: input.organizationId,
              status: 'active',
            },
            select: { id: true },
          });
          if (cursor === null) {
            return { status: 'cursor_invalid' };
          }
        }

        const records = await transaction.coreOrganizationContactMethod.findMany({
          where: {
            organizationId: input.organizationId,
            status: 'active',
          },
          include: { contactMethod: true },
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

  private mapRecord(record: OrganizationContactDatabaseRecord): OrganizationContactRecord {
    return {
      id: record.id,
      organizationId: record.organizationId,
      contactMethodId: record.contactMethodId,
      contactType: this.mapContactType(record.contactMethod.contactType),
      contactValue: record.contactMethod.contactValue,
      normalizedValue: record.contactMethod.normalizedValue,
      // A globally reused contact method may have been verified for a different
      // relationship. Organization verification remains unavailable until its
      // ownership and evidence contract is implemented.
      isVerified: false,
      verifiedAt: null,
      label: record.label,
      isPrimary: record.isPrimary,
      status: this.mapStatus(record.status),
      validFrom: record.validFrom,
      validUntil: record.validUntil,
      createdAt: record.createdAt,
    };
  }

  private mapContactType(value: string): ContactType {
    if (value === 'email' || value === 'phone') {
      return value;
    }
    throw new Error(`Unsupported contact type: ${value}`);
  }

  private mapStatus(value: string): OrganizationContactStatus {
    if (value === 'active' || value === 'removed') {
      return value;
    }
    throw new Error(`Unsupported organization contact status: ${value}`);
  }
}
