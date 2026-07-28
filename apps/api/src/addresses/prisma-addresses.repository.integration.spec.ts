import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaAddressesRepository } from './prisma-addresses.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const RUN_ID = Date.now();

function organizationName(suffix: string): string {
  return `Addresses Integration ${suffix} ${RUN_ID}`;
}

function addressInput(
  tenantId: string,
  organizationId: string,
  suffix: string,
  overrides: Partial<{
    readonly addressType: 'office' | 'billing';
    readonly isPrimary: boolean;
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly stateRegion: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  }> = {},
) {
  const line1 = overrides.line1 ?? `Office ${suffix}, NEWAX Tower`;
  const line2 = overrides.line2 === undefined ? 'Blue Area' : overrides.line2;
  const city = overrides.city ?? 'Islamabad';
  const stateRegion =
    overrides.stateRegion === undefined ? 'Islamabad Capital Territory' : overrides.stateRegion;
  const postalCode = overrides.postalCode === undefined ? '44000' : overrides.postalCode;
  const countryCode = overrides.countryCode ?? 'PK';
  return {
    tenantId,
    organizationId,
    addressType: overrides.addressType ?? 'office',
    isPrimary: overrides.isPrimary ?? true,
    line1,
    line2,
    city,
    stateRegion,
    postalCode,
    countryCode,
    canonicalKey: [line1, line2 ?? '', city, stateRegion ?? '', postalCode ?? '', countryCode]
      .join('\u001f')
      .toLowerCase(),
  };
}

describeWithDatabase('PrismaAddressesRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaAddressesRepository;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const addressIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaAddressesRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreOrganizationAddress.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.coreAddress.deleteMany({ where: { id: { in: addressIds } } });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('reuses canonical addresses, enforces tenant boundaries, and keeps one active primary per type', async () => {
    const firstTenant = await prisma.coreTenant.create({
      data: { name: organizationName('Tenant A') },
    });
    const secondTenant = await prisma.coreTenant.create({
      data: { name: organizationName('Tenant B') },
    });
    tenantIds.push(firstTenant.id, secondTenant.id);

    const firstOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        legalName: organizationName('Organization A'),
        displayName: organizationName('A'),
        organizationType: 'company',
      },
    });
    const secondOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: secondTenant.id,
        legalName: organizationName('Organization B'),
        displayName: organizationName('B'),
        organizationType: 'company',
      },
    });
    organizationIds.push(firstOrganization.id, secondOrganization.id);

    const first = await repository.createOrganizationAddress(
      addressInput(firstTenant.id, firstOrganization.id, 'Shared'),
    );
    expect(first.status).toBe('created');
    if (first.status !== 'created') {
      throw new Error('Expected the first address to be created.');
    }
    addressIds.push(first.address.addressId);

    const shared = await repository.createOrganizationAddress(
      addressInput(secondTenant.id, secondOrganization.id, 'Shared', {
        line1: 'office shared, newax tower',
        line2: 'blue area',
        city: 'islamabad',
        stateRegion: 'islamabad capital territory',
        postalCode: '44000',
      }),
    );
    expect(shared.status).toBe('created');
    if (shared.status !== 'created') {
      throw new Error('Expected the shared canonical address to be linked.');
    }
    expect(shared.address.addressId).toBe(first.address.addressId);

    const duplicate = await repository.createOrganizationAddress(
      addressInput(firstTenant.id, firstOrganization.id, 'Shared'),
    );
    expect(duplicate).toEqual({ status: 'conflict' });

    await expect(
      repository.createOrganizationAddress(
        addressInput(secondTenant.id, firstOrganization.id, 'Foreign tenant'),
      ),
    ).resolves.toEqual({ status: 'organization_unavailable' });

    const concurrent = await Promise.all([
      repository.createOrganizationAddress(
        addressInput(firstTenant.id, firstOrganization.id, 'Primary A'),
      ),
      repository.createOrganizationAddress(
        addressInput(firstTenant.id, firstOrganization.id, 'Primary B'),
      ),
    ]);
    expect(concurrent.every((result) => result.status === 'created')).toBe(true);
    for (const result of concurrent) {
      if (result.status === 'created') {
        addressIds.push(result.address.addressId);
      }
    }

    const page = await repository.listOrganizationAddresses({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      addressType: 'office',
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current organization addresses to be available.');
    }
    expect(page.items).toHaveLength(3);
    expect(page.items.filter((address) => address.isPrimary)).toHaveLength(1);
    expect(
      page.items.every(
        (address) =>
          address.tenantId === firstTenant.id && address.organizationId === firstOrganization.id,
      ),
    ).toBe(true);

    await prisma.coreOrganizationAddress.update({
      where: { id: first.address.id },
      data: { status: 'removed', isPrimary: true },
    });

    const replacementAfterRemoval = await repository.createOrganizationAddress(
      addressInput(firstTenant.id, firstOrganization.id, 'Shared'),
    );
    expect(replacementAfterRemoval.status).toBe('created');
    if (replacementAfterRemoval.status !== 'created') {
      throw new Error('Expected an active primary to replace a removed primary.');
    }
    addressIds.push(replacementAfterRemoval.address.addressId);
    expect(replacementAfterRemoval.address.id).not.toBe(first.address.id);
    expect(replacementAfterRemoval.address.addressId).toBe(first.address.addressId);

    await expect(
      prisma.coreOrganizationAddress.create({
        data: {
          organizationId: firstOrganization.id,
          addressId: first.address.addressId,
          addressType: 'office',
          isPrimary: false,
          status: 'active',
        },
      }),
    ).rejects.toThrow();

    const afterRemoval = await repository.listOrganizationAddresses({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      addressType: 'office',
      limit: 10,
    });
    expect(afterRemoval.status).toBe('available');
    if (afterRemoval.status !== 'available') {
      throw new Error('Expected active organization addresses after removal.');
    }
    expect(afterRemoval.items).toHaveLength(3);
    expect(afterRemoval.items.map((address) => address.id)).not.toContain(first.address.id);
    expect(afterRemoval.items.filter((address) => address.isPrimary)).toHaveLength(1);
    expect(
      afterRemoval.items.find((address) => address.id === replacementAfterRemoval.address.id)
        ?.isPrimary,
    ).toBe(true);

    const foreignCursor = await prisma.coreOrganizationAddress.findFirst({
      where: { organizationId: secondOrganization.id },
      select: { id: true },
    });
    if (foreignCursor === null) {
      throw new Error('Expected a foreign organization address cursor.');
    }
    await expect(
      repository.listOrganizationAddresses({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        limit: 10,
        afterId: foreignCursor.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });
  });
});
