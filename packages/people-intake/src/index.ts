export type { PeopleIntakeRepository } from './database/people-intake-repository';
export {
  PeopleIntakeModuleError,
  type PeopleIntakeErrorCode,
} from './errors/people-intake-module-error';
export {
  PEOPLE_INTAKE_PERMISSIONS,
  type PeopleIntakePermission,
} from './permissions/people-intake-permissions';
export { PeopleIntakeService } from './services/people-intake.service';
export type {
  CreatePeopleIntakeDraftInput,
  CreatePeopleIntakeRecordInput,
  CreatePeopleIntakeRecordResult,
  ListPeopleIntakesRecordInput,
  ListPeopleIntakesRecordResult,
  PeopleIntakeIdentityInput,
  PeopleIntakeListQuery,
  PeopleIntakePage,
  PeopleIntakePayload,
  PeopleIntakePayloadInput,
  PeopleIntakeRecord,
  PeopleIntakeRequestContext,
  PeopleIntakeReviewDecision,
  PeopleIntakeStatus,
  PeopleIntakeSummary,
  ProposedPerson,
  ProposedPersonIdentifier,
  ProposedPersonIdentifierInput,
  ProposedPersonInput,
  ProposedPersonRelationship,
  ProposedPersonRelationshipInput,
  ReviewPeopleIntakeInput,
  ReviewPeopleIntakeRecordInput,
  ReviewPeopleIntakeRecordResult,
  StoredPeopleIntakeRecord,
  SubmitPeopleIntakeInput,
  SubmitPeopleIntakeRecordInput,
  SubmitPeopleIntakeRecordResult,
  UpdatePeopleIntakeDraftInput,
  UpdatePeopleIntakeRecordInput,
  UpdatePeopleIntakeRecordResult,
} from './types/people-intake';
