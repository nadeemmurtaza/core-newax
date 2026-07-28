import { describe, expect, it } from 'vitest';

import type { AuthenticationRepository } from '../src/database/authentication-repository';
import type {
  AuthenticationEvent,
  AuthenticationEventPublisher,
} from '../src/events/authentication-event';
import type {
  AuthenticationClock,
  LoginFingerprintService,
  PasswordHasher,
  SessionTokenService,
} from '../src/security/authentication-security';
import type { PasswordBlocklist } from '../src/security/password-blocklist';
import type { AuthenticationUserDirectory } from '../src/services/authentication-user-directory';
import { AuthenticationService } from '../src/services/authentication.service';
import type {
  AuthenticationAccountRecord,
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

const now = new Date('2026-07-26T00:00:00.000Z');
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

function session(
  overrides: Partial<AuthenticationSessionRecord> = {},
): AuthenticationSessionRecord {
  return {
    id: '00000000-0000-4000-8000-000000000400',
    userId: '00000000-0000-4000-8000-000000000100',
    status: 'active',
    ipAddress: null,
    userAgent: null,
    expiresAt: new Date('2026-07-26T08:00:00.000Z'),
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function externalIdentity(overrides: Partial<ExternalIdentityRecord> = {}): ExternalIdentityRecord {
  return {
    id: '00000000-0000-4000-8000-000000000500',
    userId: '00000000-0000-4000-8000-000000000100',
    provider: 'github',
    providerSubject: '12345',
    providerUsername: 'octocat',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeRepository implements AuthenticationRepository {
  readonly sessions = new Map<string, AuthenticationSessionRecord>();
  readonly sessionHashes = new Map<string, string>();
  readonly externalIdentities = new Map<string, ExternalIdentityRecord>();
  upsertedIdentity: CreateExternalIdentityInput | null = null;

  async countRecentFailures(): Promise<number> {
    return 0;
  }

  async createPasswordCredential(): Promise<PasswordCredentialRecord | null> {
    return null;
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

  async upsertExternalIdentity(
    input: CreateExternalIdentityInput,
  ): Promise<ExternalIdentityRecord> {
    this.upsertedIdentity = input;
    const record = externalIdentity({
      userId: input.userId,
      provider: input.provider,
      providerSubject: input.providerSubject,
      providerUsername: input.providerUsername,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    });
    this.externalIdentities.set(`${input.provider}:${input.providerSubject}`, record);
    return record;
  }

  async findPasswordCredential(): Promise<PasswordCredentialRecord | null> {
    return null;
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
      items: [...this.sessions.values()].filter((s) => s.userId === userId),
      nextCursor: null,
    };
  }

  async markCredentialUsed(): Promise<void> {}

  async recordAttempt(): Promise<void> {}

  async replacePasswordCredential(): Promise<PasswordCredentialRecord> {
    throw new Error('not implemented');
  }

  async revokeAllSessions(): Promise<number> {
    return 0;
  }

  async revokeSessionById(): Promise<AuthenticationSessionRecord | null> {
    return null;
  }

  async revokeSessionByTokenHash(): Promise<AuthenticationSessionRecord | null> {
    return null;
  }

  async setSessionStatus(
    sessionId: string,
    status: SessionStatus,
    occurredAt: Date,
  ): Promise<AuthenticationSessionRecord | null> {
    const current = this.sessions.get(sessionId);
    if (current === undefined) return null;
    const updated = { ...current, status, revokedAt: status === 'active' ? null : occurredAt };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async touchSession(): Promise<AuthenticationSessionRecord | null> {
    return null;
  }
}

class FakeDirectory implements AuthenticationUserDirectory {
  readonly accounts = new Map<string, AuthenticationAccountRecord>();
  resolvedIdentity: AuthenticationIdentityRecord | null = null;

  async activateInvitedUser(userId: string): Promise<AuthenticationAccountRecord> {
    const current = this.accounts.get(userId);
    if (current === undefined) throw new Error('user not found');
    const activated = { ...current, status: 'active' as const };
    this.accounts.set(userId, activated);
    return activated;
  }

  async findAccountById(userId: string): Promise<AuthenticationAccountRecord | null> {
    return this.accounts.get(userId) ?? null;
  }

  async recordSuccessfulLogin(
    userId: string,
    _occurredAt: Date,
  ): Promise<AuthenticationAccountRecord> {
    const current = this.accounts.get(userId);
    if (current === undefined) throw new Error('user not found');
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
    if (current === undefined) throw new Error('user not found');
    const updated = { ...current, lockedUntil };
    this.accounts.set(userId, updated);
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
      verified: secretHash !== null && secretHash === `hash:${password}`,
      needsRehash: false,
    };
  }
}

class FakeBlocklist implements PasswordBlocklist {
  async contains(_password: string): Promise<boolean> {
    return false;
  }
}

class FakeSessionTokenService implements SessionTokenService {
  hash(token: string): string {
    return `token-hash:${token}`;
  }

  issue(): IssuedSessionToken {
    return { token: 'plain-session-token', tokenHash: 'token-hash:plain-session-token' };
  }
}

class FakeFingerprintService implements LoginFingerprintService {
  fingerprint(_identityType: AuthenticationIdentityType, identityValue: string): string {
    return `fingerprint:${identityValue}`;
  }
}

class FakeClock implements AuthenticationClock {
  now(): Date {
    return now;
  }
}

class FakeEventPublisher implements AuthenticationEventPublisher {
  readonly events: AuthenticationEvent[] = [];

  async publish(event: AuthenticationEvent): Promise<void> {
    this.events.push(event);
  }
}

function createService(): {
  service: AuthenticationService;
  repository: FakeRepository;
  directory: FakeDirectory;
  publisher: FakeEventPublisher;
} {
  const repository = new FakeRepository();
  const directory = new FakeDirectory();
  const publisher = new FakeEventPublisher();
  const service = new AuthenticationService(
    repository,
    directory,
    new FakePasswordHasher(),
    new FakeBlocklist(),
    new FakeSessionTokenService(),
    new FakeFingerprintService(),
    new FakeClock(),
    publisher,
    policy,
  );
  return { service, repository, directory, publisher };
}

describe('AuthenticationService.loginWithExternalIdentity', () => {
  it('issues a session for a known external identity', async () => {
    const { service, repository, directory, publisher } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    repository.externalIdentities.set(
      'github:12345',
      externalIdentity({ userId: activeAccount.userId }),
    );

    const result = await service.loginWithExternalIdentity({
      provider: 'github',
      profile: {
        subject: '12345',
        email: 'octocat@github.com',
        name: 'The Octocat',
        username: 'octocat',
      },
    });

    expect(result.sessionToken).toBe('plain-session-token');
    expect(result.userId).toBe(activeAccount.userId);
    expect(result.personId).toBe(activeAccount.personId);
    expect(result.session.status).toBe('active');
    expect(publisher.events.map((e) => e.name)).toContain('authentication.login_succeeded');
  });

  it('links and issues a session when email matches a verified user identity', async () => {
    const { service, repository, directory, publisher } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    directory.resolvedIdentity = identity({ account: activeAccount });

    const result = await service.loginWithExternalIdentity({
      provider: 'github',
      profile: {
        subject: '99999',
        email: 'octocat@github.com',
        name: null,
        username: 'octocat',
      },
    });

    expect(result.sessionToken).toBe('plain-session-token');
    expect(repository.upsertedIdentity).toMatchObject({
      provider: 'github',
      providerSubject: '99999',
      userId: activeAccount.userId,
    });
    expect(publisher.events.map((e) => e.name)).toContain('authentication.login_succeeded');
  });

  it('fails when no external identity or matching email is found', async () => {
    const { service } = createService();

    await expect(
      service.loginWithExternalIdentity({
        provider: 'github',
        profile: { subject: '00000', email: null, name: null, username: null },
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('fails when the linked account is not active', async () => {
    const { service, repository, directory } = createService();
    const suspendedAccount = account({ status: 'suspended' });
    directory.accounts.set(suspendedAccount.userId, suspendedAccount);
    repository.externalIdentities.set(
      'github:12345',
      externalIdentity({ userId: suspendedAccount.userId }),
    );

    await expect(
      service.loginWithExternalIdentity({
        provider: 'github',
        profile: { subject: '12345', email: null, name: null, username: null },
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('fails when the linked account is locked', async () => {
    const { service, repository, directory } = createService();
    const lockedUntil = new Date(now.getTime() + 60_000);
    const lockedAccount = account({ lockedUntil });
    directory.accounts.set(lockedAccount.userId, lockedAccount);
    repository.externalIdentities.set(
      'github:12345',
      externalIdentity({ userId: lockedAccount.userId }),
    );

    await expect(
      service.loginWithExternalIdentity({
        provider: 'github',
        profile: { subject: '12345', email: null, name: null, username: null },
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('does not link when the email identity is not verified', async () => {
    const { service, directory } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    directory.resolvedIdentity = identity({
      account: activeAccount,
      isVerified: false,
    });

    await expect(
      service.loginWithExternalIdentity({
        provider: 'github',
        profile: {
          subject: '99999',
          email: 'unverified@github.com',
          name: null,
          username: null,
        },
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('publishes login_succeeded event with IP address', async () => {
    const { service, repository, directory, publisher } = createService();
    const activeAccount = account();
    directory.accounts.set(activeAccount.userId, activeAccount);
    repository.externalIdentities.set(
      'github:12345',
      externalIdentity({ userId: activeAccount.userId }),
    );

    await service.loginWithExternalIdentity({
      provider: 'github',
      profile: { subject: '12345', email: null, name: null, username: null },
      ipAddress: '192.0.2.1',
    });

    const loginEvent = publisher.events.find((e) => e.name === 'authentication.login_succeeded');
    expect(loginEvent).toMatchObject({ ipAddress: '192.0.2.1' });
  });
});
