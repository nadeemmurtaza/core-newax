import { describe, expect, it } from 'vitest';

import type { ObjectRepository } from '../src/database/object-repository';
import type { ObjectEvent, ObjectEventPublisher } from '../src/events/object-event';
import { OBJECT_PERMISSIONS } from '../src/permissions/object-permissions';
import { ObjectsService } from '../src/services/objects.service';
import type {
  CreateOrganizationObjectRecordInput,
  CreateOrganizationObjectResult,
  ListOrganizationObjectsRecordInput,
  ListOrganizationObjectsResult,
  ObjectRecord,
  ObjectTypeRecord,
  RegisterObjectTypeRecordInput,
  RegisterObjectTypeResult,
} from '../src/types/object';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000003';
const TYPE_ID = '00000000-0000-4000-8000-000000000004';
const OBJECT_ID = '00000000-0000-4000-8000-000000000005';
const PARENT_ID = '00000000-0000-4000-8000-000000000006';

const OBJECT_TYPE: ObjectTypeRecord = {
  id: TYPE_ID,
  code: 'connected.sensor',
  name: 'Connected Sensor',
  category: 'connected',
  description: 'A monitored sensor.',
  createdAt: new Date('2026-07-13T10:00:00.000Z'),
};

const OBJECT: ObjectRecord = {
  id: OBJECT_ID,
  tenantId: TENANT_ID,
  owningOrganizationId: ORGANIZATION_ID,
  objectTypeId: TYPE_ID,
  objectTypeCode: 'connected.sensor',
  parentObjectId: PARENT_ID,
  name: 'Cold Room Sensor 1',
  referenceCode: 'CR-SENSOR-1',
  serialNumber: 'sn-001',
  description: 'Monitors cold-room temperature.',
  createdAt: new Date('2026-07-13T10:30:00.000Z'),
};

class FakeRepository implements ObjectRepository {
  registerInput: RegisterObjectTypeRecordInput | null = null;
  createInput: CreateOrganizationObjectRecordInput | null = null;
  listInput: ListOrganizationObjectsRecordInput | null = null;

  registerResult: RegisterObjectTypeResult = { status: 'created', objectType: OBJECT_TYPE };
  createResult: CreateOrganizationObjectResult = { status: 'created', object: OBJECT };
  listResult: ListOrganizationObjectsResult = {
    status: 'available',
    items: [OBJECT],
    nextCursor: null,
  };

  async registerObjectType(
    input: RegisterObjectTypeRecordInput,
  ): Promise<RegisterObjectTypeResult> {
    this.registerInput = input;
    return this.registerResult;
  }

  async createOrganizationObject(
    input: CreateOrganizationObjectRecordInput,
  ): Promise<CreateOrganizationObjectResult> {
    this.createInput = input;
    return this.createResult;
  }

  async listOrganizationObjects(
    input: ListOrganizationObjectsRecordInput,
  ): Promise<ListOrganizationObjectsResult> {
    this.listInput = input;
    return this.listResult;
  }
}

class RecordingPublisher implements ObjectEventPublisher {
  readonly events: ObjectEvent[] = [];

  async publish(event: ObjectEvent): Promise<void> {
    this.events.push(event);
  }
}

function organizationContext(...permissions: string[]) {
  return {
    actorUserId: ACTOR_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissions),
  };
}

describe('ObjectsService', () => {
  it('registers a normalized Object Type with explicit platform permission', async () => {
    const repository = new FakeRepository();
    const publisher = new RecordingPublisher();
    const service = new ObjectsService(repository, publisher);

    const result = await service.registerObjectType(
      {
        actorUserId: ACTOR_ID,
        permissionCodes: new Set([OBJECT_PERMISSIONS.typesManage]),
      },
      {
        code: ' Connected.Sensor ',
        name: ' Connected   Sensor ',
        category: ' Connected ',
        description: ' A monitored   sensor. ',
      },
    );

    expect(repository.registerInput).toEqual({
      code: 'connected.sensor',
      name: 'Connected Sensor',
      category: 'connected',
      description: 'A monitored sensor.',
    });
    expect(result).toEqual(OBJECT_TYPE);
    expect(publisher.events).toEqual([
      expect.objectContaining({
        name: 'object.type_registered',
        actorUserId: ACTOR_ID,
        objectTypeId: TYPE_ID,
        objectTypeCode: 'connected.sensor',
      }),
    ]);
  });

  it('rejects Object Type registration without permission', async () => {
    const service = new ObjectsService(new FakeRepository(), new RecordingPublisher());

    await expect(
      service.registerObjectType(
        { actorUserId: ACTOR_ID, permissionCodes: new Set() },
        { code: 'vehicle', name: 'Vehicle' },
      ),
    ).rejects.toMatchObject({ code: 'OBJECT_FORBIDDEN' });
  });

  it('creates a normalized Object inside trusted Tenant and Organization context', async () => {
    const repository = new FakeRepository();
    const publisher = new RecordingPublisher();
    const service = new ObjectsService(repository, publisher);

    const result = await service.addCurrentOrganizationObject(
      organizationContext(OBJECT_PERMISSIONS.create),
      {
        objectTypeCode: ' Connected.Sensor ',
        parentObjectId: PARENT_ID.toUpperCase(),
        name: ' Cold Room   Sensor 1 ',
        referenceCode: ' cr-sensor-1 ',
        serialNumber: ' sn-001 ',
        description: ' Monitors cold-room   temperature. ',
      },
    );

    expect(repository.createInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      objectTypeCode: 'connected.sensor',
      parentObjectId: PARENT_ID,
      name: 'Cold Room Sensor 1',
      referenceCode: 'CR-SENSOR-1',
      serialNumber: 'sn-001',
      description: 'Monitors cold-room temperature.',
    });
    expect(result).toEqual(OBJECT);
    expect(publisher.events).toEqual([
      expect.objectContaining({
        name: 'object.created',
        actorUserId: ACTOR_ID,
        tenantId: TENANT_ID,
        organizationId: ORGANIZATION_ID,
        objectId: OBJECT_ID,
        objectTypeCode: 'connected.sensor',
      }),
    ]);
    expect(JSON.stringify(publisher.events)).not.toContain('Cold Room Sensor 1');
    expect(JSON.stringify(publisher.events)).not.toContain('CR-SENSOR-1');
    expect(JSON.stringify(publisher.events)).not.toContain('sn-001');
  });

  it.each([
    ['organization_unavailable', 'OBJECT_ORGANIZATION_UNAVAILABLE'],
    ['object_type_unavailable', 'OBJECT_TYPE_UNAVAILABLE'],
    ['parent_unavailable', 'OBJECT_PARENT_UNAVAILABLE'],
    ['conflict', 'OBJECT_CONFLICT'],
  ] as const)('maps %s repository result to %s', async (status, code) => {
    const repository = new FakeRepository();
    repository.createResult = { status } as CreateOrganizationObjectResult;
    const service = new ObjectsService(repository, new RecordingPublisher());

    await expect(
      service.addCurrentOrganizationObject(organizationContext(OBJECT_PERMISSIONS.create), {
        objectTypeCode: 'vehicle',
        name: 'Vehicle 1',
      }),
    ).rejects.toMatchObject({ code });
  });

  it('rejects records returned outside the trusted boundary', async () => {
    const repository = new FakeRepository();
    repository.createResult = {
      status: 'created',
      object: { ...OBJECT, tenantId: '00000000-0000-4000-8000-000000000099' },
    };
    const service = new ObjectsService(repository, new RecordingPublisher());

    await expect(
      service.addCurrentOrganizationObject(organizationContext(OBJECT_PERMISSIONS.create), {
        objectTypeCode: 'connected.sensor',
        name: 'Sensor',
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_INTEGRITY_FAILURE' });
  });

  it('lists a bounded page only for the trusted Organization', async () => {
    const repository = new FakeRepository();
    repository.listResult = {
      status: 'available',
      items: [OBJECT],
      nextCursor: OBJECT_ID,
    };
    const service = new ObjectsService(repository, new RecordingPublisher());

    const page = await service.listCurrentOrganizationObjects(
      organizationContext(OBJECT_PERMISSIONS.view),
      {
        objectTypeCode: ' Connected.Sensor ',
        limit: 25,
        afterId: PARENT_ID.toUpperCase(),
      },
    );

    expect(repository.listInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      objectTypeCode: 'connected.sensor',
      limit: 25,
      afterId: PARENT_ID,
    });
    expect(page).toEqual({ items: [OBJECT], nextCursor: OBJECT_ID });
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('rejects invalid pagination and foreign cursors', async () => {
    const repository = new FakeRepository();
    const service = new ObjectsService(repository, new RecordingPublisher());

    await expect(
      service.listCurrentOrganizationObjects(organizationContext(OBJECT_PERMISSIONS.view), {
        limit: 101,
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_INVALID_INPUT' });

    repository.listResult = { status: 'cursor_invalid' };
    await expect(
      service.listCurrentOrganizationObjects(organizationContext(OBJECT_PERMISSIONS.view), {
        afterId: OBJECT_ID,
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_CURSOR_INVALID' });
  });

  it('rejects malformed codes and UUIDs before repository access', async () => {
    const repository = new FakeRepository();
    const service = new ObjectsService(repository, new RecordingPublisher());

    await expect(
      service.addCurrentOrganizationObject(organizationContext(OBJECT_PERMISSIONS.create), {
        objectTypeCode: 'Not valid!',
        name: 'Sensor',
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_INVALID_INPUT' });
    expect(repository.createInput).toBeNull();

    await expect(
      service.addCurrentOrganizationObject(organizationContext(OBJECT_PERMISSIONS.create), {
        objectTypeCode: 'sensor',
        parentObjectId: 'not-a-uuid',
        name: 'Sensor',
      }),
    ).rejects.toMatchObject({ code: 'OBJECT_INVALID_INPUT' });
    expect(repository.createInput).toBeNull();
  });
});
