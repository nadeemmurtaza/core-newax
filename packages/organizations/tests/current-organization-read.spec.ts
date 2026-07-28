import { describe, expect, it } from 'vitest';

import type { OrganizationRepository } from '../src/database/organization-repository';
import type { OrganizationEventPublisher } from '../src/events/organization-event';
import { ORGANIZATION_PERMISSIONS } from '../src/permissions/organization-permissions';
import { OrganizationsService } from '../src/services/organizations.service';
import type {
  CreateOrganizationRecordInput,
  CurrentOrganizationRequestContext,
  OrganizationListQuery,
  OrganizationPage,
  OrganizationRecord,
  UpdateOrganizationRecordInput,
} from '../src/types/organization';

const TENANT_ID = '00000000-0000-4000-8000-000000000008';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_USER_ID = '00000000-0000-4000-8000-000000000099';
const CREATED_AT = new Date('2026-07-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-07-10T00:00:00.000Z');

function organization(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: ORGANIZATION_ID,
    tenantId: TENANT_ID,
    parentOrganizationId: null,
    legalName: 'NEWAX (SMC-PRIVATE) LIMITED',
    displayName: 'NEWAX',
    organizationType: 'company',
    registrationNumber: 'SECP-PRIVATE',
    taxNumber: 'TAX-PRIVATE',
    status: 'active',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    deletedAt: null,
    ...overrides,
  };
}

class FakeOrganizationRepository implements OrganizationRepository {
  record: OrganizationRecord | null = organization();
  requestedTenantId: string | null = null;
  requestedId: string | null = null;

  async findById(tenantId: string, id: string): Promise<OrganizationRecord | null> {
    this.requestedTenantId = tenantId;
    this.requestedId = id;
    return this.record;
  }

  async archive(): Promise<OrganizationRecord> {
    throw new Error('Not implemented in this test.');
  }

  async create(_input: CreateOrganizationRecordInput): Promise<OrganizationRecord> {
    throw new Error('Not implemented in this test.');
  }

  async hasActiveChildren(): Promise<boolean> {
    throw new Error('Not implemented in this test.');
  }

  async list(_tenantId: string, _query: OrganizationListQuery): Promise<OrganizationPage> {
    throw new Error('Not implemented in this test.');
  }

  async update(
    _tenantId: string,
    _id: string,
    _input: UpdateOrganizationRecordInput,
  ): Promise<OrganizationRecord> {
    throw new Error('Not implemented in this test.');
  }

  async wouldCreateCycle(): Promise<boolean> {
    throw new Error('Not implemented in this test.');
  }
}

class NoopEventPublisher implements OrganizationEventPublisher {
  async publish(): Promise<void> {}
}

function context(...permissionCodes: readonly string[]): CurrentOrganizationRequestContext {
  return {
    actorUserId: ACTOR_USER_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissionCodes),
  };
}

describe('OrganizationsService.getCurrent', () => {
  it('returns a bounded active organization profile from trusted context', async () => {
    const repository = new FakeOrganizationRepository();
    const service = new OrganizationsService(repository, new NoopEventPublisher());

    const result = await service.getCurrent(context(ORGANIZATION_PERMISSIONS.view));

    expect(repository.requestedTenantId).toBe(TENANT_ID);
    expect(repository.requestedId).toBe(ORGANIZATION_ID);
    expect(result).toEqual({
      id: ORGANIZATION_ID,
      tenantId: TENANT_ID,
      legalName: 'NEWAX (SMC-PRIVATE) LIMITED',
      displayName: 'NEWAX',
      organizationType: 'company',
      status: 'active',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty('registrationNumber');
    expect(result).not.toHaveProperty('taxNumber');
    expect(result).not.toHaveProperty('parentOrganizationId');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('normalizes the trusted organization identifier before lookup', async () => {
    const repository = new FakeOrganizationRepository();
    const service = new OrganizationsService(repository, new NoopEventPublisher());

    await service.getCurrent({
      ...context(ORGANIZATION_PERMISSIONS.view),
      organizationId: ORGANIZATION_ID.toUpperCase(),
    });

    expect(repository.requestedId).toBe(ORGANIZATION_ID);
  });

  it('treats malformed trusted identifiers as integrity failures before persistence', async () => {
    for (const malformedContext of [
      {
        ...context(ORGANIZATION_PERMISSIONS.view),
        actorUserId: 'not-a-uuid',
      },
      {
        ...context(ORGANIZATION_PERMISSIONS.view),
        tenantId: 'not-a-uuid',
      },
      {
        ...context(ORGANIZATION_PERMISSIONS.view),
        organizationId: 'not-a-uuid',
      },
    ]) {
      const repository = new FakeOrganizationRepository();
      const service = new OrganizationsService(repository, new NoopEventPublisher());

      await expect(service.getCurrent(malformedContext)).rejects.toMatchObject({
        code: 'ORGANIZATION_INTEGRITY_FAILURE',
      });
      expect(repository.requestedId).toBeNull();
    }
  });

  it('requires organizations.view even for the current organization', async () => {
    const service = new OrganizationsService(
      new FakeOrganizationRepository(),
      new NoopEventPublisher(),
    );

    await expect(service.getCurrent(context())).rejects.toMatchObject({
      code: 'ORGANIZATION_FORBIDDEN',
    });
  });

  it('fails closed when the current organization is inactive or deleted', async () => {
    for (const record of [
      organization({ status: 'suspended' }),
      organization({ deletedAt: UPDATED_AT }),
    ]) {
      const repository = new FakeOrganizationRepository();
      repository.record = record;
      const service = new OrganizationsService(repository, new NoopEventPublisher());

      await expect(
        service.getCurrent(context(ORGANIZATION_PERMISSIONS.view)),
      ).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_FOUND' });
    }
  });

  it('rejects repository records outside the trusted tenant boundary', async () => {
    const repository = new FakeOrganizationRepository();
    repository.record = organization({
      tenantId: '00000000-0000-4000-8000-000000000009',
    });
    const service = new OrganizationsService(repository, new NoopEventPublisher());

    await expect(service.getCurrent(context(ORGANIZATION_PERMISSIONS.view))).rejects.toMatchObject({
      code: 'ORGANIZATION_INTEGRITY_FAILURE',
    });
  });

  it('rejects repository records outside the trusted organization boundary', async () => {
    const repository = new FakeOrganizationRepository();
    repository.record = organization({
      id: '00000000-0000-4000-8000-000000000002',
    });
    const service = new OrganizationsService(repository, new NoopEventPublisher());

    await expect(service.getCurrent(context(ORGANIZATION_PERMISSIONS.view))).rejects.toMatchObject({
      code: 'ORGANIZATION_INTEGRITY_FAILURE',
    });
  });

  it('rejects invalid organization timestamps', async () => {
    const repository = new FakeOrganizationRepository();
    repository.record = organization({
      createdAt: UPDATED_AT,
      updatedAt: CREATED_AT,
    });
    const service = new OrganizationsService(repository, new NoopEventPublisher());

    await expect(service.getCurrent(context(ORGANIZATION_PERMISSIONS.view))).rejects.toMatchObject({
      code: 'ORGANIZATION_INTEGRITY_FAILURE',
    });
  });
});
