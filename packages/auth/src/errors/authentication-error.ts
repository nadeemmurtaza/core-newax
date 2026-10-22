export type AuthenticationErrorCode =
  | 'AUTHENTICATION_ACCOUNT_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHENTICATION_FORBIDDEN'
  | 'AUTHENTICATION_INVALID_INPUT'
  | 'AUTHENTICATION_PASSWORD_ALREADY_CONFIGURED'
  | 'AUTHENTICATION_PASSWORD_POLICY_FAILED'
  | 'AUTHENTICATION_PLATFORM_CONTEXT_REQUIRED'
  | 'AUTHENTICATION_PROVIDER_UNAVAILABLE'
  | 'AUTHENTICATION_SESSION_NOT_FOUND'
  | 'AUTHENTICATION_UNVERIFIED_IDENTITY';

export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AuthenticationErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.details = details;
  }
}
