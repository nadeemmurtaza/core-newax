import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  AuthenticationService,
  ExternalIdentityProfile,
  OAuthLoginInput,
  OAuthProvider,
  PasswordLoginResult,
} from '@newax/auth';
import {
  SecureCookieTransport,
  SignedCsrfTokenService,
  type HttpSecurityCrypto,
} from '@newax/http-security';

import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from '../http-security/http-security-request';
import { OAuthHttpController } from './oauth-http.controller';

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const PERSON_ID = '00000000-0000-4000-8000-000000000003';
const EXPIRES_AT = new Date('2026-07-12T01:00:00.000Z');

class FakeCrypto implements HttpSecurityCrypto {
  issueRandomValue(_bytes: number): string {
    return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  }

  sign(_domain: string, _value: string): string {
    return 'a'.repeat(64);
  }

  equals(left: string, right: string): boolean {
    return left === right;
  }
}

class FakeGitHubProvider implements OAuthProvider {
  readonly name = 'github';
  capturedCode: string | null = null;
  capturedState: string | null = null;

  buildAuthorizationUrl(state: string): string {
    this.capturedState = state;
    return `https://github.com/login/oauth/authorize?state=${state}&client_id=test-id`;
  }

  async exchangeCode(code: string): Promise<string> {
    this.capturedCode = code;
    return 'fixture-not-a-real-token-access';
  }

  async fetchProfile(_accessToken: string): Promise<ExternalIdentityProfile> {
    return {
      subject: '12345',
      email: 'octocat@github.com',
      username: 'octocat',
    };
  }
}

class FakeAuthService {
  oauthLoginInput: OAuthLoginInput | null = null;

  async loginWithExternalIdentity(input: OAuthLoginInput): Promise<PasswordLoginResult> {
    this.oauthLoginInput = input;
    return {
      userId: USER_ID,
      personId: PERSON_ID,
      sessionToken: 'opaque-session-token',
      session: {
        id: SESSION_ID,
        userId: USER_ID,
        status: 'active',
        ipAddress: null,
        userAgent: null,
        expiresAt: EXPIRES_AT,
        lastSeenAt: null,
        revokedAt: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    };
  }
}

class FakeResponse implements HttpSecurityResponseAdapter {
  statusCode = 200;
  readonly headers = new Map<string, string | readonly string[]>();

  setHeader(name: string, value: string | readonly string[]): void {
    this.headers.set(name, value);
  }

  status(code: number): HttpSecurityResponseAdapter {
    this.statusCode = code;
    return this;
  }

  json(_body: unknown): void {}

  end(): void {}
}

function request(overrides: Partial<HttpSecurityRequestAdapter> = {}): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    ip: '192.0.2.10',
    headers: { 'user-agent': 'vitest-browser' },
    ...overrides,
  };
}

function createController(
  authService: FakeAuthService,
  provider: FakeGitHubProvider,
): OAuthHttpController {
  return new OAuthHttpController(
    authService as unknown as AuthenticationService,
    provider,
    new SecureCookieTransport(),
    new SignedCsrfTokenService(new FakeCrypto()),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OAuthHttpController', () => {
  describe('initiateGitHub', () => {
    it('returns a GitHub redirect URL and sets an OAuth state cookie', () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);
      const response = new FakeResponse();

      const result = controller.initiateGitHub(response);

      expect(result.redirectUrl).toContain('https://github.com/login/oauth/authorize');
      expect(result.redirectUrl).toContain('state=');

      const cookie = response.headers.get('Set-Cookie') as string;
      expect(cookie).toContain('__Host-newax_oauth_state=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
    });

    it('includes the state in both the redirect URL and the cookie', () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);
      const response = new FakeResponse();

      const result = controller.initiateGitHub(response);

      const cookie = response.headers.get('Set-Cookie') as string;
      const cookieState = (cookie.split(';')[0] ?? '').split('=')[1] ?? '';
      expect(cookieState).not.toBe('');

      expect(result.redirectUrl).toContain(`state=${cookieState}`);
    });
  });

  describe('callbackGitHub', () => {
    it('completes the OAuth flow and issues a session', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-12T00:00:00.000Z').getTime());
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);
      const response = new FakeResponse();

      const result = await controller.callbackGitHub(
        'github-code',
        'valid-state',
        request({
          headers: {
            'user-agent': 'vitest-browser',
            cookie: '__Host-newax_oauth_state=valid-state',
          },
        }),
        response,
      );

      expect(result).toEqual({ authenticated: true });
      expect(authService.oauthLoginInput).toMatchObject({
        provider: 'github',
        profile: {
          subject: '12345',
          email: 'octocat@github.com',
        },
      });

      const cookies = response.headers.get('Set-Cookie') as string[];
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringContaining('__Host-newax_session=opaque-session-token'),
          expect.stringContaining('__Host-newax_csrf='),
        ]),
      );
    });

    it('rejects callback when OAuth state cookie is missing', async () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);

      await expect(
        controller.callbackGitHub(
          'github-code',
          'some-state',
          request({ headers: {} }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
        statusCode: 401,
      });
    });

    it('rejects callback when state does not match the cookie', async () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);

      await expect(
        controller.callbackGitHub(
          'github-code',
          'tampered-state',
          request({
            headers: { cookie: '__Host-newax_oauth_state=original-state' },
          }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
        statusCode: 401,
      });
    });

    it('rejects callback with missing code', async () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);

      await expect(
        controller.callbackGitHub(
          undefined,
          'valid-state',
          request({ headers: { cookie: '__Host-newax_oauth_state=valid-state' } }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('rejects callback with missing state', async () => {
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);

      await expect(
        controller.callbackGitHub(
          'github-code',
          undefined,
          request({ headers: { cookie: '__Host-newax_oauth_state=valid-state' } }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
      });
    });

    it('clears the state cookie after successful callback', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-12T00:00:00.000Z').getTime());
      const authService = new FakeAuthService();
      const provider = new FakeGitHubProvider();
      const controller = createController(authService, provider);
      const response = new FakeResponse();

      await controller.callbackGitHub(
        'github-code',
        'valid-state',
        request({ headers: { cookie: '__Host-newax_oauth_state=valid-state' } }),
        response,
      );

      const cookies = response.headers.get('Set-Cookie') as string[];
      const stateCookie = cookies.find((c) => c.startsWith('__Host-newax_oauth_state='));
      expect(stateCookie).toContain('Max-Age=0');
    });
  });
});
