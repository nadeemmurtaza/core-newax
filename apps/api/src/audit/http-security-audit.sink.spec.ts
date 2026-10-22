import { describe, expect, it } from 'vitest';

import type { TrustedAuditEntryInput } from '@newax/audit';
import type { HttpAuditRecord } from '@newax/http-security';

import { AuditHttpSecuritySink } from './http-security-audit.sink';

class RecordingAuditService {
  input: TrustedAuditEntryInput | null = null;

  async recordTrustedEntry(input: TrustedAuditEntryInput): Promise<void> {
    this.input = input;
  }
}

describe('AuditHttpSecuritySink', () => {
  it('maps the independent HTTP Security port into the trusted Audit boundary', async () => {
    const audit = new RecordingAuditService();
    const sink = new AuditHttpSecuritySink(audit as never);
    const occurredAt = new Date('2026-07-14T11:00:00.000Z');
    const record: HttpAuditRecord = {
      requestId: 'request-123',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      action: 'http.request.completed',
      outcome: 'allowed',
      routeKey: 'ObjectsController.list',
      method: 'POST',
      statusCode: 201,
      ipAddress: '192.0.2.10',
      userAgent: 'NEWAX Test',
      metadata: {
        contextScope: 'organization',
        requiredPermissions: ['objects.view'],
      },
      occurredAt,
    };

    await sink.record(record);

    expect(audit.input).toEqual({
      organizationId: record.organizationId,
      actorUserId: record.actorUserId,
      moduleCode: 'http-security',
      action: record.action,
      entityType: 'http_route',
      entityId: record.routeKey,
      outcome: record.outcome,
      sensitivity: 'security',
      metadata: {
        contextScope: 'organization',
        requiredPermissions: ['objects.view'],
        method: 'POST',
        statusCode: 201,
      },
      requestId: record.requestId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      occurredAt,
    });
    expect(audit.input).not.toHaveProperty('tenantId');
  });
});
