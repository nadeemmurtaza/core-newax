import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import {
  CONTACT_PERMISSIONS,
  type AddOrganizationContactInput,
  type ContactsRequestContext,
  type ContactsService,
  type OrganizationContact,
  type OrganizationContactListQuery,
  type OrganizationContactPage,
} from '@newax/contacts';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';
import { describe, expect, it } from 'vitest';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CurrentOrganizationContactsController } from './current-organization-contacts.controller';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';
const CONTACT_ID = '00000000-0000-4000-8000-000000000006';
const CONTACT_METHOD_ID = '00000000-0000-4000-8000-000000000007';

const CONTEXT: TrustedOrganizationRequestContext = {
  scope: 'organization',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
  membershipId: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  permissionCodes: new Set([CONTACT_PERMISSIONS.create, CONTACT_PERMISSIONS.view]),
  evaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
};

const CONTACT: OrganizationContact = {
  id: CONTACT_ID,
  organizationId: ORGANIZATION_ID,
  contactMethodId: CONTACT_METHOD_ID,
  contactType: 'email',
  contactValue: 'operations@newax.co',
  isVerified: false,
  verifiedAt: null,
  label: 'Operations',
  isPrimary: true,
  status: 'active',
  validFrom: new Date('2026-07-12T00:00:00.000Z'),
  validUntil: null,
  createdAt: new Date('2026-07-12T10:30:00.000Z'),
};

class FakeContactsService {
  createContext: ContactsRequestContext | null = null;
  createInput: AddOrganizationContactInput | null = null;
  listContext: ContactsRequestContext | null = null;
  listQuery: OrganizationContactListQuery | null = null;

  async addCurrentOrganizationContact(
    context: ContactsRequestContext,
    input: AddOrganizationContactInput,
  ): Promise<OrganizationContact> {
    this.createContext = context;
    this.createInput = input;
    return CONTACT;
  }

  async listCurrentOrganizationContacts(
    context: ContactsRequestContext,
    query: OrganizationContactListQuery,
  ): Promise<OrganizationContactPage> {
    this.listContext = context;
    this.listQuery = query;
    return { items: [CONTACT], nextCursor: CONTACT_ID };
  }
}

function request(context?: TrustedOrganizationRequestContext): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

function controller(service: FakeContactsService): CurrentOrganizationContactsController {
  return new CurrentOrganizationContactsController(
    service as unknown as ContactsService,
    new ContextAuthorizer(),
  );
}

function expectedResource(): Readonly<Record<string, unknown>> {
  return {
    id: CONTACT_ID,
    type: 'email',
    value: 'operations@newax.co',
    label: 'Operations',
    is_primary: true,
    is_verified: false,
    verified_at: null,
    status: 'active',
    valid_from: '2026-07-12',
    valid_until: null,
    created_at: '2026-07-12T10:30:00.000Z',
  };
}

describe('CurrentOrganizationContactsController', () => {
  it('creates a contact only for the trusted current organization', async () => {
    const contacts = new FakeContactsService();
    const result = await controller(contacts).create(
      request(CONTEXT),
      {},
      {
        contact_type: 'email',
        contact_value: 'Operations@NEWAX.CO',
        label: 'Operations',
        is_primary: true,
        valid_from: '2026-07-12',
      },
    );

    expect(contacts.createContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(contacts.createInput).toEqual({
      contactType: 'email',
      contactValue: 'Operations@NEWAX.CO',
      label: 'Operations',
      isPrimary: true,
      validFrom: new Date('2026-07-12T00:00:00.000Z'),
    });
    expect(result).toEqual({ success: true, data: expectedResource() });
    expect(result.data).not.toHaveProperty('organization_id');
    expect(result.data).not.toHaveProperty('contact_method_id');
    expect(result.data).not.toHaveProperty('normalized_value');
  });

  it('rejects every creation query parameter before invoking Contacts', async () => {
    const contacts = new FakeContactsService();

    await expect(
      controller(contacts).create(
        request(CONTEXT),
        { organization_id: ORGANIZATION_ID },
        { contact_type: 'email', contact_value: 'operations@newax.co' },
      ),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
    expect(contacts.createContext).toBeNull();
    expect(contacts.createInput).toBeNull();
  });

  it('lists only trusted current-organization contacts with bounded pagination', async () => {
    const contacts = new FakeContactsService();
    const result = await controller(contacts).list(request(CONTEXT), {
      limit: '25',
      after_id: CONTACT_ID,
    });

    expect(contacts.listContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(contacts.listQuery).toEqual({ limit: 25, afterId: CONTACT_ID });
    expect(result).toEqual({
      success: true,
      data: { items: [expectedResource()], next_cursor: CONTACT_ID },
    });
  });

  it.each([
    ['create', { contact_type: 'email', contact_value: 'a@b.test' }],
    ['list', {}],
  ] as const)(
    'fails closed without trusted organization context for %s',
    async (operation, input) => {
      const instance = controller(new FakeContactsService());
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
    const listHandler = CurrentOrganizationContactsController.prototype.list;
    const createHandler = CurrentOrganizationContactsController.prototype.create;

    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, listHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, listHandler)).toEqual([
      CONTACT_PERMISSIONS.view,
    ]);
    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, createHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, createHandler)).toEqual([
      CONTACT_PERMISSIONS.create,
    ]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, createHandler)).toBe(201);

    for (const handler of [listHandler, createHandler]) {
      const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as readonly {
        readonly name: string;
        readonly value: string;
      }[];
      expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });
});
