import { describe, expect, it } from 'vitest';

import type { AuthenticationRepository } from '../src/database/authentication-repository';
import type { OAuthRepository } from '../src/database/oauth-repository';
import type {
  AuthenticationEvent,
  AuthenticationEventPublisher,
} from '../src/events/authentication-event';
import type {
  AuthenticationClock,
  SessionTokenService,
} from '../src/security/authentication-security';
import type { AuthenticationUserDirectory } from '../src/services/authentication-user-directory';
import { OAuthAuthenticationService } from '../src/services/oauth-authentication.service';
import type {
  AuthenticationAccountRecord,
  AuthenticationPolicy,
  AuthenticationSessionRecord,
  CreateAuthenticationSessionInput,
  IssuedSessionToken,
} from '../src/types/authentication';
import type { ExternalIdentityRecord } from '../src/database/oauth-repository';
import type { ExternalIdentityProfile, OAuthProvider } from '../src/oauth/oauth-provider';

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

const USER_ID = '00000000-0000-4000-8000-000000000100';
const PERSON_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_ID = '00000000-0000-4000-8000-000000000400';

function makeAccount(overrides: Partial<AuthenticationAccountRecord> = {}): AuthenticationAccountRecord {
  return {
    userId: USER_ID,
    personId: PERSON_ID,
    status: 'active',
    lockedUntil: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<AuthenticationSessionRecord> = {}): AuthenticationSessionRecord {
  return {
    id: SESSION_ID,
    userId: USER_ID,
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

function makeExternalIdentity(overrides: Partial<ExternalIdentityRecord> = {}): ExternalIdentityRecord {
  return {
    id: '00000000-0000-4000-8000-000000000500',
    userId: USER_ID,
    provider: 'github',
    providerSubject: '12345',
    providerUsername: 'octocat',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeRepository implements Pick<AuthenticationRepository, 'createSession'> {
  readonly createdSessions: CreateAuthenticationSessionInput[] = [];

  async createSession(input: CreateAuthenticationSessionInput): Promise<AuthenticationSessionRecord> {
    this.createdSessions.push(input);
    return makeSession({
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: input.expiresAt,
    });
  }
}

class FakeOAuthRepository implements OAuthRepository {
  private readonly identities = new Map<string, ExternalIdentityRecord>();

  seed(identity: ExternalIdentityRecord): void {
    this.identities.set(`${identity.provider}:${identity.providerSubject}`, identity);
  }

  async findExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityRecord | null> {
    return this.identities.get(`${provider}:${providerSubject}`) ?? null;
  }

  async createExternalIdentity(): Promise<ExternalIdentityRecord> {
    throw new Error('createExternalIdentity not expected in these tests');
  }
}

class FakeUserDirectory implements Pick<AuthenticationUserDirectory, 'findAccountById' | 'recordSuccessfulLogin'> {
  private readonly accounts = new Map<string, AuthenticationAccountRecord>();
  readonly loginRecords: string[] = [];

  seed(account: AuthenticationAccountRecord): void {
    this.accounts.set(account.userId, account);
  }

  async findAccountById(userId: string): Promise<AuthenticationAccountRecord | null> {
    return this.accounts.get(userId) ?? null;
  }

  async recordSuccessfulLogin(userId: string, _occurredAt: Date): Promise<AuthenticationAccountRecord> {
    this.loginRecords.push(userId);
    return this.accounts.get(userId) ?? makeAccount({ userId });
  }
}

class FakeSessionTokenService implements SessionTokenService {
  hash(_token: string): string { return 'token-hash'; }
  issue(): IssuedSessionToken { return { token: 'issued-token', tokenHash: 'issued-token-hash' }; }
}

class FakeClock implements AuthenticationClock {
  now(): Date { return now; }
}

class FakeEventPublisher implements AuthenticationEventPublisher {
  readonly events: AuthenticationEvent[] = [];
  async publish(event: AuthenticationEvent): Promise<void> {
    this.events.push(event);
  }
}

class FakeOAuthProvider implements OAuthProvider {
  readonly providerName = 'github';
  private readonly profile: ExternalIdentityProfile;

  constructor(profile: ExternalIdentityProfile) {
    this.profile = profile;
  }

  buildAuthorizationUrl(state: string): URL {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('state', state);
    return url;
  }

  async exchangeCode(_code: string): Promise<{ access_token: string; token_type: string }> {
    return { access_token: 'fake-access-token', token_type: 'bearer' };
  }

  async fetchUserProfile(_accessToken: string): Promise<ExternalIdentityProfile> {
    return this.profile;
  }
}

function createService({
  oauthRepository = new FakeOAuthRepository(),
  userDirectory = new FakeUserDirectory(),
  repository = new FakeRepository(),
  eventPublisher = new FakeEventPublisher(),
  providers = new Map<string, OAuthProvider>(),
}: {
  oauthRepository?: FakeOAuthRepository;
  userDirectory?: FakeUserDirectory;
  repository?: FakeRepository;
  eventPublisher?: FakeEventPublisher;
  providers?: Map<string, OAuthProvider>;
} = {}): {
  service: OAuthAuthenticationService;
  oauthRepository: FakeOAuthRepository;
  userDirectory: FakeUserDirectory;
  repository: FakeRepository;
  eventPublisher: FakeEventPublisher;
} {
  const service = new OAuthAuthenticationService(
    repository as unknown as AuthenticationRepository,
    oauthRepository,
    userDirectory as unknown as AuthenticationUserDirectory,
    new FakeSessionTokenService(),
    new FakeClock(),
    eventPublisher,
    policy,
    providers,
  );
  return { service, oauthRepository, userDirectory, repository, eventPublisher };
}

describe('OAuthAuthenticationService', () => {
  describe('generateState', () => {
    it('generates a non-empty state token', () => {
      const { service } = createService();
      const state = service.generateState();
      expect(state).toBe('issued-token');
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('throws for an unconfigured provider', () => {
      const { service } = createService();
      expect(() => service.buildAuthorizationUrl('github', 'state')).toThrow(
        "OAuth provider 'github' is not configured.",
      );
    });

    it('delegates to the provider for a configured provider', () => {
      const provider = new FakeOAuthProvider({ subject: '1', email: null, name: null, username: null });
      const providers = new Map<string, OAuthProvider>([['github', provider]]);
      const { service } = createService({ providers });
      const url = service.buildAuthorizationUrl('github', 'my-state');
      expect(url).toContain('github.com/login/oauth/authorize');
      expect(url).toContain('state=my-state');
    });
  });

  describe('login', () => {
    it('successfully authenticates and returns a session', async () => {
      const profile: ExternalIdentityProfile = {
        subject: '12345',
        email: 'octocat@github.com',
        name: 'The Octocat',
        username: 'octocat',
      };
      const provider = new FakeOAuthProvider(profile);
      const providers = new Map<string, OAuthProvider>([['github', provider]]);

      const oauthRepository = new FakeOAuthRepository();
      oauthRepository.seed(makeExternalIdentity());

      const userDirectory = new FakeUserDirectory();
      userDirectory.seed(makeAccount());

      const eventPublisher = new FakeEventPublisher();

      const { service } = createService({ oauthRepository, userDirectory, eventPublisher, providers });

      const result = await service.login({ provider: 'github', code: 'auth-code' });

      expect(result.userId).toBe(USER_ID);
      expect(result.personId).toBe(PERSON_ID);
      expect(result.sessionToken).toBe('issued-token');
      expect(result.session.userId).toBe(USER_ID);

      expect(userDirectory.loginRecords).toContain(USER_ID);
      expect(eventPublisher.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'authentication.session_created' }),
          expect.objectContaining({ name: 'authentication.login_succeeded', userId: USER_ID }),
        ]),
      );
    });

    it('fails when no external identity is linked', async () => {
      const provider = new FakeOAuthProvider({ subject: 'unknown', email: null, name: null, username: null });
      const providers = new Map<string, OAuthProvider>([['github', provider]]);

      const { service } = createService({ providers });

      await expect(service.login({ provider: 'github', code: 'code' })).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('fails when the linked account is not active', async () => {
      const provider = new FakeOAuthProvider({ subject: '12345', email: null, name: null, username: null });
      const providers = new Map<string, OAuthProvider>([['github', provider]]);

      const oauthRepository = new FakeOAuthRepository();
      oauthRepository.seed(makeExternalIdentity());

      const userDirectory = new FakeUserDirectory();
      userDirectory.seed(makeAccount({ status: 'suspended' }));

      const { service } = createService({ oauthRepository, userDirectory, providers });

      await expect(service.login({ provider: 'github', code: 'code' })).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('fails when the provider is not configured', async () => {
      const { service } = createService();

      await expect(service.login({ provider: 'github', code: 'code' })).rejects.toMatchObject({
        code: 'AUTHENTICATION_INVALID_INPUT',
      });
    });

    it('includes ip address and user agent in the session', async () => {
      const provider = new FakeOAuthProvider({ subject: '12345', email: null, name: null, username: null });
      const providers = new Map<string, OAuthProvider>([['github', provider]]);

      const oauthRepository = new FakeOAuthRepository();
      oauthRepository.seed(makeExternalIdentity());

      const userDirectory = new FakeUserDirectory();
      userDirectory.seed(makeAccount());

      const repository = new FakeRepository();

      const { service } = createService({ oauthRepository, userDirectory, repository, providers });

      await service.login({
        provider: 'github',
        code: 'code',
        ipAddress: '192.0.2.10',
        userAgent: 'test-browser/1.0',
      });

      expect(repository.createdSessions[0]).toMatchObject({
        ipAddress: '192.0.2.10',
        userAgent: 'test-browser/1.0',
      });
    });
  });
});
