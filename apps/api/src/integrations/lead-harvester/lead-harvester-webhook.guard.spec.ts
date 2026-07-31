import { createHmac } from 'node:crypto';

import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { HttpSecurityError } from '@newax/http-security';
import { describe, expect, it } from 'vitest';

import type { ApplicationEnvironment } from '../../config/environment';
import { LeadHarvesterWebhookGuard } from './lead-harvester-webhook.guard';

const SECRET = 'lead-harvester-webhook-secret-with-more-than-32-characters';

function configService(secret: string | undefined): ConfigService<ApplicationEnvironment, true> {
  return {
    get: () => secret,
  } as unknown as ConfigService<ApplicationEnvironment, true>;
}

function sign(timestamp: string, body: string, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
}

function executionContext(request: {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>(): T => request as unknown as T,
      getResponse: <T>(): T => undefined as T,
      getNext: <T>(): T => undefined as T,
    }),
  } as unknown as ExecutionContext;
}

describe('LeadHarvesterWebhookGuard', () => {
  it('accepts a correctly signed request within the replay window', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const body = '{"eventId":"11111111-1111-1111-1111-111111111111"}';
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': timestamp,
        'x-lead-harvester-signature': sign(timestamp, body),
      },
      rawBody: Buffer.from(body),
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with an invalid signature', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const body = '{"eventId":"11111111-1111-1111-1111-111111111111"}';
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': timestamp,
        'x-lead-harvester-signature': 'a'.repeat(64),
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });

  it('rejects a request signed with the wrong secret', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const body = '{"eventId":"11111111-1111-1111-1111-111111111111"}';
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': timestamp,
        'x-lead-harvester-signature': sign(
          timestamp,
          body,
          'a-completely-different-secret-32chars',
        ),
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });

  it('rejects a stale timestamp outside the replay window', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const body = '{"eventId":"11111111-1111-1111-1111-111111111111"}';
    const staleTimestamp = String(Math.floor(Date.now() / 1_000) - 600);
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': staleTimestamp,
        'x-lead-harvester-signature': sign(staleTimestamp, body),
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });

  it('rejects when required headers are missing', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const context = executionContext({ headers: {}, rawBody: Buffer.from('{}') });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });

  it('rejects when the raw body was not captured', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(SECRET));
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': timestamp,
        'x-lead-harvester-signature': sign(timestamp, '{}'),
      },
    });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });

  it('fails closed when the integration secret is not configured', () => {
    const guard = new LeadHarvesterWebhookGuard(configService(undefined));
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const context = executionContext({
      headers: {
        'x-lead-harvester-timestamp': timestamp,
        'x-lead-harvester-signature': sign(timestamp, '{}'),
      },
      rawBody: Buffer.from('{}'),
    });

    expect(() => guard.canActivate(context)).toThrow(HttpSecurityError);
  });
});
