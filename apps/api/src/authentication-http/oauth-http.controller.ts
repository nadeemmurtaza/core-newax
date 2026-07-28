import { randomBytes } from 'node:crypto';

import { Controller, Get, Header, HttpCode, Inject, Query, Req, Res } from '@nestjs/common';
import { AuthenticationService, type OAuthProvider } from '@newax/auth';
import {
  HttpSecurityError,
  SecureCookieTransport,
  SignedCsrfTokenService,
} from '@newax/http-security';

import {
  AuditAsStateChanging,
  AuthenticationSensitiveEndpoint,
  PublicEndpoint,
} from '../http-security/http-security.decorators';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from '../http-security/http-security-request';

export const GITHUB_OAUTH_PROVIDER = Symbol('GITHUB_OAUTH_PROVIDER');

const OAUTH_STATE_COOKIE_NAME = '__Host-newax_oauth_state';
const OAUTH_STATE_MAX_AGE_SECONDS = 600;

interface OAuthInitiateResponse {
  readonly redirectUrl: string;
}

interface OAuthCallbackResponse {
  readonly authenticated: true;
}

@Controller('auth/oauth')
export class OAuthHttpController {
  constructor(
    @Inject(AuthenticationService)
    private readonly authentication: AuthenticationService,
    @Inject(GITHUB_OAUTH_PROVIDER)
    private readonly githubProvider: OAuthProvider,
    @Inject(SecureCookieTransport)
    private readonly cookieTransport: SecureCookieTransport,
    @Inject(SignedCsrfTokenService)
    private readonly csrfTokens: SignedCsrfTokenService,
  ) {}

  @Get('github')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @PublicEndpoint()
  @AuthenticationSensitiveEndpoint()
  initiateGitHub(
    @Res({ passthrough: true }) response: HttpSecurityResponseAdapter,
  ): OAuthInitiateResponse {
    const state = randomBytes(32).toString('hex');

    response.setHeader('Set-Cookie', this.serializeStateCookie(state, OAUTH_STATE_MAX_AGE_SECONDS));

    return { redirectUrl: this.githubProvider.buildAuthorizationUrl(state) };
  }

  @Get('github/callback')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @PublicEndpoint()
  @AuthenticationSensitiveEndpoint()
  @AuditAsStateChanging()
  async callbackGitHub(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() request: HttpSecurityRequestAdapter,
    @Res({ passthrough: true }) response: HttpSecurityResponseAdapter,
  ): Promise<OAuthCallbackResponse> {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', 'Missing OAuth code.', 400);
    }
    if (typeof state !== 'string' || state.trim().length === 0) {
      throw new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', 'Missing OAuth state.', 400);
    }

    const cookieHeader = this.singleHeader(request.headers.cookie, 8_192);
    const expectedState = this.parseStateCookie(cookieHeader);

    if (expectedState === null || expectedState !== state.trim()) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
        'Invalid or expired OAuth state.',
        401,
      );
    }

    const accessToken = await this.githubProvider.exchangeCode(code.trim());
    const profile = await this.githubProvider.fetchProfile(accessToken);

    const ipAddress = request.ip?.slice(0, 64);
    const userAgent = this.optionalSingleHeader(request.headers['user-agent'], 1_024);

    const result = await this.authentication.loginWithExternalIdentity({
      provider: this.githubProvider.name,
      profile,
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
    });

    const maxAgeSeconds = this.cookieMaxAgeSeconds(result.session.expiresAt);
    const csrf = this.csrfTokens.issue(result.session.id);

    response.setHeader('Set-Cookie', [
      this.cookieTransport.sessionCookie(result.sessionToken, maxAgeSeconds),
      this.cookieTransport.csrfCookie(csrf.cookieValue, maxAgeSeconds),
      this.clearStateCookie(),
    ]);
    request.newaxAuthenticatedUserId = result.userId;
    request.newaxAuthenticatedSessionId = result.session.id;

    return { authenticated: true };
  }

  private serializeStateCookie(state: string, maxAgeSeconds: number): string {
    return [
      `${OAUTH_STATE_COOKIE_NAME}=${state}`,
      'Path=/',
      `Max-Age=${String(maxAgeSeconds)}`,
      'Secure',
      'HttpOnly',
      'SameSite=Lax',
    ].join('; ');
  }

  private clearStateCookie(): string {
    return [
      `${OAUTH_STATE_COOKIE_NAME}=`,
      'Path=/',
      'Max-Age=0',
      'Secure',
      'HttpOnly',
      'SameSite=Lax',
    ].join('; ');
  }

  private parseStateCookie(cookieHeader: string | null): string | null {
    if (cookieHeader === null) {
      return null;
    }
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }
      const name = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      if (name === OAUTH_STATE_COOKIE_NAME && value.length > 0) {
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
