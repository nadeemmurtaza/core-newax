import type {
  CreatePersonRelationshipRecordInput,
  CreatePersonRelationshipResult,
  PersonRelationshipRecord,
  PersonWithIdentifiersRecord,
  UpdatePersonRelationshipRecordInput,
  UpdatePersonRelationshipResult,
} from '../types/person-relationship';
import type { PersonRecord } from '../types/person';

export interface PersonRelationshipRepository {
  createRelationship(
    input: CreatePersonRelationshipRecordInput,
  ): Promise<CreatePersonRelationshipResult>;
  findPersonById(personId: string): Promise<PersonRecord | null>;
  findRelationshipById(
    tenantId: string,
    relationshipId: string,
  ): Promise<PersonRelationshipRecord | null>;
  hasActiveOrganizationMembership(
    tenantId: string,
    organizationId: string,
    personId: string,
    at: Date,
  ): Promise<boolean>;
  listConnectedRelationships(
    tenantId: string,
    personIds: readonly string[],
    at: Date,
  ): Promise<readonly PersonRelationshipRecord[]>;
  listPeopleWithIdentifiers(
    personIds: readonly string[],
  ): Promise<readonly PersonWithIdentifiersRecord[]>;
  updateRelationship(
    input: UpdatePersonRelationshipRecordInput,
  ): Promise<UpdatePersonRelationshipResult>;
}
