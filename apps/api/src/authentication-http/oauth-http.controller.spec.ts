import { describe, expect, it, vi } from 'vitest';

import type {
  OAuthAuthenticationService,
  OAuthLoginInput,
  OAuthLoginResult,
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
const EXPIRES_AT = new Date('2026-07-26T08:00:00.000Z');

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

class FakeOAuthService {
  loginInput: OAuthLoginInput | null = null;
  private readonly state = 'random-state-value';
  private readonly authUrl = 'https://github.com/login/oauth/authorize?state=random-state-value';

  generateState(): string {
    return this.state;
  }

  buildAuthorizationUrl(_provider: string, _state: string): string {
    return this.authUrl;
  }

  async login(input: OAuthLoginInput): Promise<OAuthLoginResult> {
    this.loginInput = input;
    return {
      userId: USER_ID,
      personId: PERSON_ID,
      sessionToken: 'opaque-session-token',
      session: {
        id: SESSION_ID,
        userId: USER_ID,
        status: 'active',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        expiresAt: EXPIRES_AT,
        lastSeenAt: null,
        revokedAt: null,
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
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

function createController(oauthService: FakeOAuthService): OAuthHttpController {
  return new OAuthHttpController(
    oauthService as unknown as OAuthAuthenticationService,
    new SecureCookieTransport(),
    new SignedCsrfTokenService(new FakeCrypto()),
  );
}

describe('OAuthHttpController', () => {
  describe('GET /auth/oauth/github (initiate)', () => {
    it('returns the authorization redirect URL and sets a state cookie', () => {
      const oauthService = new FakeOAuthService();
      const controller = createController(oauthService);
      const response = new FakeResponse();

      const result = controller.initiateGitHub(response);

      expect(result.redirectUrl).toContain('github.com/login/oauth/authorize');

      const setCookie = response.headers.get('Set-Cookie') as string;
      expect(setCookie).toContain('__Host-newax_oauth_state=random-state-value');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('Path=/api/auth/oauth/github/callback');
    });
  });

  describe('GET /auth/oauth/github/callback (callback)', () => {
    it('completes the OAuth flow and issues a session', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-26T00:00:00.000Z').getTime());
      const oauthService = new FakeOAuthService();
      const controller = createController(oauthService);
      const response = new FakeResponse();

      const result = await controller.callbackGitHub(
        'github-auth-code',
        'random-state-value',
        request({
          headers: {
            'user-agent': 'vitest-browser',
            cookie: '__Host-newax_oauth_state=random-state-value',
          },
        }),
        response,
      );

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe(USER_ID);
      expect(result.personId).toBe(PERSON_ID);
      expect(result.session.id).toBe(SESSION_ID);
      expect(result.csrfToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
      expect(result).not.toHaveProperty('sessionToken');

      const cookies = response.headers.get('Set-Cookie') as string[];
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringContaining('__Host-newax_session=opaque-session-token'),
          expect.stringContaining('__Host-newax_csrf='),
        ]),
      );

      expect(oauthService.loginInput).toMatchObject({
        provider: 'github',
        code: 'github-auth-code',
        ipAddress: '192.0.2.10',
        userAgent: 'vitest-browser',
      });
    });

    it('rejects when state cookie is missing', async () => {
      const controller = createController(new FakeOAuthService());

      await expect(
        controller.callbackGitHub(
          'code',
          'some-state',
          request({ headers: {} }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
        message: 'The OAuth state parameter is invalid.',
      });
    });

    it('rejects when state does not match the cookie', async () => {
      const controller = createController(new FakeOAuthService());

      await expect(
        controller.callbackGitHub(
          'code',
          'tampered-state',
          request({
            headers: { cookie: '__Host-newax_oauth_state=random-state-value' },
          }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
        message: 'The OAuth state parameter is invalid.',
      });
    });

    it('rejects when the code query parameter is missing', async () => {
      const controller = createController(new FakeOAuthService());

      await expect(
        controller.callbackGitHub(
          '',
          'random-state-value',
          request({ headers: { cookie: '__Host-newax_oauth_state=random-state-value' } }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
        message: 'The OAuth code parameter is required.',
      });
    });

    it('rejects when the state query parameter is missing', async () => {
      const controller = createController(new FakeOAuthService());

      await expect(
        controller.callbackGitHub(
          'some-code',
          '',
          request({ headers: { cookie: '__Host-newax_oauth_state=random-state-value' } }),
          new FakeResponse(),
        ),
      ).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 400,
        message: 'The OAuth state parameter is required.',
      });
    });
  });
});
