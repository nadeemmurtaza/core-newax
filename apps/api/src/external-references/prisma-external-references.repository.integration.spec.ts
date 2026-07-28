import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaExternalReferencesRepository } from './prisma-external-references.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const RUN_ID = Date.now();

function name(suffix: string): string {
  return `External References Integration ${suffix} ${String(RUN_ID)}`;
}

function externalKey(suffix: string): string {
  return `external/${String(RUN_ID)}/${suffix}`;
}

describeWithDatabase('PrismaExternalReferencesRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaExternalReferencesRepository;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const personIds: string[] = [];
  const userIds: string[] = [];
  const externalReferenceIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaExternalReferencesRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreExternalReference.deleteMany({
      where: { id: { in: externalReferenceIds } },
    });
    await prisma.coreUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.corePerson.deleteMany({ where: { id: { in: personIds } } });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('enforces scoped uniqueness, trusted ownership, actor availability, and bounded reads', async () => {
    const firstTenant = await prisma.coreTenant.create({ data: { name: name('Tenant A') } });
    const secondTenant = await prisma.coreTenant.create({ data: { name: name('Tenant B') } });
    tenantIds.push(firstTenant.id, secondTenant.id);

    const firstOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        legalName: name('Organization A'),
        displayName: name('Org A'),
        organizationType: 'company',
      },
    });
    const secondOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: secondTenant.id,
        legalName: name('Organization B'),
        displayName: name('Org B'),
        organizationType: 'company',
      },
    });
    organizationIds.push(firstOrganization.id, secondOrganization.id);

    const person = await prisma.corePerson.create({
      data: { firstName: 'External', lastName: name('Registrar') },
    });
    personIds.push(person.id);
    const actor = await prisma.coreUser.create({
      data: { personId: person.id, status: 'active' },
    });
    userIds.push(actor.id);

    const sharedExternalKey = externalKey('shared');
    const registrationInput = {
      actorUserId: actor.id,
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      domainCode: 'lms',
      entityType: 'student.profile',
      entityId: `Student-${String(RUN_ID)}`,
      externalSystem: 'integration.sis',
      externalKey: sharedExternalKey,
    } as const;

    const concurrent = await Promise.all([
      repository.registerOrganizationExternalReference(registrationInput),
      repository.registerOrganizationExternalReference(registrationInput),
    ]);
    expect(concurrent.map((result) => result.status).sort()).toEqual(['conflict', 'created']);
    const created = concurrent.find((result) => result.status === 'created');
    if (created?.status !== 'created') {
      throw new Error('Expected one External Reference registration.');
    }
    externalReferenceIds.push(created.externalReference.id);
    expect(created.externalReference).toMatchObject({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      domainCode: 'lms',
      entityType: 'student.profile',
      entityId: `Student-${String(RUN_ID)}`,
      externalSystem: 'integration.sis',
      externalKey: sharedExternalKey,
    });
    expect(created.externalReference).not.toHaveProperty('metadata');

    const separatelyScoped = await repository.registerOrganizationExternalReference({
      ...registrationInput,
      tenantId: secondTenant.id,
      organizationId: secondOrganization.id,
    });
    expect(separatelyScoped.status).toBe('created');
    if (separatelyScoped.status !== 'created') {
      throw new Error('Expected the same external key to be available in another Organization.');
    }
    externalReferenceIds.push(separatelyScoped.externalReference.id);

    await expect(
      repository.registerOrganizationExternalReference({
        ...registrationInput,
        tenantId: secondTenant.id,
        externalKey: externalKey('wrong-tenant'),
      }),
    ).resolves.toEqual({ status: 'organization_unavailable' });

    await expect(
      repository.registerOrganizationExternalReference({
        ...registrationInput,
        actorUserId: '00000000-0000-4000-8000-000000000099',
        externalKey: externalKey('missing-actor'),
      }),
    ).resolves.toEqual({ status: 'actor_unavailable' });

    const globalReference = await prisma.coreExternalReference.create({
      data: {
        domainCode: 'platform',
        entityType: 'global.fixture',
        entityId: String(RUN_ID),
        externalSystem: 'integration.fixture',
        externalKey: externalKey('global'),
      },
    });
    externalReferenceIds.push(globalReference.id);

    const page = await repository.listOrganizationExternalReferences({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current Organization External References.');
    }
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(created.externalReference.id);

    await expect(
      repository.listOrganizationExternalReferences({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        limit: 10,
        afterId: separatelyScoped.externalReference.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });

    await expect(
      prisma.coreExternalReference.create({
        data: {
          tenantId: secondTenant.id,
          organizationId: firstOrganization.id,
          domainCode: 'lms',
          entityType: 'student.profile',
          entityId: `Cross-Tenant-${String(RUN_ID)}`,
          externalSystem: 'integration.sis',
          externalKey: externalKey('cross-tenant'),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.coreExternalReference.create({
        data: {
          organizationId: firstOrganization.id,
          domainCode: 'lms',
          entityType: 'student.profile',
          entityId: `Missing-Tenant-${String(RUN_ID)}`,
          externalSystem: 'integration.sis',
          externalKey: externalKey('missing-tenant'),
        },
      }),
    ).rejects.toThrow();
  });
});
