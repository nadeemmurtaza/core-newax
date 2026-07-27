import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import {
  OBJECT_PERMISSIONS,
  type CreateOrganizationObjectInput,
  type ObjectRecord,
  type ObjectsService,
  type OrganizationObjectListQuery,
  type OrganizationObjectPage,
  type OrganizationObjectRequestContext,
} from '@newax/objects';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';
import { describe, expect, it } from 'vitest';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CurrentOrganizationObjectsController } from './current-organization-objects.controller';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const OBJECT_ID = '00000000-0000-4000-8000-000000000006';
const OBJECT_TYPE_ID = '00000000-0000-4000-8000-000000000007';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';
const PARENT_OBJECT_ID = '00000000-0000-4000-8000-000000000009';

const CONTEXT: TrustedOrganizationRequestContext = {
  scope: 'organization',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-14T12:00:00.000Z'),
  membershipId: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  permissionCodes: new Set([OBJECT_PERMISSIONS.create, OBJECT_PERMISSIONS.view]),
  evaluatedAt: new Date('2026-07-14T10:00:00.000Z'),
};

const OBJECT: ObjectRecord = {
  id: OBJECT_ID,
  tenantId: TENANT_ID,
  owningOrganizationId: ORGANIZATION_ID,
  objectTypeId: OBJECT_TYPE_ID,
  objectTypeCode: 'medical_device',
  parentObjectId: PARENT_OBJECT_ID,
  name: 'MRI Scanner 1',
  referenceCode: 'MRI-001',
  serialNumber: 'SN-001',
  description: 'Radiology asset',
  createdAt: new Date('2026-07-14T10:30:00.000Z'),
};

class FakeObjectsService {
  createContext: OrganizationObjectRequestContext | null = null;
  createInput: CreateOrganizationObjectInput | null = null;
  listContext: OrganizationObjectRequestContext | null = null;
  listQuery: OrganizationObjectListQuery | null = null;

  async addCurrentOrganizationObject(
    context: OrganizationObjectRequestContext,
    input: CreateOrganizationObjectInput,
  ): Promise<ObjectRecord> {
    this.createContext = context;
    this.createInput = input;
    return OBJECT;
  }

  async listCurrentOrganizationObjects(
    context: OrganizationObjectRequestContext,
    query: OrganizationObjectListQuery,
  ): Promise<OrganizationObjectPage> {
    this.listContext = context;
    this.listQuery = query;
    return { items: [OBJECT], nextCursor: OBJECT_ID };
  }
}

function request(context?: TrustedOrganizationRequestContext): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

function controller(service: FakeObjectsService): CurrentOrganizationObjectsController {
  return new CurrentOrganizationObjectsController(
    service as unknown as ObjectsService,
    new ContextAuthorizer(),
  );
}

function expectedResource(): Readonly<Record<string, unknown>> {
  return {
    id: OBJECT_ID,
    object_type_code: 'medical_device',
    parent_object_id: PARENT_OBJECT_ID,
    name: 'MRI Scanner 1',
    reference_code: 'MRI-001',
    serial_number: 'SN-001',
    description: 'Radiology asset',
    created_at: '2026-07-14T10:30:00.000Z',
  };
}

describe('CurrentOrganizationObjectsController', () => {
  it('creates an object only for the trusted current organization', async () => {
    const objects = new FakeObjectsService();
    const result = await controller(objects).create(
      request(CONTEXT),
      {},
      {
        object_type_code: ' medical_device ',
        parent_object_id: PARENT_OBJECT_ID,
        name: ' MRI Scanner 1 ',
        reference_code: ' mri-001 ',
        serial_number: ' SN-001 ',
        description: ' Radiology asset ',
      },
    );

    expect(objects.createContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(objects.createInput).toEqual({
      objectTypeCode: ' medical_device ',
      parentObjectId: PARENT_OBJECT_ID,
      name: ' MRI Scanner 1 ',
      referenceCode: ' mri-001 ',
      serialNumber: ' SN-001 ',
      description: ' Radiology asset ',
    });
    expect(result).toEqual({ success: true, data: expectedResource() });
    expect(result.data).not.toHaveProperty('tenant_id');
    expect(result.data).not.toHaveProperty('owning_organization_id');
    expect(result.data).not.toHaveProperty('object_type_id');
  });

  it('rejects every creation query parameter before invoking Objects', async () => {
    const objects = new FakeObjectsService();

    await expect(
      controller(objects).create(
        request(CONTEXT),
        { organization_id: ORGANIZATION_ID },
        { object_type_code: 'medical_device', name: 'MRI Scanner 1' },
      ),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
    expect(objects.createContext).toBeNull();
    expect(objects.createInput).toBeNull();
  });

  it('rejects unsupported body fields before invoking Objects', async () => {
    const objects = new FakeObjectsService();

    await expect(
      controller(objects).create(
        request(CONTEXT),
        {},
        {
          object_type_code: 'medical_device',
          name: 'MRI Scanner 1',
          tenant_id: TENANT_ID,
        },
      ),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
    expect(objects.createContext).toBeNull();
    expect(objects.createInput).toBeNull();
  });

  it('lists only trusted current-organization objects with bounded pagination', async () => {
    const objects = new FakeObjectsService();
    const result = await controller(objects).list(request(CONTEXT), {
      object_type_code: 'medical_device',
      limit: '25',
      after_id: OBJECT_ID,
    });

    expect(objects.listContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(objects.listQuery).toEqual({
      objectTypeCode: 'medical_device',
      limit: 25,
      afterId: OBJECT_ID,
    });
    expect(result).toEqual({
      success: true,
      data: { items: [expectedResource()], next_cursor: OBJECT_ID },
    });
  });

  it.each([
    ['create', { object_type_code: 'medical_device', name: 'MRI Scanner 1' }],
    ['list', {}],
  ] as const)(
    'fails closed without trusted organization context for %s',
    async (operation, input) => {
      const instance = controller(new FakeObjectsService());
      const promise =
        operation === 'create'
          ? instance.create(request(), {}, input)
          : instance.list(request(), input);

      await expect(promise).rejects.toMatchObject({
        code: 'HTTP_SECURITY_INVALID_INPUT',
        statusCode: 500,
      });
    },
  );

  it('declares trusted organization context, permissions, no-store, and creation status', () => {
    const listHandler = CurrentOrganizationObjectsController.prototype.list;
    const createHandler = CurrentOrganizationObjectsController.prototype.create;

    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, listHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, listHandler)).toEqual([
      OBJECT_PERMISSIONS.view,
    ]);
    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, createHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, createHandler)).toEqual([
      OBJECT_PERMISSIONS.create,
    ]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, createHandler)).toBe(201);

    for (const handler of [listHandler, createHandler]) {
      const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as readonly {
        readonly name: string;
        readonly value: string;
      }[];
      expect(headers).toContainEqual({
        name: 'Cache-Control',
        value: 'no-store',
      });
    }
  });
});
