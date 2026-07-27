import { describe, expect, it } from 'vitest';

import type { AddressRepository } from '../src/database/address-repository';
import type { AddressEvent, AddressEventPublisher } from '../src/events/address-event';
import { ADDRESS_PERMISSIONS } from '../src/permissions/address-permissions';
import { AddressesService } from '../src/services/addresses.service';
import type {
  CreateOrganizationAddressRecordInput,
  CreateOrganizationAddressResult,
  ListOrganizationAddressesRecordInput,
  ListOrganizationAddressesResult,
  OrganizationAddressRecord,
  OrganizationAddressRequestContext,
} from '../src/types/address';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const LINK_ID = '00000000-0000-4000-8000-000000000004';
const ADDRESS_ID = '00000000-0000-4000-8000-000000000005';
const CREATED_AT = new Date('2026-07-12T00:00:00.000Z');

function context(...permissionCodes: readonly string[]): OrganizationAddressRequestContext {
  return {
    actorUserId: USER_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    permissionCodes: new Set(permissionCodes),
  };
}

function record(overrides: Partial<OrganizationAddressRecord> = {}): OrganizationAddressRecord {
  return {
    id: LINK_ID,
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    addressId: ADDRESS_ID,
    addressType: 'office',
    isPrimary: true,
    line1: 'Office 9, NEWAX Tower',
    line2: null,
    city: 'Islamabad',
    stateRegion: 'Islamabad Capital Territory',
    postalCode: '44000',
    countryCode: 'PK',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

class FakeAddressRepository implements AddressRepository {
  createResult: CreateOrganizationAddressResult = {
    status: 'created',
    address: record(),
  };
  listResult: ListOrganizationAddressesResult = {
    status: 'available',
    items: [record()],
    nextCursor: null,
  };
  createInput: CreateOrganizationAddressRecordInput | null = null;
  listInput: ListOrganizationAddressesRecordInput | null = null;

  async createOrganizationAddress(
    input: CreateOrganizationAddressRecordInput,
  ): Promise<CreateOrganizationAddressResult> {
    this.createInput = input;
    return this.createResult;
  }

  async listOrganizationAddresses(
    input: ListOrganizationAddressesRecordInput,
  ): Promise<ListOrganizationAddressesResult> {
    this.listInput = input;
    return this.listResult;
  }
}

class RecordingPublisher implements AddressEventPublisher {
  readonly events: AddressEvent[] = [];

  async publish(event: AddressEvent): Promise<void> {
    this.events.push(event);
  }
}

function fixture(): {
  readonly service: AddressesService;
  readonly repository: FakeAddressRepository;
  readonly publisher: RecordingPublisher;
} {
  const repository = new FakeAddressRepository();
  const publisher = new RecordingPublisher();
  return {
    service: new AddressesService(repository, publisher),
    repository,
    publisher,
  };
}

describe('AddressesService', () => {
  it('normalizes and creates a tenant-bound organization address without exposing address text in events', async () => {
    const test = fixture();

    const created = await test.service.addCurrentOrganizationAddress(
      context(ADDRESS_PERMISSIONS.create),
      {
        addressType: 'office',
        isPrimary: true,
        line1: '  Office 9,   NEWAX Tower  ',
        line2: '  Blue Area  ',
        city: '  Islamabad ',
        stateRegion: ' Islamabad Capital Territory ',
        postalCode: ' 44000 ',
        countryCode: ' pk ',
      },
    );

    expect(created).toEqual(record());
    expect(test.repository.createInput).toMatchObject({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      addressType: 'office',
      isPrimary: true,
      line1: 'Office 9, NEWAX Tower',
      line2: 'Blue Area',
      city: 'Islamabad',
      stateRegion: 'Islamabad Capital Territory',
      postalCode: '44000',
      countryCode: 'PK',
    });
    expect(test.repository.createInput?.canonicalKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(test.publisher.events).toEqual([
      {
        name: 'address.created',
        actorUserId: USER_ID,
        tenantId: TENANT_ID,
        organizationId: ORGANIZATION_ID,
        organizationAddressId: LINK_ID,
        addressId: ADDRESS_ID,
        addressType: 'office',
        isPrimary: true,
        occurredAt: expect.any(Date),
      },
    ]);
    expect(JSON.stringify(test.publisher.events)).not.toContain('NEWAX Tower');
  });

  it('rejects unsupported types, malformed country codes, and missing permission', async () => {
    const test = fixture();

    await expect(
      test.service.addCurrentOrganizationAddress(context(), {
        addressType: 'office',
        isPrimary: false,
        line1: 'Office 9',
        city: 'Islamabad',
        countryCode: 'PK',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_FORBIDDEN' });

    await expect(
      test.service.addCurrentOrganizationAddress(context(ADDRESS_PERMISSIONS.create), {
        addressType: 'home' as never,
        isPrimary: false,
        line1: 'Office 9',
        city: 'Islamabad',
        countryCode: 'PK',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_INVALID_INPUT' });

    await expect(
      test.service.addCurrentOrganizationAddress(context(ADDRESS_PERMISSIONS.create), {
        addressType: 'office',
        isPrimary: false,
        line1: 'Office 9',
        city: 'Islamabad',
        countryCode: 'PAK',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_INVALID_INPUT' });
  });

  it('maps repository availability and duplicate conflicts to controlled module errors', async () => {
    const test = fixture();

    test.repository.createResult = { status: 'organization_unavailable' };
    await expect(
      test.service.addCurrentOrganizationAddress(context(ADDRESS_PERMISSIONS.create), {
        addressType: 'office',
        isPrimary: false,
        line1: 'Office 9',
        city: 'Islamabad',
        countryCode: 'PK',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_ORGANIZATION_UNAVAILABLE' });

    test.repository.createResult = { status: 'conflict' };
    await expect(
      test.service.addCurrentOrganizationAddress(context(ADDRESS_PERMISSIONS.create), {
        addressType: 'office',
        isPrimary: false,
        line1: 'Office 9',
        city: 'Islamabad',
        countryCode: 'PK',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_CONFLICT' });
  });

  it('lists bounded records and validates the returned tenant and organization', async () => {
    const test = fixture();

    await expect(
      test.service.listCurrentOrganizationAddresses(context(ADDRESS_PERMISSIONS.view), {
        addressType: 'office',
        limit: 20,
        afterId: LINK_ID,
      }),
    ).resolves.toEqual({ items: [record()], nextCursor: null });

    expect(test.repository.listInput).toEqual({
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      addressType: 'office',
      limit: 20,
      afterId: LINK_ID,
    });

    test.repository.listResult = {
      status: 'available',
      items: [record({ tenantId: '00000000-0000-4000-8000-000000000099' })],
      nextCursor: null,
    };
    await expect(
      test.service.listCurrentOrganizationAddresses(context(ADDRESS_PERMISSIONS.view)),
    ).rejects.toMatchObject({ code: 'ADDRESS_INTEGRITY_FAILURE' });
  });

  it('rejects a foreign cursor and malformed trusted context', async () => {
    const test = fixture();
    test.repository.listResult = { status: 'cursor_invalid' };

    await expect(
      test.service.listCurrentOrganizationAddresses(context(ADDRESS_PERMISSIONS.view), {
        afterId: LINK_ID,
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_CURSOR_INVALID' });

    await expect(
      test.service.listCurrentOrganizationAddresses(
        { ...context(ADDRESS_PERMISSIONS.view), tenantId: 'not-a-uuid' },
        {},
      ),
    ).rejects.toMatchObject({ code: 'ADDRESS_INVALID_INPUT' });
  });
});
