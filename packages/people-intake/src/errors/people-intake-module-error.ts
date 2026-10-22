export type PeopleIntakeErrorCode =
  | 'PEOPLE_INTAKE_CONFLICT'
  | 'PEOPLE_INTAKE_CURSOR_INVALID'
  | 'PEOPLE_INTAKE_FORBIDDEN'
  | 'PEOPLE_INTAKE_INTEGRITY_FAILURE'
  | 'PEOPLE_INTAKE_INVALID_INPUT'
  | 'PEOPLE_INTAKE_NOT_FOUND'
  | 'PEOPLE_INTAKE_ORGANIZATION_UNAVAILABLE'
  | 'PEOPLE_INTAKE_STATE_CONFLICT';

export class PeopleIntakeModuleError extends Error {
  readonly code: PeopleIntakeErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: PeopleIntakeErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'PeopleIntakeModuleError';
    this.code = code;
    this.details = details;
  }
}
