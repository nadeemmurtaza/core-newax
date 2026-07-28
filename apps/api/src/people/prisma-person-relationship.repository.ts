import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePersonRelationshipRecordInput,
  CreatePersonRelationshipResult,
  PersonIdentifierRecord,
  PersonRecord,
  PersonRelationshipRecord,
  PersonRelationshipRepository,
  PersonRelationshipStatus,
  PersonWithIdentifiersRecord,
  UpdatePersonRelationshipRecordInput,
  UpdatePersonRelationshipResult,
} from '@newax/people';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrismaPersonRelationshipRepository implements PersonRelationshipRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createRelationship(
    input: CreatePersonRelationshipRecordInput,
  ): Promise<CreatePersonRelationshipResult> {
    try {
      const relationship = await this.prisma.corePersonRelationship.create({
        data: {
          tenantId: input.tenantId,
          sourcePersonId: input.sourcePersonId,
          targetPersonId: input.targetPersonId,
          relationshipType: input.relationshipType,
          relationshipRole: input.relationshipRole,
          relationshipBasis: input.relationshipBasis,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          sourceReference: input.sourceReference,
        },
      });
      return { status: 'created', relationship: this.mapRelationship(relationship) };
    } catch (error: unknown) {
      if (this.isRelationshipConflict(error)) {
        return { status: 'conflict' };
      }
      throw error;
    }
  }

  async findPersonById(personId: string): Promise<PersonRecord | null> {
    const person = await this.prisma.corePerson.findUnique({ where: { id: personId } });
    return person === null ? null : this.mapPerson(person);
  }

  async findRelationshipById(
    tenantId: string,
    relationshipId: string,
  ): Promise<PersonRelationshipRecord | null> {
    const relationship = await this.prisma.corePersonRelationship.findFirst({
      where: { id: relationshipId, tenantId },
    });
    return relationship === null ? null : this.mapRelationship(relationship);
  }

  async hasActiveOrganizationMembership(
    tenantId: string,
    organizationId: string,
    personId: string,
    at: Date,
  ): Promise<boolean> {
    const membership = await this.prisma.coreMembership.findFirst({
      where: {
        personId,
        organizationId,
        status: 'active',
        person: { status: 'active', deletedAt: null },
        organization: { tenantId, status: 'active', deletedAt: null },
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: at } }] },
          { OR: [{ endDate: null }, { endDate: { gte: at } }] },
        ],
      },
      select: { id: true },
    });
    return membership !== null;
  }

  async listConnectedRelationships(
    tenantId: string,
    personIds: readonly string[],
    at: Date,
  ): Promise<readonly PersonRelationshipRecord[]> {
    if (personIds.length === 0) {
      return [];
    }
    const relationships = await this.prisma.corePersonRelationship.findMany({
      where: {
        tenantId,
        status: 'active',
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: at } }] },
        ],
        OR: [
          { sourcePersonId: { in: [...personIds] } },
          { targetPersonId: { in: [...personIds] } },
        ],
      },
      orderBy: { id: 'asc' },
      take: 1000,
    });
    return relationships.map((relationship) => this.mapRelationship(relationship));
  }

  async listPeopleWithIdentifiers(
    personIds: readonly string[],
  ): Promise<readonly PersonWithIdentifiersRecord[]> {
    if (personIds.length === 0) {
      return [];
    }
    const people = await this.prisma.corePerson.findMany({
      where: { id: { in: [...personIds] } },
      include: { identifiers: { orderBy: [{ identifierType: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    });
    return people.map((person) => ({
      person: this.mapPerson(person),
      identifiers: person.identifiers.map((identifier) => this.mapIdentifier(identifier)),
    }));
  }

  async updateRelationship(
    input: UpdatePersonRelationshipRecordInput,
  ): Promise<UpdatePersonRelationshipResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const update = await transaction.corePersonRelationship.updateMany({
          where: {
            id: input.relationshipId,
            tenantId: input.tenantId,
            version: input.expectedVersion,
          },
          data: {
            relationshipRole: input.relationshipRole,
            relationshipBasis: input.relationshipBasis,
            status: input.status,
            validFrom: input.validFrom,
            validUntil: input.validUntil,
            isVerified: input.isVerified,
            verifiedAt: input.verifiedAt,
            verifiedByUserId: input.verifiedByUserId,
            verificationSource: input.verificationSource,
            verificationRevokedAt: input.verificationRevokedAt,
            verificationRevokedByUserId: input.verificationRevokedByUserId,
            verificationRevocationReason: input.verificationRevocationReason,
            sourceReference: input.sourceReference,
            version: { increment: 1 },
          },
        });
        if (update.count === 0) {
          const existing = await transaction.corePersonRelationship.findUnique({
            where: { id: input.relationshipId },
            select: { tenantId: true },
          });
          return existing === null || existing.tenantId !== input.tenantId
            ? { status: 'not_found' as const }
            : { status: 'conflict' as const };
        }
        const relationship = await transaction.corePersonRelationship.findUniqueOrThrow({
          where: { id: input.relationshipId },
        });
        return { status: 'updated' as const, relationship: this.mapRelationship(relationship) };
      });
    } catch (error: unknown) {
      if (this.isRelationshipConflict(error)) {
        return { status: 'conflict' };
      }
      throw error;
    }
  }

  private mapPerson(record: {
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
  }): PersonRecord {
    const status = record.status;
    if (status !== 'active' && status !== 'suspended' && status !== 'archived') {
      throw new Error(`Unsupported person status: ${status}`);
    }
    return { ...record, status };
  }

  private mapIdentifier(record: {
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
  }): PersonIdentifierRecord {
    return { ...record };
  }

  private mapRelationship(record: {
    readonly id: string;
    readonly tenantId: string;
    readonly sourcePersonId: string;
    readonly targetPersonId: string;
    readonly relationshipType: string;
    readonly relationshipRole: string;
    readonly relationshipBasis: string;
    readonly status: string;
    readonly validFrom: Date | null;
    readonly validUntil: Date | null;
    readonly isVerified: boolean;
    readonly verifiedAt: Date | null;
    readonly verifiedByUserId: string | null;
    readonly verificationSource: string | null;
    readonly verificationRevokedAt: Date | null;
    readonly verificationRevokedByUserId: string | null;
    readonly verificationRevocationReason: string | null;
    readonly sourceReference: string | null;
    readonly version: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  }): PersonRelationshipRecord {
    return { ...record, status: this.relationshipStatus(record.status) };
  }

  private relationshipStatus(status: string): PersonRelationshipStatus {
    if (status === 'active' || status === 'ended') {
      return status;
    }
    throw new Error(`Unsupported person relationship status: ${status}`);
  }

  private isRelationshipConflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const coded = error as { readonly code?: unknown; readonly meta?: unknown };
    if (coded.code === 'P2002') {
      return true;
    }
    if (typeof coded.meta === 'object' && coded.meta !== null && 'code' in coded.meta) {
      const databaseCode = (coded.meta as { readonly code?: unknown }).code;
      return databaseCode === '23505' || databaseCode === '23514';
    }
    return coded.code === '23505' || coded.code === '23514';
  }
}
