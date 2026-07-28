import { describe, expect, it } from 'vitest';

import type { TenantRepository } from '../src/database/tenant-repository';
import type { TenantEvent, TenantEventPublisher } from '../src/events/tenant-event';
import { TENANT_PERMISSIONS } from '../src/permissions/tenant-permissions';
import { TenantsService } from '../src/services/tenants.service';
import type {
  CreateTenantRecordInput,
  TenantListQuery,
  TenantPage,
  TenantRecord,
  TenantRequestContext,
} from '../src/types/tenant';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000099';
const now = new Date('2026-07-12T00:00:00.000Z');

function tenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: TENANT_ID,
    name: 'NEWAX Group',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

class FakeRepository implements TenantRepository {
  readonly records = new Map<string, TenantRecord>();
  lastCreate: CreateTenantRecordInput | null = null;

  async create(input: CreateTenantRecordInput): Promise<TenantRecord> {
    this.lastCreate = input;
    const record = tenant({ name: input.name });
    this.records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<TenantRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(_query: TenantListQuery): Promise<TenantPage> {
    return { items: [...this.records.values()], nextCursor: null };
  }
}

class Publisher implements TenantEventPublisher {
  readonly events: TenantEvent[] = [];
  async publish(event: TenantEvent): Promise<void> {
    this.events.push(event);
  }
}

function context(...permissions: string[]): TenantRequestContext {
  return { actorUserId: USER_ID, permissionCodes: new Set(permissions) };
}

describe('TenantsService', () => {
  it('creates a normalized tenant with a separate identifier', async () => {
    const repository = new FakeRepository();
    const publisher = new Publisher();
    const service = new TenantsService(repository, publisher);

    const created = await service.create(context(TENANT_PERMISSIONS.create), {
      name: '  NEWAX Group  ',
    });

    expect(created.id).toBe(TENANT_ID);
    expect(repository.lastCreate).toEqual({ name: 'NEWAX Group' });
    expect(publisher.events[0]).toMatchObject({ name: 'tenant.created', tenantId: TENANT_ID });
  });

  it('rejects access without explicit permission', async () => {
    const service = new TenantsService(new FakeRepository(), new Publisher());
    await expect(service.list(context())).rejects.toMatchObject({ code: 'TENANT_FORBIDDEN' });
  });

  it('reads only an existing non-deleted tenant', async () => {
    const repository = new FakeRepository();
    repository.records.set(TENANT_ID, tenant());
    const service = new TenantsService(repository, new Publisher());

    await expect(service.getById(context(TENANT_PERMISSIONS.view), TENANT_ID)).resolves.toEqual(
      tenant(),
    );
    repository.records.set(TENANT_ID, tenant({ deletedAt: now }));
    await expect(
      service.getById(context(TENANT_PERMISSIONS.view), TENANT_ID),
    ).rejects.toMatchObject({
      code: 'TENANT_NOT_FOUND',
    });
  });
});
