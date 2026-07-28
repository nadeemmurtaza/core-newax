import { describe, expect, it } from 'vitest';

import type { AuthenticationRepository } from '../src/database/authentication-repository';
import type {
  AuthenticationEvent,
  AuthenticationEventPublisher,
} from '../src/events/authentication-event';
import { AUTHENTICATION_PERMISSIONS } from '../src/permissions/authentication-permissions';
import type {
  AuthenticationClock,
  LoginFingerprintService,
  PasswordHasher,
  SessionTokenService,
} from '../src/security/authentication-security';
import type { AuthenticationUserDirectory } from '../src/services/authentication-user-directory';
import { AuthenticationService } from '../src/services/authentication.service';
import type {
  AuthenticationAccountRecord,
  AuthenticationAdminContext,
  AuthenticationIdentityRecord,
  AuthenticationIdentityType,
  AuthenticationPolicy,
  AuthenticationSessionListQuery,
  AuthenticationSessionPage,
  AuthenticationSessionRecord,
  CreateAuthenticationSessionInput,
  CreateExternalIdentityInput,
  CreatePasswordCredentialInput,
  ExternalIdentityRecord,
  IssuedSessionToken,
  PasswordCredentialRecord,
  PasswordVerificationResult,
  RecordAuthenticationAttemptInput,
  SessionStatus,
} from '../src/types/authentication';

const now = new Date('2026-07-11T00:00:00.000Z');
const policy: AuthenticationPolicy = {
  passwordMinimumLength: 15,
  passwordMaximumLength: 128,
  sessionTtlMinutes: 480,
  failedAttemptWindowMinutes: 15,
  maximumFailedAttempts: 3,
  accountLockMinutes: 15,
  sessionTouchIntervalMinutes: 5,
};

function account(
  overrides: Partial<AuthenticationAccountRecord> = {},
): AuthenticationAccountRecord {
  return {
    userId: '00000000-0000-4000-8000-000000000100',
    personId: '00000000-0000-4000-8000-000000000001',
    status: 'active',
    lockedUntil: null,
    ...overrides,
  };
}

function identity(
  overrides: Partial<AuthenticationIdentityRecord> = {},
): AuthenticationIdentityRecord {
  return {
    identityId: '00000000-0000-4000-8000-000000000200',
    identityType: 'email',
    isVerified: true,
    account: account(),
    ...overrides,
  };
}

function credential(overrides: Partial<PasswordCredentialRecord> = {}): PasswordCredentialRecord {
  return {
    id: '00000000-0000-4000-8000-000000000300',
    userId: '00000000-0000-4000-8000-000000000100',
    secretHash: 'hash:Correct-password-1!',
    status: 'active',
    expiresAt: null,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function session(
  overrides: Partial<AuthenticationSessionRecord> = {},
): AuthenticationSessionRecord {
  return {
    id: '00000000-0000-4000-8000-000000000400',
    userId: '00000000-0000-4000-8000-000000000100',
    status: 'active',
    ipAddress: null,
    userAgent: null,
    expiresAt: new Date('2026-07-11T08:00:00.000Z'),
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
    ...overrides,
  };
}

class FakeRepository implements AuthenticationRepository {
  readonly credentials = new Map<string, PasswordCredentialRecord>();
  readonly sessions = new Map<string, AuthenticationSessionRecord>();
  readonly sessionHashes = new Map<string, string>();
  readonly externalIdentities = new Map<string, ExternalIdentityRecord>();
  readonly attempts: RecordAuthenticationAttemptInput[] = [];
  revokedSessionCount = 0;

  async countRecentFailures(
    userId: string | null,
    identityFingerprint: string,
    since: Date,
  ): Promise<number> {
    return this.attempts.filter(
      (attempt) =>
        attempt.userId === userId &&
        attempt.identityFingerprint === identityFingerprint &&
        attempt.outcome === 'failed_invalid_secret' &&
        attempt.occurredAt >= since,
    ).length;
  }

  async createPasswordCredential(
    input: CreatePasswordCredentialInput,
  ): Promise<PasswordCredentialRecord | null> {
    if (this.credentials.has(input.userId)) {
      return null;
    }
    const created = credential({
      userId: input.userId,
      secretHash: input.secretHash,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    });
    this.credentials.set(input.userId, created);
    return created;
  }

  async createSession(
    input: CreateAuthenticationSessionInput,
  ): Promise<AuthenticationSessionRecord> {
    const created = session({
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: input.expiresAt,
      createdAt: input.occurredAt,
      lastSeenAt: input.occurredAt,
    });
    this.sessions.set(created.id, created);
    this.sessionHashes.set(input.sessionTokenHash, created.id);
    return created;
  }

  async findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null> {
    for (const record of this.externalIdentities.values()) {
      if (record.provider === provider && record.providerSubject === providerSubject) {
        return record;
      }
    }
    return null;
  }

  async findPasswordCredential(userId: string): Promise<PasswordCredentialRecord | null> {
    return this.credentials.get(userId) ?? null;
  }

  async findSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<AuthenticationSessionRecord | null> {
    const sessionId = this.sessionHashes.get(sessionTokenHash);
    return sessionId === undefined ? null : (this.sessions.get(sessionId) ?? null);
  }

  async listSessions(
    userId: string,
    _query: AuthenticationSessionListQuery,
  ): Promise<AuthenticationSessionPage> {
    return {
      items: [...this.sessions.values()].filter((current) => current.userId === userId),
      nextCursor: null,
    };
  }

  async markCredentialUsed(credentialId: string, occurredAt: Date): Promise<void> {
    for (const [userId, current] of this.credentials) {
      if (current.id === credentialId) {
        this.credentials.set(userId, { ...current, lastUsedAt: occurredAt });
      }
    }
  }

  async recordAttempt(input: RecordAuthenticationAttemptInput): Promise<void> {
    this.attempts.push(input);
  }

  async replacePasswordCredential(
    userId: string,
    secretHash: string,
    occurredAt: Date,
  ): Promise<PasswordCredentialRecord> {
    const replaced = credential({
      userId,
      secretHash,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    this.credentials.set(userId, replaced);
    return replaced;
  }

  async revokeAllSessions(
    userId: string,
    occurredAt: Date,
    exceptSessionId?: string,
  ): Promise<number> {
    let count = 0;
    for (const [sessionId, current] of this.sessions) {
      if (
        current.userId === userId &&
        current.status === 'active' &&
        sessionId !== exceptSessionId
      ) {
        this.sessions.set(sessionId, {
          ...current,
          status: 'revoked',
          revokedAt: occurredAt,
        });
        count += 1;
      }
    }
    this.revokedSessionCount += count;
    return count;
  }

  async revokeSessionById(
    userId: string,
    sessionId: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const current = this.sessions.get(sessionId);
    if (current === undefined || current.userId !== userId) {
      return null;
    }
    const revoked = {
      ...current,
      status: 'revoked' as const,
      revokedAt: occurredAt,
    };
    this.sessions.set(sessionId, revoked);
    return revoked;
  }

  async revokeSessionByTokenHash(
    sessionTokenHash: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const sessionId = this.sessionHashes.get(sessionTokenHash);
    if (sessionId === undefined) {
      return null;
    }
    const current = this.sessions.get(sessionId);
    if (current === undefined) {
      return null;
    }
    return this.revokeSessionById(current.userId, current.id, occurredAt);
  }

  async setSessionStatus(
    sessionId: string,
    status: SessionStatus,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const current = this.sessions.get(sessionId);
    if (current === undefined) {
      return null;
    }
    const updated = {
      ...current,
      status,
      revokedAt: status === 'active' ? null : occurredAt,
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async touchSession(
    sessionId: string,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const current = this.sessions.get(sessionId);
    if (current === undefined) {
      return null;
    }
    const updated = { ...current, lastSeenAt: occurredAt };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async upsertExternalIdentity(
    input: CreateExternalIdentityInput,
  ): Promise<ExternalIdentityRecord> {
    const key = `${input.provider}:${input.providerSubject}`;
    const existing = this.externalIdentities.get(key);
    const record: ExternalIdentityRecord = {
      id: existing?.id ?? `identity-${key}`,
      userId: input.userId,
      provider: input.provider,
      providerSubject: input.providerSubject,
      providerUsername: input.providerUsername,
      createdAt: existing?.createdAt ?? input.occurredAt,
      updatedAt: input.occurredAt,
    };
    this.externalIdentities.set(key, record);
    return record;
  }
}

class FakeUserDirectory implements AuthenticationUserDirectory {
  readonly accounts = new Map<string, AuthenticationAccountRecord>();
  resolvedIdentity: AuthenticationIdentityRecord | null = null;

  async activateInvitedUser(userId: string): Promise<AuthenticationAccountRecord> {
    const current = this.accounts.get(userId);
    if (current === undefined) {
      throw new Error('Missing fake account.');
    }
    const updated = { ...current, status: 'active' as const };
    this.accounts.set(userId, updated);
    return updated;
  }

  async findAccountById(userId: string): Promise<AuthenticationAccountRecord | null> {
    return this.accounts.get(userId) ?? null;
  }

  async recordSuccessfulLogin(
    userId: string,
    _occurredAt: Date,
  ): Promise<AuthenticationAccountRecord> {
    const current = this.accounts.get(userId);
    if (current === undefined) {
      throw new Error('Missing fake account.');
    }
    return current;
  }

  async resolveIdentity(
    _identityType: AuthenticationIdentityType,
    _identityValue: string,
  ): Promise<AuthenticationIdentityRecord | null> {
    return this.resolvedIdentity;
  }

  async setLockedUntil(
    userId: string,
    lockedUntil: Date | null,
  ): Promise<AuthenticationAccountRecord> {
    const current = this.accounts.get(userId);
    if (current === undefined) {
      throw new Error('Missing fake account.');
    }
    const updated = { ...current, lockedUntil };
    this.accounts.set(userId, updated);
    if (this.resolvedIdentity?.account.userId === userId) {
      this.resolvedIdentity = {
        ...this.resolvedIdentity,
        account: updated,
      };
    }
    return updated;
  }
}

class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }

  async verifyOrBurn(
    password: string,
    secretHash: string | null,
  ): Promise<PasswordVerificationResult> {
    return {
      verified: secretHash === `hash:${password}`,
      needsRehash: false,
    };
  }
}

class FakePasswordBlocklist {
  readonly blocked = new Set<string>();

  async contains(password: string): Promise<boolean> {
    return this.blocked.has(password);
  }
}

class FakeSessionTokenService implements SessionTokenService {
  hash(token: string): string {
    return `token-hash:${token}`;
  }

  issue(): IssuedSessionToken {
    return {
      token: 'plain-session-token',
      tokenHash: 'token-hash:plain-session-token',
    };
  }
}

class FakeFingerprintService implements LoginFingerprintService {
  fingerprint(identityType: AuthenticationIdentityType, identityValue: string): string {
    return `fingerprint:${identityType}:${identityValue.toLowerCase()}`;
  }
}

class FixedClock implements AuthenticationClock {
  now(): Date {
    return new Date(now.getTime());
  }
}

class RecordingPublisher implements AuthenticationEventPublisher {
  readonly events: AuthenticationEvent[] = [];

  async publish(event: AuthenticationEvent): Promise<void> {
    this.events.push(event);
  }
}

function createService(
  repository = new FakeRepository(),
  directory = new FakeUserDirectory(),
  publisher = new RecordingPublisher(),
): {
  readonly service: AuthenticationService;
  readonly repository: FakeRepository;
  readonly directory: FakeUserDirectory;
  readonly publisher: RecordingPublisher;
} {
  return {
    service: new AuthenticationService(
      repository,
      directory,
      new FakePasswordHasher(),
      new FakePasswordBlocklist(),
      new FakeSessionTokenService(),
      new FakeFingerprintService(),
      new FixedClock(),
      publisher,
      policy,
    ),
    repository,
    directory,
    publisher,
  };
}

function platformContext(...permissions: string[]): AuthenticationAdminContext {
  return {
    actorUserId: '00000000-0000-4000-8000-000000000999',
    organizationId: null,
    permissionCodes: new Set(permissions),
  };
}

describe('AuthenticationService', () => {
  it('enrolls a password only for a verified invited identity', async () => {
    const { service, repository, directory, publisher } = createService();
    const invitedAccount = account({ status: 'invited' });
    directory.accounts.set(invitedAccount.userId, invitedAccount);
    directory.resolvedIdentity = identity({ account: invitedAccount });

    await service.enrollPassword({
      identityType: 'email',
      identityValue: 'person@example.com',
      password: 'Correct-password-1!',
    });

    expect(repository.credentials.get(invitedAccount.userId)?.status).toBe('active');
    expect(directory.accounts.get(invitedAccount.userId)?.status).toBe('active');
    expect(publisher.events[0]?.name).toBe('authentication.password_enrolled');
  });

  it('returns a session token after successful verified login', async () => {
    const { service, repository, directory, publisher } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    directory.resolvedIdentity = identity({ account: activeAccount });
    repository.credentials.set(activeAccount.userId, credential());

    const result = await service.login({
      identityType: 'email',
      identityValue: 'person@example.com',
      password: 'Correct-password-1!',
      ipAddress: '127.0.0.1',
    });

    expect(result.sessionToken).toBe('plain-session-token');
    expect(result.session.status).toBe('active');
    expect(repository.attempts.at(-1)?.outcome).toBe('succeeded');
    expect(publisher.events.map((event) => event.name)).toContain('authentication.login_succeeded');
  });

  it('locks a known account after the configured failed-attempt threshold', async () => {
    const { service, repository, directory, publisher } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    directory.resolvedIdentity = identity({ account: activeAccount });
    repository.credentials.set(activeAccount.userId, credential());
    const activeSession = session();
    repository.sessions.set(activeSession.id, activeSession);

    for (let attempt = 0; attempt < policy.maximumFailedAttempts; attempt += 1) {
      await expect(
        service.login({
          identityType: 'email',
          identityValue: 'person@example.com',
          password: 'Wrong-password-1!',
        }),
      ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
    }

    expect(directory.accounts.get(activeAccount.userId)?.lockedUntil).not.toBeNull();
    expect(repository.revokedSessionCount).toBe(1);
    expect(publisher.events.map((event) => event.name)).toContain('authentication.account_locked');
  });

  it('does not reveal whether an unknown identity exists', async () => {
    const { service, repository } = createService();

    await expect(
      service.login({
        identityType: 'email',
        identityValue: 'missing@example.com',
        password: 'Some-password-1!',
      }),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication could not be completed.',
    });
    expect(repository.attempts[0]?.outcome).toBe('failed_unknown_identity');
  });

  it('invalidates sessions when the account is no longer active', async () => {
    const { service, repository, directory } = createService();
    const suspendedAccount = account({ status: 'suspended' });
    directory.accounts.set(suspendedAccount.userId, suspendedAccount);
    const activeSession = session();
    repository.sessions.set(activeSession.id, activeSession);
    repository.sessionHashes.set('token-hash:plain-session-token', activeSession.id);

    const result = await service.validateSession('plain-session-token');

    expect(result).toBeNull();
    expect(repository.sessions.get(activeSession.id)?.status).toBe('revoked');
  });

  it('requires platform permission for account-wide session administration', async () => {
    const { service } = createService();

    await expect(
      service.listUserSessions(platformContext(), account().userId),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FORBIDDEN' });

    const page = await service.listUserSessions(
      platformContext(AUTHENTICATION_PERMISSIONS.sessionsView),
      account().userId,
    );
    expect(page.items).toEqual([]);
  });
});
