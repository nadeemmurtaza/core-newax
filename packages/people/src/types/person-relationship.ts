import type { PersonIdentifierRecord, PersonRecord } from './person';

export type PersonRelationshipStatus = 'active' | 'ended';

export interface PersonRelationshipRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface PersonRelationshipRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly sourcePersonId: string;
  readonly targetPersonId: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
  readonly status: PersonRelationshipStatus;
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
}

export interface PersonWithIdentifiersRecord {
  readonly person: PersonRecord;
  readonly identifiers: readonly PersonIdentifierRecord[];
}

export interface CreatePersonRelationshipInput {
  readonly sourcePersonId: string;
  readonly targetPersonId: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
  readonly validFrom?: Date | null;
  readonly validUntil?: Date | null;
  readonly sourceReference?: string | null;
}

export interface UpdatePersonRelationshipInput {
  readonly expectedVersion: number;
  readonly relationshipRole?: string;
  readonly relationshipBasis?: string;
  readonly validFrom?: Date | null;
  readonly validUntil?: Date | null;
  readonly sourceReference?: string | null;
}

export interface EndPersonRelationshipInput {
  readonly expectedVersion: number;
  readonly validUntil?: Date | null;
}

export interface VerifyPersonRelationshipInput {
  readonly expectedVersion: number;
  readonly verificationSource: string;
  readonly sourceReference?: string | null;
}

export interface RevokePersonRelationshipVerificationInput {
  readonly expectedVersion: number;
  readonly reason: string;
}

export interface FamilyTreeQuery {
  readonly depth?: number;
  readonly includeSensitive?: boolean;
}

export interface FamilyPersonIdentifierProjection {
  readonly id: string;
  readonly identifierType: string;
  readonly identifierValue: string | null;
  readonly maskedValue: string;
  readonly issuingAuthority: string | null;
  readonly issuingCountryCode: string | null;
  readonly isVerified: boolean;
}

export interface FamilyPersonNode {
  readonly id: string;
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly status: string;
  readonly dateOfBirth: Date | null;
  readonly gender: string | null;
  readonly identifiers: readonly FamilyPersonIdentifierProjection[];
}

export interface FamilyTreeRelationship {
  readonly id: string;
  readonly sourcePersonId: string;
  readonly targetPersonId: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
  readonly status: PersonRelationshipStatus;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly isVerified: boolean;
  readonly verificationSource: string | null;
  readonly sourceReference: string | null;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface FamilyTreeGraph {
  readonly rootPersonId: string;
  readonly depth: number;
  readonly sensitiveFieldsIncluded: boolean;
  readonly truncated: boolean;
  readonly nodes: readonly FamilyPersonNode[];
  readonly relationships: readonly FamilyTreeRelationship[];
}

export interface CreatePersonRelationshipRecordInput {
  readonly tenantId: string;
  readonly sourcePersonId: string;
  readonly targetPersonId: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly sourceReference: string | null;
}

export interface UpdatePersonRelationshipRecordInput {
  readonly tenantId: string;
  readonly relationshipId: string;
  readonly expectedVersion: number;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
  readonly status: PersonRelationshipStatus;
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
}

export type CreatePersonRelationshipResult =
  | { readonly status: 'created'; readonly relationship: PersonRelationshipRecord }
  | { readonly status: 'conflict' };

export type UpdatePersonRelationshipResult =
  | { readonly status: 'updated'; readonly relationship: PersonRelationshipRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'conflict' };
