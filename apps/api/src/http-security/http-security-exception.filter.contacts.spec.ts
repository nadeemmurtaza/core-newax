import type { ArgumentsHost } from '@nestjs/common';
import { ContactsModuleError } from '@newax/contacts';
import { describe, expect, it } from 'vitest';

import { HttpSecurityExceptionFilter } from './http-security-exception.filter';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';
import type { SystemHttpSecurityClock } from './node-http-security.infrastructure';
import type { AuditHttpSecuritySink } from '../audit/http-security-audit.sink';

class RecordingAuditSink {
  readonly records: unknown[] = [];

  async record(record: unknown): Promise<void> {
    this.records.push(record);
  }
}

class FixedClock {
  now(): Date {
    return new Date('2026-07-12T12:00:00.000Z');
  }
}

class FakeResponse implements HttpSecurityResponseAdapter {
  statusCode = 200;
  body: unknown = null;
  readonly headers = new Map<string, string | readonly string[]>();

  setHeader(name: string, value: string | readonly string[]): void {
    this.headers.set(name, value);
  }

  status(code: number): HttpSecurityResponseAdapter {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
  }

  end(): void {}
}

function createHost(response: FakeResponse): ArgumentsHost {
  const request: HttpSecurityRequestAdapter = {
    method: 'POST',
    path: '/api/core/organizations/current/contacts',
    ip: '192.0.2.10',
    headers: { 'user-agent': 'contacts-http-test' },
    newaxRequestId: 'request-1',
    newaxRouteKey: 'CurrentOrganizationContactsController.create',
  };

  return {
    switchToHttp: () => ({
      getRequest: <T>(): T => request as T,
      getResponse: <T>(): T => response as T,
      getNext: <T>(): T => undefined as T,
    }),
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
  } as ArgumentsHost;
}

function createFilter(auditSink: RecordingAuditSink): HttpSecurityExceptionFilter {
  return new HttpSecurityExceptionFilter(
    auditSink as unknown as AuditHttpSecuritySink,
    new FixedClock() as unknown as SystemHttpSecurityClock,
  );
}

describe('HttpSecurityExceptionFilter contacts error mapping', () => {
  it.each([
    ['CONTACT_INVALID_INPUT', 400, 'INVALID_REQUEST'],
    ['CONTACT_FORBIDDEN', 403, 'FORBIDDEN'],
    ['CONTACT_CONFLICT', 409, 'CONFLICT'],
    ['CONTACT_ORGANIZATION_UNAVAILABLE', 409, 'CONFLICT'],
    ['CONTACT_INTEGRITY_FAILURE', 500, 'INTERNAL_ERROR'],
  ] as const)('maps %s to the stable public envelope', async (code, statusCode, publicCode) => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new ContactsModuleError(code, 'Sensitive contacts implementation detail.'),
      createHost(response),
    );

    expect(response.statusCode).toBe(statusCode);
    expect(response.body).toMatchObject({
      error: {
        code: publicCode,
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('Sensitive contacts implementation detail');
    expect(auditSink.records).toHaveLength(1);
  });
});
