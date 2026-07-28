import { describe, expect, it } from 'vitest';

import type { AuditRepository } from '../src/database/audit-repository';
import { AUDIT_PERMISSIONS } from '../src/permissions/audit-permissions';
import { AuditService } from '../src/services/audit.service';
import type {
  AuditEntry,
  ListOrganizationAuditEntriesRecordInput,
  ListOrganizationAuditEntriesResult,
  OrganizationAuditRequestContext,
  RecordTrustedAuditEntryRecordInput,
  RecordTrustedAuditEntryResult,
  TrustedAuditEntryInput,
} from '../src/types/audit';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000003';
const AUDIT_ID = '00000000-0000-4000-8000-000000000004';
const FOREIGN_TENANT_ID = '00000000-0000-4000-8000-000000000005';
const FOREIGN_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000006';
const OCCURRED_AT = new Date('2026-07-14T08:00:00.000Z');

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: AUDIT_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_ID,
    moduleCode: 'http-security',
    action: 'http.request.completed',
    entityType: 'http_route',
    entityId: 'ObjectsController.list',
    outcome: 'allowed',
    sensitivity: 'security',
    requestId: 'request-123',
    createdAt: OCCURRED_AT,
    ...overrides,
  };
}

function trustedInput(overrides: Partial<TrustedAuditEntryInput> = {}): TrustedAuditEntryInput {
  return {
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_ID,
    moduleCode: 'http-security',
    action: 'http.request.completed',
    entityType: 'http_route',
    entityId: 'ObjectsController.list',
    outcome: 'allowed',
    sensitivity: 'security',
    metadata: { method: 'POST', statusCode: 201 },
    requestId: 'request-123',
    ipAddress: '192.0.2.10',
    userAgent: 'NEWAX Test',
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

function context(...permissions: string[]): OrganizationAuditRequestContext {
  return {
    actorUserId: ACTOR_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissions),
  };
}

class FakeAuditRepository implements AuditRepository {
  recordInput: RecordTrustedAuditEntryRecordInput | null = null;
  listInput: ListOrganizationAuditEntriesRecordInput | null = null;
  recordResult: RecordTrustedAuditEntryResult = {
    status: 'created',
    entry: entry(),
  };
  listResult: ListOrganizationAuditEntriesResult = {
    status: 'available',
    items: [entry()],
    nextCursor: null,
  };

  async recordTrustedEntry(
    input: RecordTrustedAuditEntryRecordInput,
  ): Promise<RecordTrustedAuditEntryResult> {
    this.recordInput = input;
    return this.recordResult;
  }

  async listOrganizationEntries(
    input: ListOrganizationAuditEntriesRecordInput,
  ): Promise<ListOrganizationAuditEntriesResult> {
    this.listInput = input;
    return this.listResult;
  }
}

describe('AuditService governance foundation', () => {
  it('normalizes a trusted entry and returns only the bounded summary', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    const result = await service.recordTrustedEntry(
      trustedInput({
        moduleCode: ' HTTP-SECURITY ',
        action: ' HTTP.REQUEST.COMPLETED ',
        entityType: ' HTTP_ROUTE ',
        entityId: '  ObjectsController.list  ',
        metadata: {
          contextScope: 'organization',
          detail: { requiredPermissions: ['objects.view'] },
        },
      }),
    );

    expect(repository.recordInput).toEqual({
      tenantId: null,
      organizationId: ORGANIZATION_ID,
      actorUserId: ACTOR_ID,
      moduleCode: 'http-security',
      action: 'http.request.completed',
      entityType: 'http_route',
      entityId: 'ObjectsController.list',
      outcome: 'allowed',
      sensitivity: 'security',
      metadata: {
        contextScope: 'organization',
        detail: { requiredPermissions: ['objects.view'] },
      },
      correlationId: null,
      requestId: 'request-123',
      ipAddress: '192.0.2.10',
      userAgent: 'NEWAX Test',
      occurredAt: OCCURRED_AT,
    });
    expect(result).toEqual(entry());
    expect(result.createdAt).not.toBe(OCCURRED_AT);
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('ipAddress');
    expect(result).not.toHaveProperty('userAgent');
    expect(result).not.toHaveProperty('previousValues');
    expect(result).not.toHaveProperty('newValues');
  });

  it('rejects sensitive, malformed, deeply nested, and oversized metadata', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    await expect(
      service.recordTrustedEntry(trustedInput({ metadata: { sessionToken: 'never-store-me' } })),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.recordTrustedEntry(trustedInput({ metadata: { apiKey: 'never-store-me' } })),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.recordTrustedEntry(
        trustedInput({ metadata: { authenticatedSessionId: 'never-store-me' } }),
      ),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.recordTrustedEntry(trustedInput({ metadata: { constructor: 'unsafe' } })),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.recordTrustedEntry(
        trustedInput({
          metadata: { one: { two: { three: { four: { five: true } } } } },
        }),
      ),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.recordTrustedEntry(trustedInput({ metadata: { message: '🙂'.repeat(300) } })),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    expect(repository.recordInput).toBeNull();
  });

  it('maps unavailable scope and actor outcomes without leaking persistence details', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    repository.recordResult = { status: 'scope_unavailable' };
    await expect(service.recordTrustedEntry(trustedInput())).rejects.toMatchObject({
      code: 'AUDIT_SCOPE_UNAVAILABLE',
    });

    repository.recordResult = { status: 'actor_unavailable' };
    await expect(service.recordTrustedEntry(trustedInput())).rejects.toMatchObject({
      code: 'AUDIT_ACTOR_UNAVAILABLE',
    });
  });

  it('requires audit.view and validates pagination before repository access', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    await expect(service.listCurrentOrganizationEntries(context())).rejects.toMatchObject({
      code: 'AUDIT_FORBIDDEN',
    });
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view), { limit: 101 }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view), {
        afterId: 'not-a-uuid',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    expect(repository.listInput).toBeNull();
  });

  it('lists only bounded current-Organization summaries and forwards a valid cursor', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);
    repository.listResult = {
      status: 'available',
      items: [entry()],
      nextCursor: AUDIT_ID,
    };

    const page = await service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view), {
      limit: 1,
      afterId: AUDIT_ID,
    });

    expect(repository.listInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      limit: 1,
      afterId: AUDIT_ID,
    });
    expect(page).toEqual({ items: [entry()], nextCursor: AUDIT_ID });
    expect(page.items[0]).not.toHaveProperty('metadata');
  });

  it('fails closed on cross-Tenant records, malformed pages, and foreign cursors', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    repository.listResult = {
      status: 'available',
      items: [entry({ tenantId: FOREIGN_TENANT_ID })],
      nextCursor: null,
    };
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'AUDIT_INTEGRITY_FAILURE' });

    repository.listResult = {
      status: 'available',
      items: [entry({ organizationId: FOREIGN_ORGANIZATION_ID })],
      nextCursor: null,
    };
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'AUDIT_INTEGRITY_FAILURE' });

    repository.listResult = {
      status: 'available',
      items: [entry({ action: 'INVALID ACTION' })],
      nextCursor: null,
    };
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'AUDIT_INTEGRITY_FAILURE' });

    repository.listResult = { status: 'cursor_invalid' };
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'AUDIT_CURSOR_INVALID' });

    repository.listResult = { status: 'scope_unavailable' };
    await expect(
      service.listCurrentOrganizationEntries(context(AUDIT_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'AUDIT_SCOPE_UNAVAILABLE' });
  });

  it('requires global, Tenant, and Organization results to preserve the requested scope', async () => {
    const repository = new FakeAuditRepository();
    const service = new AuditService(repository);

    repository.recordResult = {
      status: 'created',
      entry: entry({
        tenantId: null,
        organizationId: null,
        actorUserId: null,
      }),
    };
    await expect(
      service.recordTrustedEntry(
        trustedInput({
          tenantId: null,
          organizationId: null,
          actorUserId: null,
        }),
      ),
    ).resolves.toMatchObject({ tenantId: null, organizationId: null });

    repository.recordResult = {
      status: 'created',
      entry: entry({ organizationId: null }),
    };
    await expect(
      service.recordTrustedEntry(trustedInput({ tenantId: TENANT_ID, organizationId: null })),
    ).resolves.toMatchObject({ tenantId: TENANT_ID, organizationId: null });

    repository.recordResult = {
      status: 'created',
      entry: entry({ tenantId: FOREIGN_TENANT_ID }),
    };
    await expect(
      service.recordTrustedEntry(trustedInput({ tenantId: TENANT_ID })),
    ).rejects.toMatchObject({ code: 'AUDIT_INTEGRITY_FAILURE' });
  });
});
