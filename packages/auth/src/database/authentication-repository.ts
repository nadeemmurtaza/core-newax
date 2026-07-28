import type {
  AuthenticationSessionListQuery,
  AuthenticationSessionPage,
  AuthenticationSessionRecord,
  CreateAuthenticationSessionInput,
  CreateExternalIdentityInput,
  CreatePasswordCredentialInput,
  ExternalIdentityRecord,
  PasswordCredentialRecord,
  RecordAuthenticationAttemptInput,
  SessionStatus,
} from '../types/authentication';

export interface AuthenticationRepository {
  countRecentFailures(
    userId: string | null,
    identityFingerprint: string,
    since: Date,
  ): Promise<number>;
  createPasswordCredential(
    input: CreatePasswordCredentialInput,
  ): Promise<PasswordCredentialRecord | null>;
  createSession(input: CreateAuthenticationSessionInput): Promise<AuthenticationSessionRecord>;
  findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null>;
  findPasswordCredential(userId: string): Promise<PasswordCredentialRecord | null>;
  findSessionByTokenHash(sessionTokenHash: string): Promise<AuthenticationSessionRecord | null>;
  listSessions(
    userId: string,
    query: AuthenticationSessionListQuery,
  ): Promise<AuthenticationSessionPage>;
  markCredentialUsed(credentialId: string, occurredAt: Date): Promise<void>;
  recordAttempt(input: RecordAuthenticationAttemptInput): Promise<void>;
  replacePasswordCredential(
    userId: string,
    secretHash: string,
    occurredAt: Date,
  ): Promise<PasswordCredentialRecord>;
  revokeAllSessions(userId: string, occurredAt: Date, exceptSessionId?: string): Promise<number>;
  revokeSessionById(
    userId: string,
    sessionId: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null>;
  revokeSessionByTokenHash(
    sessionTokenHash: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null>;
  setSessionStatus(
    sessionId: string,
    status: SessionStatus,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null>;
  touchSession(sessionId: string, occurredAt: Date): Promise<AuthenticationSessionRecord | null>;
  upsertExternalIdentity(input: CreateExternalIdentityInput): Promise<ExternalIdentityRecord>;
}
