import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import {
  CookieHeaderParser,
  type HttpRateLimiter,
  type HttpSecurityPolicy,
  RequestOriginPolicy,
  SecureCookieTransport,
  type SignedCsrfTokenService,
} from '@newax/http-security';
import type { ContextAuthorizer, TrustedRequestContextService } from '@newax/request-context';
import { describe, expect, it } from 'vitest';

import {
  HTTP_AUTHENTICATION_SENSITIVE_KEY,
  HTTP_CONTEXT_MODE_KEY,
  HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY,
} from './http-security.decorators';
import { HttpSecurityGuard } from './http-security.guard';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';

const policy: HttpSecurityPolicy = {
  allowedOrigins: ['https://app.newax.test'],
  requireHttps: true,
  trustedProxyCidrs: ['10.0.0.0/8'],
  bodyLimitBytes: 1_048_576,
  rateLimitWindowMilliseconds: 60_000,
  rateLimitMaximumRequests: 120,
  authenticationRateLimitMaximumRequests: 10,
  hstsMaxAgeSeconds: 63_072_000,
  hstsIncludeSubDomains: false,
  hstsPreload: false,
};

class MetadataReflector {
  constructor(private readonly values: ReadonlyMap<string, unknown>) {}

  getAllAndOverride<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }
}

class RecordingRateLimiter {
  authenticationSensitive: boolean | null = null;

  async consume(
    _key: string,
    authenticationSensitive: boolean,
  ): Promise<{
    readonly allowed: true;
    readonly remaining: number;
    readonly retryAfterSeconds: number;
    readonly resetAt: Date;
  }> {
    this.authenticationSensitive = authenticationSensitive;
    return {
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 60,
      resetAt: new Date('2026-07-12T00:01:00.000Z'),
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

function request(): HttpSecurityRequestAdapter {
  return {
    method: 'POST',
    path: '/api/auth/login',
    ip: '192.0.2.10',
    secure: true,
    protocol: 'https',
    headers: {
      origin: 'https://app.newax.test',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    newaxRequestId: 'request-1',
    newaxHasBody: true,
  };
}

function executionContext(
  currentRequest: HttpSecurityRequestAdapter,
  response: HttpSecurityResponseAdapter,
): ExecutionContext {
  function login(): void {}
  class AuthenticationHttpController {}
  return {
    switchToHttp: () => ({
      getRequest: <T>(): T => currentRequest as T,
      getResponse: <T>(): T => response as T,
      getNext: <T>(): T => undefined as T,
    }),
    getClass: () => AuthenticationHttpController,
    getHandler: () => login,
    getArgs: <T extends unknown[]>(): T => [] as unknown as T,
    getArgByIndex: <T>(): T => undefined as T,
    switchToRpc: () => ({
      getData: <T>(): T => undefined as T,
      getContext: <T>(): T => undefined as T,
    }),
    switchToWs: () => ({
      getData: <T>(): T => undefined as T,
      getClient: <T>(): T => undefined as T,
      getPattern: (): string => '',
    }),
    getType: () => 'http',
  } as ExecutionContext;
}

function createGuard(
  metadata: ReadonlyMap<string, unknown>,
  rateLimiter: RecordingRateLimiter,
): HttpSecurityGuard {
  return new HttpSecurityGuard(
    new MetadataReflector(metadata) as unknown as Reflector,
    policy,
    new CookieHeaderParser(),
    new SecureCookieTransport(),
    new RequestOriginPolicy(policy.allowedOrigins),
    {} as SignedCsrfTokenService,
    rateLimiter as unknown as HttpRateLimiter,
    {} as TrustedRequestContextService,
    {} as ContextAuthorizer,
  );
}

describe('HttpSecurityGuard public authentication mutation policy', () => {
  it('allows only an explicitly marked authentication-sensitive public mutation', async () => {
    const rateLimiter = new RecordingRateLimiter();
    const guard = createGuard(
      new Map<string, unknown>([
        [HTTP_CONTEXT_MODE_KEY, 'public'],
        [HTTP_AUTHENTICATION_SENSITIVE_KEY, true],
        [HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY, true],
      ]),
      rateLimiter,
    );
    const currentRequest = request();

    await expect(
      guard.canActivate(executionContext(currentRequest, new FakeResponse())),
    ).resolves.toBe(true);
    expect(rateLimiter.authenticationSensitive).toBe(true);
    expect(currentRequest.newaxStateChanging).toBe(true);
  });

  it('rejects a public state-changing endpoint without the explicit marker', async () => {
    const guard = createGuard(
      new Map<string, unknown>([
        [HTTP_CONTEXT_MODE_KEY, 'public'],
        [HTTP_AUTHENTICATION_SENSITIVE_KEY, true],
      ]),
      new RecordingRateLimiter(),
    );

    await expect(
      guard.canActivate(executionContext(request(), new FakeResponse())),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_FORBIDDEN',
      statusCode: 403,
    });
  });

  it('fails closed when public mutation metadata is not authentication-sensitive', async () => {
    const guard = createGuard(
      new Map<string, unknown>([
        [HTTP_CONTEXT_MODE_KEY, 'public'],
        [HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY, true],
      ]),
      new RecordingRateLimiter(),
    );

    await expect(
      guard.canActivate(executionContext(request(), new FakeResponse())),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 500,
    });
  });

  it('allows a public, authentication-sensitive GET endpoint without the mutation marker', async () => {
    const rateLimiter = new RecordingRateLimiter();
    const guard = createGuard(
      new Map<string, unknown>([
        [HTTP_CONTEXT_MODE_KEY, 'public'],
        [HTTP_AUTHENTICATION_SENSITIVE_KEY, true],
      ]),
      rateLimiter,
    );
    const currentRequest = { ...request(), method: 'GET' };

    await expect(
      guard.canActivate(executionContext(currentRequest, new FakeResponse())),
    ).resolves.toBe(true);
    expect(rateLimiter.authenticationSensitive).toBe(true);
    expect(currentRequest.newaxStateChanging).toBe(false);
  });
});

describe('HttpSecurityGuard account endpoint authentication', () => {
  it('rejects an unauthenticated current-person request', async () => {
    const guard = createGuard(
      new Map<string, unknown>([[HTTP_CONTEXT_MODE_KEY, 'account']]),
      new RecordingRateLimiter(),
    );
    const currentRequest: HttpSecurityRequestAdapter = {
      ...request(),
      method: 'GET',
      path: '/api/core/people/current',
      headers: {
        origin: 'https://app.newax.test',
        'sec-fetch-site': 'same-origin',
      },
      newaxHasBody: false,
    };

    await expect(
      guard.canActivate(executionContext(currentRequest, new FakeResponse())),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
  });
});
