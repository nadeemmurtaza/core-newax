import type { ArgumentsHost } from '@nestjs/common';
import { AddressModuleError } from '@newax/addresses';
import { ObjectModuleError } from '@newax/objects';
import { PeopleModuleError } from '@newax/people';
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
    method: 'GET',
    path: '/api/core/people/current',
    ip: '192.0.2.10',
    headers: { 'user-agent': 'current-person-test' },
    newaxRequestId: 'request-1',
    newaxRouteKey: 'CurrentPersonController.get',
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

describe('HttpSecurityExceptionFilter current-person error mapping', () => {
  it('conceals an unavailable current person through the stable not-found envelope', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new PeopleModuleError('PERSON_NOT_FOUND', 'The current person profile is unavailable.'),
      createHost(response),
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('current person profile');
    expect(auditSink.records).toHaveLength(1);
  });

  it('maps person integrity failures to a generic internal-error envelope', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new PeopleModuleError(
        'PERSON_INTEGRITY_FAILURE',
        'The repository returned a record outside the trusted person boundary.',
      ),
      createHost(response),
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('repository');
    expect(JSON.stringify(response.body)).not.toContain('trusted person boundary');
    expect(auditSink.records).toHaveLength(1);
  });

  it('maps address conflicts without exposing physical address details', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new AddressModuleError('ADDRESS_CONFLICT', 'The office address already exists at Street 1.'),
      createHost(response),
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'The request conflicts with the current resource state.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('Street 1');
    expect(auditSink.records).toHaveLength(1);
  });

  it('maps invalid address cursors to a generic invalid-request envelope', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new AddressModuleError(
        'ADDRESS_CURSOR_INVALID',
        'The address cursor belongs to another organization.',
      ),
      createHost(response),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request is invalid.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('another organization');
    expect(auditSink.records).toHaveLength(1);
  });

  it('maps invalid object cursors to a generic invalid-request envelope', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new ObjectModuleError(
        'OBJECT_CURSOR_INVALID',
        'The object cursor belongs to another organization.',
      ),
      createHost(response),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request is invalid.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('another organization');
    expect(auditSink.records).toHaveLength(1);
  });

  it('maps unavailable object relationships to a generic conflict envelope', async () => {
    const auditSink = new RecordingAuditSink();
    const response = new FakeResponse();

    await createFilter(auditSink).catch(
      new ObjectModuleError(
        'OBJECT_PARENT_UNAVAILABLE',
        'The parent object is unavailable in the current tenant.',
      ),
      createHost(response),
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'The request conflicts with the current resource state.',
        requestId: 'request-1',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('parent object');
    expect(JSON.stringify(response.body)).not.toContain('current tenant');
    expect(auditSink.records).toHaveLength(1);
  });
});
