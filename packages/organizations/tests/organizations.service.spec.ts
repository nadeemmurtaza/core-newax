import { describe, expect, it } from 'vitest';

import type { OrganizationRepository } from '../src/database/organization-repository';
import type {
  OrganizationEvent,
  OrganizationEventPublisher,
} from '../src/events/organization-event';
import { ORGANIZATION_PERMISSIONS } from '../src/permissions/organization-permissions';
import { OrganizationsService } from '../src/services/organizations.service';
import type {
  CreateOrganizationRecordInput,
  OrganizationListQuery,
  OrganizationPage,
  OrganizationRecord,
  OrganizationRequestContext,
  UpdateOrganizationRecordInput,
} from '../src/types/organization';

const TENANT_ID = '00000000-0000-4000-8000-000000000008';

const now = new Date('2026-07-11T00:00:00.000Z');

function organization(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: TENANT_ID,
    parentOrganizationId: null,
    legalName: 'NEWAX (SMC-PRIVATE) LIMITED',
    displayName: 'NEWAX',
    organizationType: 'company',
    registrationNumber: null,
    taxNumber: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

class FakeOrganizationRepository implements OrganizationRepository {
  readonly records = new Map<string, OrganizationRecord>();
  hasChildren = false;
  cycle = false;
  lastCreateInput: CreateOrganizationRecordInput | null = null;

  async archive(_tenantId: string, id: string, archivedAt: Date): Promise<OrganizationRecord> {
    const current = this.records.get(id);
    if (current === undefined) {
      throw new Error('Missing fake organization.');
    }

    const archived: OrganizationRecord = {
      ...current,
      status: 'archived',
      deletedAt: archivedAt,
      updatedAt: archivedAt,
    };
    this.records.set(id, archived);
    return archived;
  }

  async create(input: CreateOrganizationRecordInput): Promise<OrganizationRecord> {
    this.lastCreateInput = input;
    const created = organization({
      id: '00000000-0000-4000-8000-000000000010',
      ...input,
    });
    this.records.set(created.id, created);
    return created;
  }

  async findById(_tenantId: string, id: string): Promise<OrganizationRecord | null> {
    return this.records.get(id) ?? null;
  }

  async hasActiveChildren(_tenantId: string, _id: string): Promise<boolean> {
    return this.hasChildren;
  }

  async list(_tenantId: string, _query: OrganizationListQuery): Promise<OrganizationPage> {
    return { items: [...this.records.values()], nextCursor: null };
  }

  async update(
    _tenantId: string,
    id: string,
    input: UpdateOrganizationRecordInput,
  ): Promise<OrganizationRecord> {
    const current = this.records.get(id);
    if (current === undefined) {
      throw new Error('Missing fake organization.');
    }

    const updated: OrganizationRecord = {
      ...current,
      parentOrganizationId:
        'parentOrganizationId' in input
          ? (input.parentOrganizationId ?? null)
          : current.parentOrganizationId,
      legalName: input.legalName ?? current.legalName,
      displayName: input.displayName ?? current.displayName,
      organizationType: input.organizationType ?? current.organizationType,
      registrationNumber:
        'registrationNumber' in input
          ? (input.registrationNumber ?? null)
          : current.registrationNumber,
      taxNumber: 'taxNumber' in input ? (input.taxNumber ?? null) : current.taxNumber,
      updatedAt: now,
    };
    this.records.set(id, updated);
    return updated;
  }

  async wouldCreateCycle(
    _tenantId: string,
    _organizationId: string,
    _candidateParentId: string,
  ): Promise<boolean> {
    return this.cycle;
  }
}

class RecordingEventPublisher implements OrganizationEventPublisher {
  readonly events: OrganizationEvent[] = [];

  async publish(event: OrganizationEvent): Promise<void> {
    this.events.push(event);
  }
}

function context(...permissions: string[]): OrganizationRequestContext {
  return {
    actorUserId: '00000000-0000-4000-8000-000000000099',
    tenantId: TENANT_ID,
    permissionCodes: new Set(permissions),
  };
}

describe('OrganizationsService', () => {
  it('rejects operations without the required permission', async () => {
    const service = new OrganizationsService(
      new FakeOrganizationRepository(),
      new RecordingEventPublisher(),
    );

    await expect(service.list(context())).rejects.toMatchObject({
      code: 'ORGANIZATION_FORBIDDEN',
    });
  });

  it('normalizes create input and emits organization.created', async () => {
    const repository = new FakeOrganizationRepository();
    const publisher = new RecordingEventPublisher();
    const service = new OrganizationsService(repository, publisher);

    const created = await service.create(context(ORGANIZATION_PERMISSIONS.create), {
      legalName: '  NEWAX (SMC-PRIVATE) LIMITED  ',
      displayName: '  NEWAX  ',
      organizationType: '  company  ',
      registrationNumber: '  SECP-001  ',
      taxNumber: '   ',
    });

    expect(created.displayName).toBe('NEWAX');
    expect(repository.lastCreateInput).toEqual({
      tenantId: TENANT_ID,
      parentOrganizationId: null,
      legalName: 'NEWAX (SMC-PRIVATE) LIMITED',
      displayName: 'NEWAX',
      organizationType: 'company',
      registrationNumber: 'SECP-001',
      taxNumber: null,
    });
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]?.name).toBe('organization.created');
  });

  it('prevents hierarchy cycles during update', async () => {
    const repository = new FakeOrganizationRepository();
    const child = organization();
    const proposedParent = organization({ id: '00000000-0000-4000-8000-000000000002' });
    repository.records.set(child.id, child);
    repository.records.set(proposedParent.id, proposedParent);
    repository.cycle = true;

    const service = new OrganizationsService(repository, new RecordingEventPublisher());

    await expect(
      service.update(context(ORGANIZATION_PERMISSIONS.update), child.id, {
        parentOrganizationId: proposedParent.id,
      }),
    ).rejects.toMatchObject({
      code: 'ORGANIZATION_HIERARCHY_CYCLE',
    });
  });

  it('refuses to archive an organization with active children', async () => {
    const repository = new FakeOrganizationRepository();
    const record = organization();
    repository.records.set(record.id, record);
    repository.hasChildren = true;

    const service = new OrganizationsService(repository, new RecordingEventPublisher());

    await expect(
      service.archive(context(ORGANIZATION_PERMISSIONS.archive), record.id),
    ).rejects.toMatchObject({
      code: 'ORGANIZATION_HAS_ACTIVE_CHILDREN',
    });
  });
});
