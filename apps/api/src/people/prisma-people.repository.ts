import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePersonIdentifierRecordInput,
  CreatePersonIdentifierResult,
  CreatePersonRecordInput,
  PeopleRepository,
  PersonIdentifierRecord,
  PersonListQuery,
  PersonPage,
  PersonRecord,
  PersonStatus,
  UpdatePersonRecordInput,
} from '@newax/people';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface PersonDatabaseRecord {
  readonly id: string;
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: Date | null;
  readonly gender: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

interface PersonIdentifierDatabaseRecord {
  readonly id: string;
  readonly personId: string;
  readonly identifierType: string;
  readonly identifierValue: string;
  readonly issuingAuthority: string | null;
  readonly issuingCountryCode: string | null;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly isVerified: boolean;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class PrismaPeopleRepository implements PeopleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async archive(id: string, archivedAt: Date): Promise<PersonRecord> {
    const record = await this.prisma.corePerson.update({
      where: { id },
      data: {
        status: 'archived',
        deletedAt: archivedAt,
      },
    });

    return this.mapPerson(record);
  }

  async create(input: CreatePersonRecordInput): Promise<PersonRecord> {
    const data: Prisma.CorePersonUncheckedCreateInput = {
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      preferredName: input.preferredName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
    };

    const record = await this.prisma.corePerson.create({ data });
    return this.mapPerson(record);
  }

  async createIdentifier(
    input: CreatePersonIdentifierRecordInput,
  ): Promise<CreatePersonIdentifierResult> {
    const lockKey = [
      input.identifierType,
      input.issuingCountryCode ?? '',
      input.issuingAuthority ?? '',
      input.identifierValue,
    ].join('|');

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreatePersonIdentifierResult> => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        const existing = await transaction.corePersonIdentifier.findFirst({
          where: {
            identifierType: input.identifierType,
            identifierValue: input.identifierValue,
            issuingAuthority: input.issuingAuthority,
            issuingCountryCode: input.issuingCountryCode,
          },
          select: { personId: true },
        });

        if (existing !== null) {
          return {
            status: 'conflict',
            existingPersonId: existing.personId,
          };
        }

        const data: Prisma.CorePersonIdentifierUncheckedCreateInput = {
          personId: input.personId,
          identifierType: input.identifierType,
          identifierValue: input.identifierValue,
          issuingAuthority: input.issuingAuthority,
          issuingCountryCode: input.issuingCountryCode,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
        };

        const record = await transaction.corePersonIdentifier.create({ data });
        return {
          status: 'created',
          identifier: this.mapIdentifier(record),
        };
      },
    );
  }

  async findById(id: string): Promise<PersonRecord | null> {
    const record = await this.prisma.corePerson.findUnique({ where: { id } });
    return record === null ? null : this.mapPerson(record);
  }

  async findIdentifierById(id: string): Promise<PersonIdentifierRecord | null> {
    const record = await this.prisma.corePersonIdentifier.findUnique({ where: { id } });
    return record === null ? null : this.mapIdentifier(record);
  }

  async list(query: PersonListQuery): Promise<PersonPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CorePersonWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.deletedAt = null;
    }

    if (query.search !== undefined) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { middleName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { preferredName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.corePerson.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const lastRecord = pageRecords.at(-1);

    return {
      items: pageRecords.map((record) => this.mapPerson(record)),
      nextCursor: hasMore && lastRecord !== undefined ? lastRecord.id : null,
    };
  }

  async listIdentifiers(personId: string): Promise<readonly PersonIdentifierRecord[]> {
    const records = await this.prisma.corePersonIdentifier.findMany({
      where: { personId },
      orderBy: [{ identifierType: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map((record) => this.mapIdentifier(record));
  }

  async update(id: string, input: UpdatePersonRecordInput): Promise<PersonRecord> {
    const data: Prisma.CorePersonUncheckedUpdateInput = {};

    if (input.firstName !== undefined) {
      data.firstName = input.firstName;
    }

    if ('middleName' in input) {
      data.middleName = input.middleName ?? null;
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName;
    }

    if ('preferredName' in input) {
      data.preferredName = input.preferredName ?? null;
    }

    if ('dateOfBirth' in input) {
      data.dateOfBirth = input.dateOfBirth ?? null;
    }

    if ('gender' in input) {
      data.gender = input.gender ?? null;
    }

    const record = await this.prisma.corePerson.update({ where: { id }, data });
    return this.mapPerson(record);
  }

  async verifyIdentifier(id: string, verifiedAt: Date): Promise<PersonIdentifierRecord> {
    const record = await this.prisma.corePersonIdentifier.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt,
      },
    });

    return this.mapIdentifier(record);
  }

  private mapPerson(record: PersonDatabaseRecord): PersonRecord {
    return {
      ...record,
      status: this.mapStatus(record.status),
    };
  }

  private mapIdentifier(record: PersonIdentifierDatabaseRecord): PersonIdentifierRecord {
    return { ...record };
  }

  private mapStatus(status: string): PersonStatus {
    if (status === 'active' || status === 'suspended' || status === 'archived') {
      return status;
    }

    throw new Error(`Unsupported person status: ${status}`);
  }
}
