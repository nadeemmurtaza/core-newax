import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import {
  ADDRESS_PERMISSIONS,
  type AddressesService,
  type CreateOrganizationAddressInput,
  type OrganizationAddressListQuery,
  type OrganizationAddressPage,
  type OrganizationAddressRecord,
  type OrganizationAddressRequestContext,
} from '@newax/addresses';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';
import { describe, expect, it } from 'vitest';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CurrentOrganizationAddressesController } from './current-organization-addresses.controller';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const ADDRESS_LINK_ID = '00000000-0000-4000-8000-000000000006';
const ADDRESS_ID = '00000000-0000-4000-8000-000000000007';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';

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
  permissionCodes: new Set([ADDRESS_PERMISSIONS.create, ADDRESS_PERMISSIONS.view]),
  evaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
};

const ADDRESS: OrganizationAddressRecord = {
  id: ADDRESS_LINK_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  addressId: ADDRESS_ID,
  addressType: 'office',
  isPrimary: true,
  line1: 'NEWAX Tower',
  line2: 'Blue Area',
  city: 'Islamabad',
  stateRegion: 'Islamabad Capital Territory',
  postalCode: '44000',
  countryCode: 'PK',
  createdAt: new Date('2026-07-12T10:30:00.000Z'),
};

class FakeAddressesService {
  createContext: OrganizationAddressRequestContext | null = null;
  createInput: CreateOrganizationAddressInput | null = null;
  listContext: OrganizationAddressRequestContext | null = null;
  listQuery: OrganizationAddressListQuery | null = null;

  async addCurrentOrganizationAddress(
    context: OrganizationAddressRequestContext,
    input: CreateOrganizationAddressInput,
  ): Promise<OrganizationAddressRecord> {
    this.createContext = context;
    this.createInput = input;
    return ADDRESS;
  }

  async listCurrentOrganizationAddresses(
    context: OrganizationAddressRequestContext,
    query: OrganizationAddressListQuery,
  ): Promise<OrganizationAddressPage> {
    this.listContext = context;
    this.listQuery = query;
    return { items: [ADDRESS], nextCursor: ADDRESS_LINK_ID };
  }
}

function request(context?: TrustedOrganizationRequestContext): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

function controller(service: FakeAddressesService): CurrentOrganizationAddressesController {
  return new CurrentOrganizationAddressesController(
    service as unknown as AddressesService,
    new ContextAuthorizer(),
  );
}

function expectedResource(): Readonly<Record<string, unknown>> {
  return {
    id: ADDRESS_LINK_ID,
    address_type: 'office',
    is_primary: true,
    line_1: 'NEWAX Tower',
    line_2: 'Blue Area',
    city: 'Islamabad',
    state_region: 'Islamabad Capital Territory',
    postal_code: '44000',
    country_code: 'PK',
    created_at: '2026-07-12T10:30:00.000Z',
  };
}

describe('CurrentOrganizationAddressesController', () => {
  it('creates an address only for the trusted current organization', async () => {
    const addresses = new FakeAddressesService();
    const result = await controller(addresses).create(
      request(CONTEXT),
      {},
      {
        address_type: 'office',
        is_primary: true,
        line_1: ' NEWAX Tower ',
        line_2: 'Blue Area',
        city: 'Islamabad',
        state_region: 'Islamabad Capital Territory',
        postal_code: '44000',
        country_code: 'pk',
      },
    );

    expect(addresses.createContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(addresses.createInput).toEqual({
      addressType: 'office',
      isPrimary: true,
      line1: ' NEWAX Tower ',
      line2: 'Blue Area',
      city: 'Islamabad',
      stateRegion: 'Islamabad Capital Territory',
      postalCode: '44000',
      countryCode: 'pk',
    });
    expect(result).toEqual({ success: true, data: expectedResource() });
    expect(result.data).not.toHaveProperty('tenant_id');
    expect(result.data).not.toHaveProperty('organization_id');
    expect(result.data).not.toHaveProperty('address_id');
  });

  it('rejects every creation query parameter before invoking Addresses', async () => {
    const addresses = new FakeAddressesService();

    await expect(
      controller(addresses).create(
        request(CONTEXT),
        { organization_id: ORGANIZATION_ID },
        {
          address_type: 'office',
          is_primary: true,
          line_1: 'NEWAX Tower',
          city: 'Islamabad',
          country_code: 'PK',
        },
      ),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
    expect(addresses.createContext).toBeNull();
    expect(addresses.createInput).toBeNull();
  });

  it('rejects unsupported body fields before invoking Addresses', async () => {
    const addresses = new FakeAddressesService();

    await expect(
      controller(addresses).create(
        request(CONTEXT),
        {},
        {
          address_type: 'office',
          is_primary: true,
          line_1: 'NEWAX Tower',
          city: 'Islamabad',
          country_code: 'PK',
          tenant_id: TENANT_ID,
        },
      ),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
    expect(addresses.createContext).toBeNull();
    expect(addresses.createInput).toBeNull();
  });

  it('lists only trusted current-organization addresses with bounded pagination', async () => {
    const addresses = new FakeAddressesService();
    const result = await controller(addresses).list(request(CONTEXT), {
      address_type: 'office',
      limit: '25',
      after_id: ADDRESS_LINK_ID,
    });

    expect(addresses.listContext).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(addresses.listQuery).toEqual({
      addressType: 'office',
      limit: 25,
      afterId: ADDRESS_LINK_ID,
    });
    expect(result).toEqual({
      success: true,
      data: { items: [expectedResource()], next_cursor: ADDRESS_LINK_ID },
    });
  });

  it.each([
    [
      'create',
      {
        address_type: 'office',
        is_primary: true,
        line_1: 'NEWAX Tower',
        city: 'Islamabad',
        country_code: 'PK',
      },
    ],
    ['list', {}],
  ] as const)(
    'fails closed without trusted organization context for %s',
    async (operation, input) => {
      const instance = controller(new FakeAddressesService());
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
    const listHandler = CurrentOrganizationAddressesController.prototype.list;
    const createHandler = CurrentOrganizationAddressesController.prototype.create;

    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, listHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, listHandler)).toEqual([
      ADDRESS_PERMISSIONS.view,
    ]);
    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, createHandler)).toBe('organization');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, createHandler)).toEqual([
      ADDRESS_PERMISSIONS.create,
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
