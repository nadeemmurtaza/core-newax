import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { PrismaContactsRepository } from './prisma-contacts.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const EMAIL = `contacts-${Date.now()}@newax.test`;
const SECOND_EMAIL = `contacts-secondary-${Date.now()}@newax.test`;
const THIRD_EMAIL = `contacts-third-${Date.now()}@newax.test`;
const FOURTH_EMAIL = `contacts-fourth-${Date.now()}@newax.test`;

function organizationName(suffix: string): string {
  return `Contacts Integration ${suffix} ${Date.now()}`;
}

describeWithDatabase('PrismaContactsRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaContactsRepository;
  const organizationIds: string[] = [];
  const tenantIds: string[] = [];
  const normalizedValues = [EMAIL, SECOND_EMAIL, THIRD_EMAIL, FOURTH_EMAIL];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaContactsRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreOrganizationContactMethod.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.coreContactMethod.deleteMany({
      where: { normalizedValue: { in: normalizedValues } },
    });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('serializes duplicates, reuses global methods across organizations, and replaces primaries', async () => {
    const tenant = await prisma.coreTenant.create({ data: { name: organizationName('Tenant') } });
    tenantIds.push(tenant.id);
    const firstOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: tenant.id,
        legalName: organizationName('A'),
        displayName: organizationName('A display'),
        organizationType: 'company',
      },
    });
    const secondOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: tenant.id,
        legalName: organizationName('B'),
        displayName: organizationName('B display'),
        organizationType: 'company',
      },
    });
    organizationIds.push(firstOrganization.id, secondOrganization.id);

    const duplicateResults = await Promise.all([
      repository.createOrganizationContact({
        organizationId: firstOrganization.id,
        contactType: 'email',
        contactValue: EMAIL,
        normalizedValue: EMAIL,
        label: 'General',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
      repository.createOrganizationContact({
        organizationId: firstOrganization.id,
        contactType: 'email',
        contactValue: EMAIL,
        normalizedValue: EMAIL,
        label: 'General',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
    ]);

    expect(duplicateResults.map((result) => result.status).sort()).toEqual(['conflict', 'created']);
    const firstCreated = duplicateResults.find((result) => result.status === 'created');
    expect(firstCreated?.status).toBe('created');
    if (firstCreated?.status !== 'created') {
      throw new Error('Expected the first organization contact to be created.');
    }

    await prisma.coreContactMethod.update({
      where: { id: firstCreated.contact.contactMethodId },
      data: {
        isVerified: true,
        verifiedAt: new Date('2026-07-12T10:00:00.000Z'),
      },
    });

    const shared = await repository.createOrganizationContact({
      organizationId: secondOrganization.id,
      contactType: 'email',
      contactValue: EMAIL,
      normalizedValue: EMAIL,
      label: 'General',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(shared.status).toBe('created');
    if (shared.status !== 'created') {
      throw new Error('Expected the second organization contact to be created.');
    }
    expect(shared.contact.contactMethodId).toBe(firstCreated.contact.contactMethodId);
    expect(shared.contact.isVerified).toBe(false);
    expect(shared.contact.verifiedAt).toBeNull();

    const sharedPage = await repository.listOrganizationContacts({
      organizationId: secondOrganization.id,
      limit: 10,
    });
    expect(sharedPage.status).toBe('available');
    if (sharedPage.status !== 'available') {
      throw new Error('Expected shared organization contacts to be available.');
    }
    expect(sharedPage.items).toHaveLength(1);
    expect(sharedPage.items[0]).toMatchObject({
      isVerified: false,
      verifiedAt: null,
    });

    await prisma.coreOrganizationContactMethod.update({
      where: { id: shared.contact.id },
      data: { status: 'removed' },
    });
    await expect(
      repository.createOrganizationContact({
        organizationId: secondOrganization.id,
        contactType: 'email',
        contactValue: EMAIL,
        normalizedValue: EMAIL,
        label: 'Re-add removed link',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    const replacement = await repository.createOrganizationContact({
      organizationId: firstOrganization.id,
      contactType: 'email',
      contactValue: SECOND_EMAIL,
      normalizedValue: SECOND_EMAIL,
      label: 'Billing',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(replacement.status).toBe('created');

    const page = await repository.listOrganizationContacts({
      organizationId: firstOrganization.id,
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current organization contacts to be available.');
    }
    expect(page.items).toHaveLength(2);
    expect(page.items.filter((contact) => contact.isPrimary)).toHaveLength(1);
    expect(page.items.find((contact) => contact.normalizedValue === SECOND_EMAIL)?.isPrimary).toBe(
      true,
    );
    expect(page.items.every((contact) => contact.organizationId === firstOrganization.id)).toBe(
      true,
    );

    const concurrentPrimaryResults = await Promise.all([
      repository.createOrganizationContact({
        organizationId: firstOrganization.id,
        contactType: 'email',
        contactValue: THIRD_EMAIL,
        normalizedValue: THIRD_EMAIL,
        label: 'Concurrent A',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
      repository.createOrganizationContact({
        organizationId: firstOrganization.id,
        contactType: 'email',
        contactValue: FOURTH_EMAIL,
        normalizedValue: FOURTH_EMAIL,
        label: 'Concurrent B',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
    ]);
    expect(concurrentPrimaryResults.every((result) => result.status === 'created')).toBe(true);

    const afterConcurrentPrimaries = await repository.listOrganizationContacts({
      organizationId: firstOrganization.id,
      limit: 10,
    });
    expect(afterConcurrentPrimaries.status).toBe('available');
    if (afterConcurrentPrimaries.status !== 'available') {
      throw new Error('Expected contacts after concurrent primary creation.');
    }
    expect(afterConcurrentPrimaries.items.filter((contact) => contact.isPrimary)).toHaveLength(1);

    const foreignCursor = await prisma.coreOrganizationContactMethod.findFirst({
      where: { organizationId: secondOrganization.id },
      select: { id: true },
    });
    if (foreignCursor === null) {
      throw new Error('Expected a foreign organization contact cursor.');
    }
    await expect(
      repository.listOrganizationContacts({
        organizationId: firstOrganization.id,
        limit: 10,
        afterId: foreignCursor.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });
  });
});
