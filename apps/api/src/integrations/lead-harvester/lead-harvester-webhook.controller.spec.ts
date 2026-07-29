import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type {
  LeadHarvesterInstitutionUpsertedPayload,
  LeadHarvesterSyncRequestContext,
  LeadHarvesterSyncResult,
  LeadHarvesterSyncService,
} from '@newax/lead-harvester-sync';
import { describe, expect, it } from 'vitest';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_PUBLIC_SIGNED_MUTATION_KEY,
} from '../../http-security/http-security.decorators';
import { LeadHarvesterWebhookController } from './lead-harvester-webhook.controller';
import type { LeadHarvesterServiceAccountContextFactory } from './lead-harvester-service-account-context.factory';

const CONTEXT: LeadHarvesterSyncRequestContext = {
  actorUserId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  permissionCodes: new Set(['lead_harvester_sync.ingest']),
};
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000003';

function validBody(): unknown {
  return {
    schemaVersion: 1,
    eventId: '00000000-0000-4000-8000-000000000099',
    eventType: 'institution.upserted',
    occurredAt: '2026-07-20T10:00:00.000Z',
    institution: {
      id: 'institution-1',
      canonicalName: 'Riverside School',
      institutionType: 'school',
      domain: 'riverside.edu',
      website: 'https://riverside.edu',
      status: 'qualified',
    },
    branches: [],
    contactPoints: [],
  };
}

class FakeContextFactory {
  buildTenantContextCalls = 0;

  async buildTenantContext(): Promise<LeadHarvesterSyncRequestContext> {
    this.buildTenantContextCalls += 1;
    return CONTEXT;
  }
}

class FakeSyncService {
  receivedContext: LeadHarvesterSyncRequestContext | null = null;
  receivedPayload: LeadHarvesterInstitutionUpsertedPayload | null = null;
  result: LeadHarvesterSyncResult = {
    status: 'applied',
    organizationId: ORGANIZATION_ID,
    skipped: [],
  };

  async syncInstitutionUpserted(
    context: LeadHarvesterSyncRequestContext,
    payload: LeadHarvesterInstitutionUpsertedPayload,
  ): Promise<LeadHarvesterSyncResult> {
    this.receivedContext = context;
    this.receivedPayload = payload;
    return this.result;
  }
}

function controller(
  contextFactory: FakeContextFactory,
  syncService: FakeSyncService,
): LeadHarvesterWebhookController {
  return new LeadHarvesterWebhookController(
    contextFactory as unknown as LeadHarvesterServiceAccountContextFactory,
    syncService as unknown as LeadHarvesterSyncService,
  );
}

describe('LeadHarvesterWebhookController', () => {
  it('is a public-signed-mutation endpoint, not a permission-gated one', () => {
    const handler = LeadHarvesterWebhookController.prototype.handleWebhook;
    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, handler)).toBe('public');
    expect(Reflect.getMetadata(HTTP_PUBLIC_SIGNED_MUTATION_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as readonly {
      name: string;
      value: string;
    }[];
    expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });

  it('parses the body, builds the service-account context, and forwards to the sync service', async () => {
    const contextFactory = new FakeContextFactory();
    const syncService = new FakeSyncService();

    const response = await controller(contextFactory, syncService).handleWebhook(validBody());

    expect(contextFactory.buildTenantContextCalls).toBe(1);
    expect(syncService.receivedContext).toBe(CONTEXT);
    expect(syncService.receivedPayload).toMatchObject({
      schemaVersion: 1,
      eventType: 'institution.upserted',
      institution: { id: 'institution-1' },
    });
    expect(response).toEqual({
      success: true,
      data: { status: 'applied', organization_id: ORGANIZATION_ID, skipped: [] },
    });
  });

  it('maps a stale result without a skipped list carried over from a prior payload', async () => {
    const contextFactory = new FakeContextFactory();
    const syncService = new FakeSyncService();
    syncService.result = { status: 'stale', organizationId: ORGANIZATION_ID };

    const response = await controller(contextFactory, syncService).handleWebhook(validBody());

    expect(response).toEqual({
      success: true,
      data: { status: 'stale', organization_id: ORGANIZATION_ID, skipped: [] },
    });
  });

  it('surfaces skipped contact points from an applied result', async () => {
    const contextFactory = new FakeContextFactory();
    const syncService = new FakeSyncService();
    syncService.result = {
      status: 'applied',
      organizationId: ORGANIZATION_ID,
      skipped: [{ kind: 'contact_point', id: 'contact-9', reason: 'unsupported_contact_type' }],
    };

    const response = await controller(contextFactory, syncService).handleWebhook(validBody());

    expect(response.data.skipped).toEqual([
      { kind: 'contact_point', id: 'contact-9', reason: 'unsupported_contact_type' },
    ]);
  });

  it('rejects a malformed body before ever building a context', async () => {
    const contextFactory = new FakeContextFactory();
    const syncService = new FakeSyncService();

    await expect(
      controller(contextFactory, syncService).handleWebhook({ not: 'valid' }),
    ).rejects.toMatchObject({ code: 'HTTP_SECURITY_INVALID_INPUT' });
    expect(contextFactory.buildTenantContextCalls).toBe(0);
  });
});
