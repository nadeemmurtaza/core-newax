export type AuthenticationIdentityType = 'email' | 'username' | 'phone';
export type LoginFingerprintIdentityType = AuthenticationIdentityType | 'external';
export type AuthenticationAccountStatus =
  'invited' | 'active' | 'suspended' | 'disabled' | 'archived';
export type CredentialStatus = 'active' | 'disabled' | 'revoked' | 'expired';
export type SessionStatus = 'active' | 'revoked' | 'expired';
export type AuthenticationAttemptOutcome =
  | 'succeeded'
  | 'failed_unknown_identity'
  | 'failed_unverified_identity'
  | 'failed_missing_credential'
  | 'failed_invalid_secret'
  | 'blocked_account_status'
  | 'blocked_account_lock';

export interface AuthenticationAccountRecord {
  readonly userId: string;
  readonly personId: string;
  readonly status: AuthenticationAccountStatus;
  readonly lockedUntil: Date | null;
}

export interface AuthenticationIdentityRecord {
  readonly identityId: string;
  readonly identityType: AuthenticationIdentityType;
  readonly isVerified: boolean;
  readonly account: AuthenticationAccountRecord;
}

export interface PasswordCredentialRecord {
  readonly id: string;
  readonly userId: string;
  readonly secretHash: string;
  readonly status: CredentialStatus;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuthenticationSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: SessionStatus;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface AuthenticationRequestMetadata {
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface PasswordLoginInput extends AuthenticationRequestMetadata {
  readonly identityType: AuthenticationIdentityType;
  readonly identityValue: string;
  readonly password: string;
}

export interface PasswordEnrollmentInput {
  readonly identityType: AuthenticationIdentityType;
  readonly identityValue: string;
  readonly password: string;
}

export interface PasswordChangeInput {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface PasswordLoginResult {
  readonly userId: string;
  readonly personId: string;
  readonly sessionToken: string;
  readonly session: AuthenticationSessionRecord;
}

export interface ValidatedSession {
  readonly userId: string;
  readonly personId: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
}

export interface AuthenticationAdminContext {
  readonly actorUserId: string;
  readonly organizationId: string | null;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface AuthenticationSessionListQuery {
  readonly status?: SessionStatus;
  readonly limit?: number;
  readonly afterId?: string;
}

export interface AuthenticationSessionPage {
  readonly items: readonly AuthenticationSessionRecord[];
  readonly nextCursor: string | null;
}

export interface AuthenticationPolicy {
  readonly passwordMinimumLength: number;
  readonly passwordMaximumLength: number;
  readonly sessionTtlMinutes: number;
  readonly failedAttemptWindowMinutes: number;
  readonly maximumFailedAttempts: number;
  readonly accountLockMinutes: number;
  readonly sessionTouchIntervalMinutes: number;
}

export interface CreatePasswordCredentialInput {
  readonly userId: string;
  readonly secretHash: string;
  readonly occurredAt: Date;
}

export interface CreateAuthenticationSessionInput {
  readonly userId: string;
  readonly sessionTokenHash: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly occurredAt: Date;
}

export interface RecordAuthenticationAttemptInput {
  readonly userId: string | null;
  readonly identityFingerprint: string;
  readonly outcome: AuthenticationAttemptOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: Date;
}

export interface PasswordVerificationResult {
  readonly verified: boolean;
  readonly needsRehash: boolean;
}

export interface IssuedSessionToken {
  readonly token: string;
  readonly tokenHash: string;
}

export interface ExternalIdentityProfile {
  readonly subject: string;
  readonly email: string | null;
  readonly username: string | null;
}

export interface ExternalIdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly providerUsername: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateExternalIdentityInput {
  readonly userId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly providerUsername: string | null;
  readonly occurredAt: Date;
}

export interface OAuthLoginInput extends AuthenticationRequestMetadata {
  readonly provider: string;
  readonly profile: ExternalIdentityProfile;
}
