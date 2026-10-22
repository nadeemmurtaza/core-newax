export type PeopleIntakeStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type PeopleIntakeReviewDecision = 'approved' | 'rejected';

export interface ProposedPersonIdentifierInput {
  readonly identifierType: string;
  readonly identifierValue: string;
  readonly issuingAuthority?: string | null;
  readonly issuingCountryCode?: string | null;
}

export interface ProposedPersonInput {
  readonly clientKey: string;
  readonly firstName: string;
  readonly middleName?: string | null;
  readonly lastName: string;
  readonly preferredName?: string | null;
  readonly dateOfBirth?: string | null;
  readonly gender?: string | null;
  readonly identifiers?: readonly ProposedPersonIdentifierInput[];
}

export interface ProposedPersonRelationshipInput {
  readonly sourcePersonKey: string;
  readonly targetPersonKey: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
}

export interface PeopleIntakePayloadInput {
  readonly schemaVersion: 1;
  readonly people: readonly ProposedPersonInput[];
  readonly relationships: readonly ProposedPersonRelationshipInput[];
}

export interface ProposedPersonIdentifier {
  readonly identifierType: string;
  readonly identifierValue: string;
  readonly issuingAuthority: string | null;
  readonly issuingCountryCode: string | null;
}

export interface ProposedPerson {
  readonly clientKey: string;
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly identifiers: readonly ProposedPersonIdentifier[];
}

export interface ProposedPersonRelationship {
  readonly sourcePersonKey: string;
  readonly targetPersonKey: string;
  readonly relationshipType: string;
  readonly relationshipRole: string;
  readonly relationshipBasis: string;
}

export interface PeopleIntakePayload {
  readonly schemaVersion: 1;
  readonly people: readonly ProposedPerson[];
  readonly relationships: readonly ProposedPersonRelationship[];
}

export interface PeopleIntakeRequestContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface PeopleIntakeSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly title: string;
  readonly sourceType: string;
  readonly sourceReference: string | null;
  readonly status: PeopleIntakeStatus;
  readonly personCount: number;
  readonly relationshipCount: number;
  readonly version: number;
  readonly createdByUserId: string;
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedByUserId: string | null;
  readonly reviewDecision: PeopleIntakeReviewDecision | null;
  readonly reviewNotes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PeopleIntakeRecord extends PeopleIntakeSummary {
  readonly payload: PeopleIntakePayload;
}

export interface StoredPeopleIntakeRecord extends PeopleIntakeSummary {
  readonly payload: unknown;
}

export interface CreatePeopleIntakeDraftInput {
  readonly title: string;
  readonly sourceType: string;
  readonly sourceReference?: string | null;
  readonly payload: PeopleIntakePayloadInput;
}

export interface UpdatePeopleIntakeDraftInput extends CreatePeopleIntakeDraftInput {
  readonly expectedVersion: number;
}

export interface SubmitPeopleIntakeInput {
  readonly expectedVersion: number;
}

export interface ReviewPeopleIntakeInput {
  readonly expectedVersion: number;
  readonly decision: PeopleIntakeReviewDecision;
  readonly notes?: string | null;
}

export interface PeopleIntakeListQuery {
  readonly status?: PeopleIntakeStatus;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface PeopleIntakePage {
  readonly items: readonly PeopleIntakeSummary[];
  readonly nextCursor: string | null;
}

export interface CreatePeopleIntakeRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly title: string;
  readonly sourceType: string;
  readonly sourceReference: string | null;
  readonly payload: PeopleIntakePayload;
  readonly personCount: number;
  readonly relationshipCount: number;
}

export interface UpdatePeopleIntakeRecordInput extends Omit<
  CreatePeopleIntakeRecordInput,
  'actorUserId'
> {
  readonly id: string;
  readonly actorUserId: string;
  readonly expectedVersion: number;
}

export interface PeopleIntakeIdentityInput {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
}

export interface SubmitPeopleIntakeRecordInput extends PeopleIntakeIdentityInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly submittedAt: Date;
}

export interface ReviewPeopleIntakeRecordInput extends PeopleIntakeIdentityInput {
  readonly reviewerUserId: string;
  readonly expectedVersion: number;
  readonly decision: PeopleIntakeReviewDecision;
  readonly notes: string | null;
  readonly reviewedAt: Date;
}

export interface ListPeopleIntakesRecordInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly status?: PeopleIntakeStatus;
  readonly limit: number;
  readonly afterId?: string;
}

export type CreatePeopleIntakeRecordResult =
  | { readonly status: 'created'; readonly intake: StoredPeopleIntakeRecord }
  | { readonly status: 'organization_unavailable' };

export type UpdatePeopleIntakeRecordResult =
  | { readonly status: 'updated'; readonly intake: StoredPeopleIntakeRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'version_conflict' }
  | { readonly status: 'state_conflict' }
  | { readonly status: 'creator_mismatch' };

export type SubmitPeopleIntakeRecordResult =
  | { readonly status: 'submitted'; readonly intake: StoredPeopleIntakeRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'version_conflict' }
  | { readonly status: 'state_conflict' }
  | { readonly status: 'creator_mismatch' };

export type ReviewPeopleIntakeRecordResult =
  | { readonly status: 'reviewed'; readonly intake: StoredPeopleIntakeRecord }
  | { readonly status: 'not_found' }
  | { readonly status: 'version_conflict' }
  | { readonly status: 'state_conflict' }
  | { readonly status: 'self_review' };

export type ListPeopleIntakesRecordResult =
  | {
      readonly status: 'available';
      readonly items: readonly PeopleIntakeSummary[];
      readonly nextCursor: string | null;
    }
  | { readonly status: 'cursor_invalid' }
  | { readonly status: 'organization_unavailable' };
