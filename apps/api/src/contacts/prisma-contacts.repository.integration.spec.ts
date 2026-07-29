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
const UPDATE_OLD_EMAIL = `contacts-update-old-${Date.now()}@newax.test`;
const UPDATE_NEW_EMAIL = `contacts-update-new-${Date.now()}@newax.test`;
const UPDATE_CONFLICT_EMAIL = `contacts-update-conflict-${Date.now()}@newax.test`;
const PERSON_EMAIL = `contacts-person-${Date.now()}@newax.test`;
const PERSON_DUPLICATE_EMAIL = `contacts-person-dup-${Date.now()}@newax.test`;
const PERSON_UPDATE_EMAIL = `contacts-person-update-${Date.now()}@newax.test`;

function organizationName(suffix: string): string {
  return `Contacts Integration ${suffix} ${Date.now()}`;
}

describeWithDatabase('PrismaContactsRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaContactsRepository;
  const organizationIds: string[] = [];
  const tenantIds: string[] = [];
  const personIds: string[] = [];
  const normalizedValues = [
    EMAIL,
    SECOND_EMAIL,
    THIRD_EMAIL,
    FOURTH_EMAIL,
    UPDATE_OLD_EMAIL,
    UPDATE_NEW_EMAIL,
    UPDATE_CONFLICT_EMAIL,
    PERSON_EMAIL,
    PERSON_DUPLICATE_EMAIL,
    PERSON_UPDATE_EMAIL,
    '+923001234567',
    '+923001234999',
  ];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaContactsRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.corePersonContactMethod.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.corePerson.deleteMany({ where: { id: { in: personIds } } });
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

  it('updates in place for an unchanged value and relinks without mutating the shared contact method for a changed one', async () => {
    const tenant = await prisma.coreTenant.create({
      data: { name: organizationName('Update Tenant') },
    });
    tenantIds.push(tenant.id);
    const organization = await prisma.coreOrganization.create({
      data: {
        tenantId: tenant.id,
        legalName: organizationName('Update Org'),
        displayName: organizationName('Update Org display'),
        organizationType: 'company',
      },
    });
    organizationIds.push(organization.id);

    const created = await repository.createOrganizationContact({
      organizationId: organization.id,
      contactType: 'email',
      contactValue: UPDATE_OLD_EMAIL,
      normalizedValue: UPDATE_OLD_EMAIL,
      label: 'Original',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    if (created.status !== 'created') {
      throw new Error('Expected the contact to be created.');
    }

    const metadataOnly = await repository.updateOrganizationContact({
      organizationId: organization.id,
      contactId: created.contact.id,
      contactType: 'email',
      contactValue: UPDATE_OLD_EMAIL,
      normalizedValue: UPDATE_OLD_EMAIL,
      label: 'Renamed',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(metadataOnly).toMatchObject({ status: 'updated', relinked: false });
    if (metadataOnly.status !== 'updated') {
      throw new Error('Expected the metadata-only update to succeed.');
    }
    expect(metadataOnly.contact.id).toBe(created.contact.id);
    expect(metadataOnly.contact.contactMethodId).toBe(created.contact.contactMethodId);
    expect(metadataOnly.contact.label).toBe('Renamed');

    const relinked = await repository.updateOrganizationContact({
      organizationId: organization.id,
      contactId: created.contact.id,
      contactType: 'email',
      contactValue: UPDATE_NEW_EMAIL,
      normalizedValue: UPDATE_NEW_EMAIL,
      label: 'Renamed',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(relinked).toMatchObject({ status: 'updated', relinked: true });
    if (relinked.status !== 'updated') {
      throw new Error('Expected the relink update to succeed.');
    }
    expect(relinked.contact.id).not.toBe(created.contact.id);
    expect(relinked.contact.contactMethodId).not.toBe(created.contact.contactMethodId);
    expect(relinked.contact.normalizedValue).toBe(UPDATE_NEW_EMAIL);

    const retiredLink = await prisma.coreOrganizationContactMethod.findUniqueOrThrow({
      where: { id: created.contact.id },
    });
    expect(retiredLink.status).toBe('removed');

    const originalContactMethod = await prisma.coreContactMethod.findUniqueOrThrow({
      where: { id: created.contact.contactMethodId },
    });
    expect(originalContactMethod.normalizedValue).toBe(UPDATE_OLD_EMAIL);

    const page = await repository.listOrganizationContacts({
      organizationId: organization.id,
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current organization contacts to be available.');
    }
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(relinked.contact.id);

    const conflictingContact = await repository.createOrganizationContact({
      organizationId: organization.id,
      contactType: 'email',
      contactValue: UPDATE_CONFLICT_EMAIL,
      normalizedValue: UPDATE_CONFLICT_EMAIL,
      label: 'Conflict target',
      isPrimary: false,
      validFrom: null,
      validUntil: null,
    });
    if (conflictingContact.status !== 'created') {
      throw new Error('Expected the conflict-target contact to be created.');
    }

    await expect(
      repository.updateOrganizationContact({
        organizationId: organization.id,
        contactId: relinked.contact.id,
        contactType: 'email',
        contactValue: UPDATE_CONFLICT_EMAIL,
        normalizedValue: UPDATE_CONFLICT_EMAIL,
        label: 'Attempted relink into an existing link',
        isPrimary: false,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    await expect(
      repository.updateOrganizationContact({
        organizationId: organization.id,
        contactId: '00000000-0000-4000-8000-000000000099',
        contactType: 'email',
        contactValue: UPDATE_OLD_EMAIL,
        normalizedValue: UPDATE_OLD_EMAIL,
        label: null,
        isPrimary: false,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'contact_unavailable' });
  });

  it('creates person contacts, dedupes the shared contact method, and rejects a missing person', async () => {
    const person = await prisma.corePerson.create({
      data: { firstName: 'Contacts', lastName: organizationName('Person') },
    });
    personIds.push(person.id);

    const created = await repository.createPersonContact({
      personId: person.id,
      contactType: 'whatsapp',
      contactValue: '+923001234567',
      normalizedValue: '+923001234567',
      label: 'Primary',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(created.status).toBe('created');
    if (created.status !== 'created') {
      throw new Error('Expected the person contact to be created.');
    }
    expect(created.contact.personId).toBe(person.id);

    await expect(
      repository.createPersonContact({
        personId: person.id,
        contactType: 'whatsapp',
        contactValue: '+923001234567',
        normalizedValue: '+923001234567',
        label: 'Duplicate',
        isPrimary: false,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    const anotherPerson = await prisma.corePerson.create({
      data: { firstName: 'Contacts', lastName: organizationName('Second Person') },
    });
    personIds.push(anotherPerson.id);
    const shared = await repository.createPersonContact({
      personId: anotherPerson.id,
      contactType: 'email',
      contactValue: PERSON_EMAIL,
      normalizedValue: PERSON_EMAIL,
      label: null,
      isPrimary: false,
      validFrom: null,
      validUntil: null,
    });
    expect(shared.status).toBe('created');

    await expect(
      repository.createPersonContact({
        personId: '00000000-0000-4000-8000-000000000099',
        contactType: 'email',
        contactValue: PERSON_DUPLICATE_EMAIL,
        normalizedValue: PERSON_DUPLICATE_EMAIL,
        label: null,
        isPrimary: false,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'person_unavailable' });
  });

  it('relinks a person contact to a new value without mutating the shared contact method', async () => {
    const person = await prisma.corePerson.create({
      data: { firstName: 'Contacts', lastName: organizationName('Update Person') },
    });
    personIds.push(person.id);

    const created = await repository.createPersonContact({
      personId: person.id,
      contactType: 'email',
      contactValue: PERSON_UPDATE_EMAIL,
      normalizedValue: PERSON_UPDATE_EMAIL,
      label: 'Original',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    if (created.status !== 'created') {
      throw new Error('Expected the person contact to be created.');
    }

    const relinked = await repository.updatePersonContact({
      personId: person.id,
      contactId: created.contact.id,
      contactType: 'whatsapp',
      contactValue: '+923001234999',
      normalizedValue: '+923001234999',
      label: 'Original',
      isPrimary: true,
      validFrom: null,
      validUntil: null,
    });
    expect(relinked).toMatchObject({ status: 'updated', relinked: true });
    if (relinked.status !== 'updated') {
      throw new Error('Expected the relink update to succeed.');
    }
    expect(relinked.contact.id).not.toBe(created.contact.id);

    const retiredLink = await prisma.corePersonContactMethod.findUniqueOrThrow({
      where: { id: created.contact.id },
    });
    expect(retiredLink.status).toBe('removed');

    const originalContactMethod = await prisma.coreContactMethod.findUniqueOrThrow({
      where: { id: created.contact.contactMethodId },
    });
    expect(originalContactMethod.normalizedValue).toBe(PERSON_UPDATE_EMAIL);

    await expect(
      repository.updatePersonContact({
        personId: '00000000-0000-4000-8000-000000000099',
        contactId: relinked.contact.id,
        contactType: 'whatsapp',
        contactValue: '+923001234999',
        normalizedValue: '+923001234999',
        label: 'Original',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'person_unavailable' });

    await expect(
      repository.updatePersonContact({
        personId: person.id,
        contactId: '00000000-0000-4000-8000-000000000099',
        contactType: 'whatsapp',
        contactValue: '+923001234999',
        normalizedValue: '+923001234999',
        label: 'Original',
        isPrimary: true,
        validFrom: null,
        validUntil: null,
      }),
    ).resolves.toEqual({ status: 'contact_unavailable' });
  });
});
