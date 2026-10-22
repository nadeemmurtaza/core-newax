import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SensitiveResponseRedactor,
  type HttpAuditRecord,
  type HttpSecurityAuditSink,
} from '@newax/http-security';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import type { AsyncLocalStorageTrustedRequestContextStore } from '../request-context/node-request-context.infrastructure';
import { AuditAsStateChanging } from './http-security.decorators';
import { HttpSecurityInterceptor } from './http-security.interceptor';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';
import type { SystemHttpSecurityClock } from './node-http-security.infrastructure';
import type { AuditHttpSecuritySink } from '../audit/http-security-audit.sink';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_ID = '00000000-0000-4000-8000-000000000002';

class RecordingAuditSink implements HttpSecurityAuditSink {
  readonly records: HttpAuditRecord[] = [];

  async record(record: HttpAuditRecord): Promise<void> {
    this.records.push(record);
  }
}

const response: HttpSecurityResponseAdapter = {
  statusCode: 200,
  setHeader: () => undefined,
  status: () => response,
  json: () => undefined,
  end: () => undefined,
};

function executionContext(
  request: HttpSecurityRequestAdapter,
  handler: (...args: readonly unknown[]) => unknown = () => undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>(): T => request as T,
      getResponse: <T>(): T => response as T,
      getNext: <T>(): T => undefined as T,
    }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('HttpSecurityInterceptor', () => {
  it('audits a successful public login without retaining session material', async () => {
    const auditSink = new RecordingAuditSink();
    const interceptor = new HttpSecurityInterceptor(
      {} as AsyncLocalStorageTrustedRequestContextStore,
      new SensitiveResponseRedactor(),
      auditSink as unknown as AuditHttpSecuritySink,
      { now: () => new Date('2026-07-12T00:00:00.000Z') } as SystemHttpSecurityClock,
      new Reflector(),
    );
    const request: HttpSecurityRequestAdapter = {
      method: 'POST',
      headers: {},
      newaxStateChanging: true,
      newaxAuthenticatedUserId: USER_ID,
      newaxAuthenticatedSessionId: SESSION_ID,
      newaxRequiredPermissions: [],
      newaxSecurityRequest: {
        method: 'POST',
        routeKey: 'AuthenticationHttpController.login',
        requestId: 'request-1',
        origin: 'https://app.newax.test',
        referer: null,
        fetchSite: 'same-origin',
        contentType: 'application/json',
        hasBody: true,
        ipAddress: '192.0.2.10',
        userAgent: 'vitest-browser',
      },
    };
    const next: CallHandler = {
      handle: () =>
        of({
          ok: true,
          sessionToken: 'must-not-leave-the-boundary',
          csrfToken: 'safe-double-submit-token',
        }),
    };

    const result = await lastValueFrom(interceptor.intercept(executionContext(request), next));

    expect(result).toEqual({
      ok: true,
      csrfToken: 'safe-double-submit-token',
    });
    expect(auditSink.records[0]).toMatchObject({
      actorUserId: USER_ID,
      organizationId: null,
      action: 'http.request.completed',
      outcome: 'allowed',
      metadata: {
        contextScope: 'public',
      },
    });
    expect(auditSink.records[0]?.metadata).not.toHaveProperty('authenticatedSessionId');
  });

  it('audits a successful GET endpoint marked @AuditAsStateChanging, such as an OAuth callback', async () => {
    const auditSink = new RecordingAuditSink();
    const interceptor = new HttpSecurityInterceptor(
      {} as AsyncLocalStorageTrustedRequestContextStore,
      new SensitiveResponseRedactor(),
      auditSink as unknown as AuditHttpSecuritySink,
      { now: () => new Date('2026-07-12T00:00:00.000Z') } as SystemHttpSecurityClock,
      new Reflector(),
    );
    const request: HttpSecurityRequestAdapter = {
      method: 'GET',
      headers: {},
      newaxStateChanging: false,
      newaxAuthenticatedUserId: USER_ID,
      newaxAuthenticatedSessionId: SESSION_ID,
      newaxRequiredPermissions: [],
      newaxSecurityRequest: {
        method: 'GET',
        routeKey: 'OAuthHttpController.callbackGitHub',
        requestId: 'request-1',
        origin: null,
        referer: null,
        fetchSite: null,
        contentType: null,
        hasBody: false,
        ipAddress: '192.0.2.10',
        userAgent: 'vitest-browser',
      },
    };
    const next: CallHandler = {
      handle: () => of({ authenticated: true }),
    };

    function callbackGitHub(): void {}
    AuditAsStateChanging()(callbackGitHub, 'callbackGitHub', { value: callbackGitHub });

    const result = await lastValueFrom(
      interceptor.intercept(executionContext(request, callbackGitHub), next),
    );

    expect(result).toEqual({ authenticated: true });
    expect(auditSink.records[0]).toMatchObject({
      actorUserId: USER_ID,
      action: 'http.request.completed',
      outcome: 'allowed',
      routeKey: 'OAuthHttpController.callbackGitHub',
    });
  });

  it('does not audit a successful GET endpoint that is neither state-changing nor marked @AuditAsStateChanging', async () => {
    const auditSink = new RecordingAuditSink();
    const interceptor = new HttpSecurityInterceptor(
      {} as AsyncLocalStorageTrustedRequestContextStore,
      new SensitiveResponseRedactor(),
      auditSink as unknown as AuditHttpSecuritySink,
      { now: () => new Date('2026-07-12T00:00:00.000Z') } as SystemHttpSecurityClock,
      new Reflector(),
    );
    const request: HttpSecurityRequestAdapter = {
      method: 'GET',
      headers: {},
      newaxStateChanging: false,
      newaxRequiredPermissions: [],
      newaxSecurityRequest: {
        method: 'GET',
        routeKey: 'CurrentPersonController.get',
        requestId: 'request-1',
        origin: null,
        referer: null,
        fetchSite: null,
        contentType: null,
        hasBody: false,
        ipAddress: '192.0.2.10',
        userAgent: 'vitest-browser',
      },
    };
    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await lastValueFrom(interceptor.intercept(executionContext(request), next));

    expect(auditSink.records).toHaveLength(0);
  });
});
