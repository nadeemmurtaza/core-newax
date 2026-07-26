import { Controller, Get, Header, Inject, Query, Req, Res } from '@nestjs/common';
import { OAuthAuthenticationService } from '@newax/auth';
import {
  HttpSecurityError,
  SecureCookieTransport,
  SignedCsrfTokenService,
} from '@newax/http-security';

import {
  AuthenticationSensitiveEndpoint,
  PublicEndpoint,
} from '../http-security/http-security.decorators';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from '../http-security/http-security-request';

const OAUTH_STATE_COOKIE = '__Host-newax_oauth_state';
const OAUTH_STATE_COOKIE_PATH = '/api/auth/oauth/github/callback';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const COOKIE_VALUE_PATTERN = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/u;

interface OAuthInitiateResponse {
  readonly redirectUrl: string;
}

interface OAuthCallbackResponse {
  readonly authenticated: true;
  readonly userId: string;
  readonly personId: string;
  readonly session: {
    readonly id: string;
    readonly expiresAt: string;
  };
  readonly csrfToken: string;
}

@Controller('auth/oauth')
export class OAuthHttpController {
  constructor(
    @Inject(OAuthAuthenticationService)
    private readonly oauthAuthentication: OAuthAuthenticationService,
    @Inject(SecureCookieTransport)
    private readonly cookieTransport: SecureCookieTransport,
    @Inject(SignedCsrfTokenService)
    private readonly csrfTokens: SignedCsrfTokenService,
  ) {}

  @Get('github')
  @Header('Cache-Control', 'no-store')
  @PublicEndpoint()
  @AuthenticationSensitiveEndpoint()
  initiateGitHub(
    @Res({ passthrough: true }) response: HttpSecurityResponseAdapter,
  ): OAuthInitiateResponse {
    const state = this.oauthAuthentication.generateState();
    const redirectUrl = this.oauthAuthentication.buildAuthorizationUrl('github', state);

    response.setHeader(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=${state}; Path=${OAUTH_STATE_COOKIE_PATH}; Max-Age=${String(OAUTH_STATE_MAX_AGE_SECONDS)}; HttpOnly; SameSite=Lax; Secure`,
    );

    return { redirectUrl };
  }

  @Get('github/callback')
  @Header('Cache-Control', 'no-store')
  @PublicEndpoint()
  @AuthenticationSensitiveEndpoint()
  async callbackGitHub(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() request: HttpSecurityRequestAdapter,
    @Res({ passthrough: true }) response: HttpSecurityResponseAdapter,
  ): Promise<OAuthCallbackResponse> {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The OAuth code parameter is required.',
        400,
      );
    }
    if (typeof state !== 'string' || state.trim().length === 0) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The OAuth state parameter is required.',
        400,
      );
    }

    const cookieHeader = this.singleHeader(request.headers.cookie, 8_192);
    const expectedState = this.parseStateCookie(cookieHeader);

    if (expectedState === null || expectedState !== state.trim()) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The OAuth state parameter is invalid.',
        400,
      );
    }

    response.setHeader(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=; Path=${OAUTH_STATE_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    );

    const ipAddress = request.ip?.slice(0, 64);
    const userAgent = this.optionalSingleHeader(request.headers['user-agent'], 1_024);

    const result = await this.oauthAuthentication.login({
      provider: 'github',
      code: code.trim(),
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
    });

    const maxAgeSeconds = this.cookieMaxAgeSeconds(result.session.expiresAt);
    const csrf = this.csrfTokens.issue(result.session.id);

    response.setHeader('Set-Cookie', [
      this.cookieTransport.sessionCookie(result.sessionToken, maxAgeSeconds),
      this.cookieTransport.csrfCookie(csrf.cookieValue, maxAgeSeconds),
    ]);

    return {
      authenticated: true,
      userId: result.userId,
      personId: result.personId,
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt.toISOString(),
      },
      csrfToken: csrf.token,
    };
  }

  private parseStateCookie(cookieHeader: string | null): string | null {
    if (cookieHeader === null || cookieHeader.length === 0) {
      return null;
    }

    for (const segment of cookieHeader.split(';')) {
      const separatorIndex = segment.indexOf('=');
      if (separatorIndex < 1) {
        continue;
      }
      const name = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (name === OAUTH_STATE_COOKIE && value.length > 0 && COOKIE_VALUE_PATTERN.test(value)) {
        return value;
      }
    }

    return null;
  }

  private cookieMaxAgeSeconds(expiresAt: Date): number {
    const remainingMilliseconds = expiresAt.getTime() - Date.now();
    if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The authenticated session expiry is invalid.',
        500,
      );
    }
    return Math.max(1, Math.floor(remainingMilliseconds / 1_000));
  }

  private singleHeader(
    value: string | readonly string[] | undefined,
    maximumLength: number,
  ): string | null {
    if (value === undefined) {
      return null;
    }
    if (typeof value !== 'string' || value.length > maximumLength) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'A security-relevant HTTP header is invalid.',
        400,
      );
    }
    return value;
  }

  private optionalSingleHeader(
    value: string | readonly string[] | undefined,
    maximumLength: number,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    return value.slice(0, maximumLength);
  }
}
