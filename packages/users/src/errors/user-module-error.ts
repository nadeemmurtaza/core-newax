export type UserErrorCode =
  | 'USER_ACCOUNT_CONFLICT'
  | 'USER_ACCOUNT_NOT_FOUND'
  | 'USER_ACCOUNT_UNAVAILABLE'
  | 'USER_FORBIDDEN'
  | 'USER_IDENTITY_CONFLICT'
  | 'USER_IDENTITY_LAST_REMAINING'
  | 'USER_IDENTITY_NOT_FOUND'
  | 'USER_INVALID_INPUT'
  | 'USER_MEMBERSHIP_NOT_FOUND'
  | 'USER_MEMBERSHIP_UNAVAILABLE'
  | 'USER_ORGANIZATION_NOT_FOUND'
  | 'USER_ORGANIZATION_UNAVAILABLE'
  | 'USER_PERSON_NOT_FOUND'
  | 'USER_PERSON_UNAVAILABLE'
  | 'USER_PLATFORM_CONTEXT_REQUIRED'
  | 'USER_ACCOUNT_NOT_PERSON_BACKED';

export class UserModuleError extends Error {
  readonly code: UserErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: UserErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'UserModuleError';
    this.code = code;
    this.details = details;
  }
}
