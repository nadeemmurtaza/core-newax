export type { AuthenticationRepository } from './database/authentication-repository';
export type {
  AuthenticationEvent,
  AuthenticationEventPublisher,
} from './events/authentication-event';
export { AuthenticationError, type AuthenticationErrorCode } from './errors/authentication-error';
export {
  AUTHENTICATION_PERMISSIONS,
  type AuthenticationPermission,
} from './permissions/authentication-permissions';
export {
  DEFAULT_AUTHENTICATION_POLICY,
  validateAuthenticationPolicy,
} from './policy/default-authentication-policy';
export type {
  AuthenticationClock,
  LoginFingerprintService,
  OAuthProvider,
  PasswordHasher,
  SessionTokenService,
} from './security/authentication-security';
export type { PasswordBlocklist } from './security/password-blocklist';
export type { AuthenticationUserDirectory } from './services/authentication-user-directory';
export { AuthenticationService } from './services/authentication.service';
export { PasswordPolicyValidator } from './services/password-policy-validator';
export type {
  AuthenticationAccountRecord,
  AuthenticationAccountStatus,
  AuthenticationAdminContext,
  AuthenticationAttemptOutcome,
  AuthenticationIdentityRecord,
  AuthenticationIdentityType,
  AuthenticationPolicy,
  AuthenticationRequestMetadata,
  AuthenticationSessionListQuery,
  AuthenticationSessionPage,
  AuthenticationSessionRecord,
  CreateAuthenticationSessionInput,
  CreateExternalIdentityInput,
  CreatePasswordCredentialInput,
  CredentialStatus,
  ExternalIdentityProfile,
  ExternalIdentityRecord,
  IssuedSessionToken,
  OAuthLoginInput,
  PasswordChangeInput,
  PasswordCredentialRecord,
  PasswordEnrollmentInput,
  PasswordLoginInput,
  PasswordLoginResult,
  PasswordVerificationResult,
  RecordAuthenticationAttemptInput,
  SessionStatus,
  ValidatedSession,
} from './types/authentication';
