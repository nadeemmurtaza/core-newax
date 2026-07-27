import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaFilesRepository } from './prisma-files.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const RUN_ID = Date.now();
const CHECKSUM = `sha256:${'a'.repeat(64)}`;

function name(suffix: string): string {
  return `Files Integration ${suffix} ${String(RUN_ID)}`;
}

function storageKey(suffix: string): string {
  return `integration/${String(RUN_ID)}/${suffix}`;
}

describeWithDatabase('PrismaFilesRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaFilesRepository;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const personIds: string[] = [];
  const userIds: string[] = [];
  const fileIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaFilesRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreFile.deleteMany({ where: { id: { in: fileIds } } });
    await prisma.coreUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.corePerson.deleteMany({ where: { id: { in: personIds } } });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('enforces Tenant ownership, actor availability, locator uniqueness, and bounded reads', async () => {
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
      data: { firstName: 'File', lastName: name('Registrar') },
    });
    personIds.push(person.id);
    const actor = await prisma.coreUser.create({
      data: { personId: person.id, status: 'active' },
    });
    userIds.push(actor.id);

    const locator = storageKey('shared-locator');
    const registrationInput = {
      actorUserId: actor.id,
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      storageProvider: 'integration.store',
      storageKey: locator,
      fileName: 'Board Pack.pdf',
      mimeType: 'application/pdf',
      fileSize: 1_024n,
      checksum: CHECKSUM,
    } as const;

    const concurrent = await Promise.all([
      repository.registerOrganizationFile(registrationInput),
      repository.registerOrganizationFile(registrationInput),
    ]);
    expect(concurrent.map((result) => result.status).sort()).toEqual(['conflict', 'created']);
    const created = concurrent.find((result) => result.status === 'created');
    if (created?.status !== 'created') {
      throw new Error('Expected one File registration.');
    }
    fileIds.push(created.file.id);
    expect(created.file).toMatchObject({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      fileName: 'Board Pack.pdf',
      mimeType: 'application/pdf',
      fileSize: 1_024n,
    });
    expect(created.file).not.toHaveProperty('storageProvider');
    expect(created.file).not.toHaveProperty('storageKey');
    expect(created.file).not.toHaveProperty('checksum');

    await expect(
      repository.registerOrganizationFile({
        ...registrationInput,
        tenantId: secondTenant.id,
        organizationId: secondOrganization.id,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    await expect(
      repository.registerOrganizationFile({
        ...registrationInput,
        tenantId: secondTenant.id,
      }),
    ).resolves.toEqual({ status: 'organization_unavailable' });

    await expect(
      repository.registerOrganizationFile({
        ...registrationInput,
        actorUserId: '00000000-0000-4000-8000-000000000099',
        storageKey: storageKey('missing-actor'),
      }),
    ).resolves.toEqual({ status: 'actor_unavailable' });

    const foreignFile = await prisma.coreFile.create({
      data: {
        tenantId: secondTenant.id,
        organizationId: secondOrganization.id,
        storageProvider: 'integration.store',
        storageKey: storageKey('foreign-file'),
        fileName: 'Foreign.pdf',
        mimeType: 'application/pdf',
        fileSize: 2_048n,
        checksum: CHECKSUM,
        createdByUserId: actor.id,
      },
    });
    fileIds.push(foreignFile.id);

    const page = await repository.listOrganizationFiles({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current Organization Files.');
    }
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(created.file.id);

    await expect(
      repository.listOrganizationFiles({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        limit: 10,
        afterId: foreignFile.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });

    await prisma.coreFile.update({
      where: { id: created.file.id },
      data: { status: 'removed' },
    });
    await expect(
      repository.listOrganizationFiles({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        limit: 10,
      }),
    ).resolves.toEqual({ status: 'available', items: [], nextCursor: null });

    await expect(
      prisma.coreFile.create({
        data: {
          tenantId: secondTenant.id,
          organizationId: firstOrganization.id,
          storageProvider: 'integration.store',
          storageKey: storageKey('cross-tenant'),
          fileName: 'Cross Tenant.pdf',
          mimeType: 'application/pdf',
          fileSize: 1n,
          checksum: CHECKSUM,
          createdByUserId: actor.id,
        },
      }),
    ).rejects.toThrow();
  });
});
