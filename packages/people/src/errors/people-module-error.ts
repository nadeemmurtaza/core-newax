export type PeopleErrorCode =
  | 'PERSON_ARCHIVED'
  | 'PERSON_FORBIDDEN'
  | 'PERSON_IDENTIFIER_CONFLICT'
  | 'PERSON_IDENTIFIER_NOT_FOUND'
  | 'PERSON_INTEGRITY_FAILURE'
  | 'PERSON_INVALID_INPUT'
  | 'PERSON_NOT_FOUND'
  | 'PERSON_RELATIONSHIP_CONFLICT'
  | 'PERSON_RELATIONSHIP_FORBIDDEN'
  | 'PERSON_RELATIONSHIP_INTEGRITY_FAILURE'
  | 'PERSON_RELATIONSHIP_INVALID_INPUT'
  | 'PERSON_RELATIONSHIP_NOT_FOUND'
  | 'PERSON_RELATIONSHIP_STATE_CONFLICT';

export class PeopleModuleError extends Error {
  readonly code: PeopleErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: PeopleErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'PeopleModuleError';
    this.code = code;
    this.details = details;
  }
}
