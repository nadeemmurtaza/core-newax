import { describe, expect, it } from 'vitest';

import type { ExternalReferenceRepository } from '../src/database/external-reference-repository';
import type {
  ExternalReferenceEvent,
  ExternalReferenceEventPublisher,
} from '../src/events/external-reference-event';
import { EXTERNAL_REFERENCE_PERMISSIONS } from '../src/permissions/external-reference-permissions';
import { ExternalReferencesService } from '../src/services/external-references.service';
import type {
  ExternalReferenceRecord,
  ListOrganizationExternalReferencesRecordInput,
  ListOrganizationExternalReferencesResult,
  OrganizationExternalReferenceRequestContext,
  RegisterOrganizationExternalReferenceInput,
  RegisterOrganizationExternalReferenceRecordInput,
  RegisterOrganizationExternalReferenceResult,
} from '../src/types/external-reference';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000003';
const EXTERNAL_REFERENCE_ID = '00000000-0000-4000-8000-000000000004';
const FOREIGN_TENANT_ID = '00000000-0000-4000-8000-000000000005';
const SECOND_EXTERNAL_REFERENCE_ID = '00000000-0000-4000-8000-000000000006';

function context(...permissions: string[]): OrganizationExternalReferenceRequestContext {
  return {
    actorUserId: ACTOR_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissions),
  };
}

function input(
  overrides: Partial<RegisterOrganizationExternalReferenceInput> = {},
): RegisterOrganizationExternalReferenceInput {
  return {
    domainCode: 'lms',
    entityType: 'student.profile',
    entityId: 'Student-42',
    externalSystem: 'legacy.sis',
    externalKey: 'Student/External Key 42',
    ...overrides,
  };
}

function record(overrides: Partial<ExternalReferenceRecord> = {}): ExternalReferenceRecord {
  return {
    id: EXTERNAL_REFERENCE_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    domainCode: 'lms',
    entityType: 'student.profile',
    entityId: 'Student-42',
    externalSystem: 'legacy.sis',
    externalKey: 'Student/External Key 42',
    createdAt: new Date('2026-07-14T08:00:00.000Z'),
    updatedAt: new Date('2026-07-14T08:00:00.000Z'),
    ...overrides,
  };
}

class FakeExternalReferenceRepository implements ExternalReferenceRepository {
  registerInput: RegisterOrganizationExternalReferenceRecordInput | null = null;
  listInput: ListOrganizationExternalReferencesRecordInput | null = null;
  registerResult: RegisterOrganizationExternalReferenceResult = {
    status: 'created',
    externalReference: record(),
  };
  listResult: ListOrganizationExternalReferencesResult = {
    status: 'available',
    items: [record()],
    nextCursor: null,
  };

  async registerOrganizationExternalReference(
    registerInput: RegisterOrganizationExternalReferenceRecordInput,
  ): Promise<RegisterOrganizationExternalReferenceResult> {
    this.registerInput = registerInput;
    return this.registerResult;
  }

  async listOrganizationExternalReferences(
    listInput: ListOrganizationExternalReferencesRecordInput,
  ): Promise<ListOrganizationExternalReferencesResult> {
    this.listInput = listInput;
    return this.listResult;
  }
}

class RecordingExternalReferenceEventPublisher implements ExternalReferenceEventPublisher {
  readonly events: ExternalReferenceEvent[] = [];

  async publish(event: ExternalReferenceEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('ExternalReferencesService governance foundation', () => {
  it('normalizes stable codes, preserves opaque identifiers, and emits no mapping values', async () => {
    const repository = new FakeExternalReferenceRepository();
    const publisher = new RecordingExternalReferenceEventPublisher();
    const service = new ExternalReferencesService(repository, publisher);

    const externalReference = await service.registerCurrentOrganizationExternalReference(
      context(EXTERNAL_REFERENCE_PERMISSIONS.register),
      input({
        domainCode: ' LMS ',
        entityType: ' STUDENT.PROFILE ',
        externalSystem: ' LEGACY.SIS ',
      }),
    );

    expect(repository.registerInput).toEqual({
      actorUserId: ACTOR_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      domainCode: 'lms',
      entityType: 'student.profile',
      entityId: 'Student-42',
      externalSystem: 'legacy.sis',
      externalKey: 'Student/External Key 42',
    });
    expect(externalReference).toEqual(record());
    expect(Object.isFrozen(externalReference)).toBe(true);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      name: 'external_reference.registered',
      actorUserId: ACTOR_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      externalReferenceId: EXTERNAL_REFERENCE_ID,
    });
    expect(publisher.events[0]).not.toHaveProperty('domainCode');
    expect(publisher.events[0]).not.toHaveProperty('entityId');
    expect(publisher.events[0]).not.toHaveProperty('externalSystem');
    expect(publisher.events[0]).not.toHaveProperty('externalKey');
  });

  it('enforces explicit permissions before repository access', async () => {
    const repository = new FakeExternalReferenceRepository();
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.registerCurrentOrganizationExternalReference(context(), input()),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_FORBIDDEN' });
    await expect(
      service.listCurrentOrganizationExternalReferences(context()),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_FORBIDDEN' });
    expect(repository.registerInput).toBeNull();
    expect(repository.listInput).toBeNull();
  });

  it.each([
    ['domainCode', input({ domainCode: 'bad code' })],
    ['entityType', input({ entityType: '-student' })],
    ['entityId', input({ entityId: 'line\nbreak' })],
    ['entityIdBytes', input({ entityId: '💼'.repeat(129) })],
    ['externalSystem', input({ externalSystem: 'legacy@sis' })],
    ['externalKey', input({ externalKey: '\u0000secret' })],
    ['externalKeyBlank', input({ externalKey: '   ' })],
    ['externalKeyBytes', input({ externalKey: '💼'.repeat(256) })],
  ])('rejects invalid %s values before persistence', async (_field, invalidInput) => {
    const repository = new FakeExternalReferenceRepository();
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.registerCurrentOrganizationExternalReference(
        context(EXTERNAL_REFERENCE_PERMISSIONS.register),
        invalidInput,
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INVALID_INPUT' });
    expect(repository.registerInput).toBeNull();
  });

  it.each([
    ['organization_unavailable', 'EXTERNAL_REFERENCE_ORGANIZATION_UNAVAILABLE'],
    ['actor_unavailable', 'EXTERNAL_REFERENCE_ACTOR_UNAVAILABLE'],
    ['conflict', 'EXTERNAL_REFERENCE_CONFLICT'],
  ] as const)('maps repository registration status %s', async (status, code) => {
    const repository = new FakeExternalReferenceRepository();
    repository.registerResult = { status };
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.registerCurrentOrganizationExternalReference(
        context(EXTERNAL_REFERENCE_PERMISSIONS.register),
        input(),
      ),
    ).rejects.toMatchObject({ code });
  });

  it('rejects repository records outside the trusted Tenant and Organization boundary', async () => {
    const repository = new FakeExternalReferenceRepository();
    repository.registerResult = {
      status: 'created',
      externalReference: record({ tenantId: FOREIGN_TENANT_ID }),
    };
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.registerCurrentOrganizationExternalReference(
        context(EXTERNAL_REFERENCE_PERMISSIONS.register),
        input(),
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE' });
  });

  it('returns a bounded immutable page and validates the current-Organization cursor', async () => {
    const repository = new FakeExternalReferenceRepository();
    repository.listResult = {
      status: 'available',
      items: [record()],
      nextCursor: SECOND_EXTERNAL_REFERENCE_ID,
    };
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    const page = await service.listCurrentOrganizationExternalReferences(
      context(EXTERNAL_REFERENCE_PERMISSIONS.view),
      { limit: 1, afterId: EXTERNAL_REFERENCE_ID.toUpperCase() },
    );

    expect(repository.listInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      limit: 1,
      afterId: EXTERNAL_REFERENCE_ID,
    });
    expect(page).toEqual({ items: [record()], nextCursor: SECOND_EXTERNAL_REFERENCE_ID });
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
    expect(Object.isFrozen(page.items[0])).toBe(true);
  });

  it.each([0, 101, 1.5])('rejects invalid page limit %s', async (limit) => {
    const repository = new FakeExternalReferenceRepository();
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
        { limit },
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INVALID_INPUT' });
    expect(repository.listInput).toBeNull();
  });

  it.each([
    record({ domainCode: ' LMS ' }),
    record({ entityType: 'student profile' }),
    record({ entityId: 'bad\nidentifier' }),
    record({ externalSystem: 'LEGACY.SIS' }),
    record({ externalKey: '\u0000bad' }),
    record({ createdAt: new Date('invalid') }),
    record({ updatedAt: new Date('2026-07-14T07:59:59.000Z') }),
  ])('fails closed on malformed stored mappings', async (malformed) => {
    const repository = new FakeExternalReferenceRepository();
    repository.listResult = { status: 'available', items: [malformed], nextCursor: null };
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE' });
  });

  it('maps unavailable and foreign-cursor pages without leaking repository details', async () => {
    const repository = new FakeExternalReferenceRepository();
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    repository.listResult = { status: 'organization_unavailable' };
    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_ORGANIZATION_UNAVAILABLE' });

    repository.listResult = { status: 'cursor_invalid' };
    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_CURSOR_INVALID' });
  });

  it('rejects oversized pages and malformed repository cursors', async () => {
    const repository = new FakeExternalReferenceRepository();
    repository.listResult = {
      status: 'available',
      items: [record(), record({ id: SECOND_EXTERNAL_REFERENCE_ID })],
      nextCursor: null,
    };
    const service = new ExternalReferencesService(
      repository,
      new RecordingExternalReferenceEventPublisher(),
    );

    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
        { limit: 1 },
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE' });

    repository.listResult = { status: 'available', items: [], nextCursor: 'not-a-uuid' };
    await expect(
      service.listCurrentOrganizationExternalReferences(
        context(EXTERNAL_REFERENCE_PERMISSIONS.view),
      ),
    ).rejects.toMatchObject({ code: 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE' });
  });
});
