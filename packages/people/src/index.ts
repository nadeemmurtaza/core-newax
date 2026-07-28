export type { PersonRelationshipRepository } from './database/person-relationship-repository';
export type { PeopleRepository } from './database/people-repository';
export type {
  PersonEvent,
  PersonEventPublisher,
  PersonIdentifierEvent,
  PersonIdentifierEventName,
  PersonLifecycleEvent,
  PersonLifecycleEventName,
} from './events/person-event';
export { PeopleModuleError, type PeopleErrorCode } from './errors/people-module-error';
export { PEOPLE_PERMISSIONS, type PeoplePermission } from './permissions/people-permissions';
export { PeopleService } from './services/people.service';
export type {
  AddPersonIdentifierInput,
  CreatePersonIdentifierRecordInput,
  CreatePersonIdentifierResult,
  CreatePersonInput,
  CreatePersonRecordInput,
  CurrentPersonProfile,
  CurrentPersonRequestContext,
  PersonIdentifierRecord,
  PersonListQuery,
  PersonPage,
  PersonRecord,
  PersonStatus,
  PeopleRequestContext,
  UpdatePersonInput,
  UpdatePersonRecordInput,
} from './types/person';

export type {
  PersonRelationshipEvent,
  PersonRelationshipEventName,
  PersonRelationshipEventPublisher,
} from './events/person-relationship-event';
export { PersonRelationshipService } from './services/person-relationship.service';
export type {
  CreatePersonRelationshipInput,
  CreatePersonRelationshipRecordInput,
  CreatePersonRelationshipResult,
  EndPersonRelationshipInput,
  FamilyPersonIdentifierProjection,
  FamilyPersonNode,
  FamilyTreeGraph,
  FamilyTreeQuery,
  FamilyTreeRelationship,
  PersonRelationshipRecord,
  PersonRelationshipRequestContext,
  PersonRelationshipStatus,
  PersonWithIdentifiersRecord,
  RevokePersonRelationshipVerificationInput,
  UpdatePersonRelationshipInput,
  UpdatePersonRelationshipRecordInput,
  UpdatePersonRelationshipResult,
  VerifyPersonRelationshipInput,
} from './types/person-relationship';
