import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaObjectsRepository } from './prisma-objects.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const RUN_ID = Date.now();

function name(suffix: string): string {
  return `Objects Integration ${suffix} ${RUN_ID}`;
}

describeWithDatabase('PrismaObjectsRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaObjectsRepository;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const objectIds: string[] = [];
  const objectTypeIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaObjectsRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreObject.updateMany({
      where: { id: { in: objectIds } },
      data: { parentObjectId: null },
    });
    await prisma.coreObject.deleteMany({ where: { id: { in: objectIds } } });
    await prisma.coreObjectType.deleteMany({ where: { id: { in: objectTypeIds } } });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('enforces Tenant ownership, same-Tenant hierarchy, uniqueness, and bounded reads', async () => {
    const firstTenant = await prisma.coreTenant.create({ data: { name: name('Tenant A') } });
    const secondTenant = await prisma.coreTenant.create({ data: { name: name('Tenant B') } });
    tenantIds.push(firstTenant.id, secondTenant.id);

    const parentOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        legalName: name('Parent Organization'),
        displayName: name('Parent'),
        organizationType: 'company',
      },
    });
    const childOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        legalName: name('Child Organization'),
        displayName: name('Child'),
        organizationType: 'branch',
      },
    });
    const foreignOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: secondTenant.id,
        legalName: name('Foreign Organization'),
        displayName: name('Foreign'),
        organizationType: 'company',
      },
    });
    organizationIds.push(parentOrganization.id, childOrganization.id, foreignOrganization.id);

    const typeCode = `connected.sensor-${String(RUN_ID)}`;
    const registered = await repository.registerObjectType({
      code: typeCode,
      name: name('Connected Sensor'),
      category: 'connected',
      description: 'Integration-test Object Type.',
    });
    expect(registered.status).toBe('created');
    if (registered.status !== 'created') {
      throw new Error('Expected Object Type creation.');
    }
    objectTypeIds.push(registered.objectType.id);

    await expect(
      repository.registerObjectType({
        code: typeCode,
        name: name('Duplicate Type'),
        category: 'connected',
        description: null,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    const parent = await repository.createOrganizationObject({
      tenantId: firstTenant.id,
      organizationId: parentOrganization.id,
      objectTypeCode: typeCode,
      parentObjectId: null,
      name: name('Parent Object'),
      referenceCode: `PARENT-${String(RUN_ID)}`,
      serialNumber: null,
      description: null,
    });
    expect(parent.status).toBe('created');
    if (parent.status !== 'created') {
      throw new Error('Expected parent Object creation.');
    }
    objectIds.push(parent.object.id);

    const child = await repository.createOrganizationObject({
      tenantId: firstTenant.id,
      organizationId: childOrganization.id,
      objectTypeCode: typeCode,
      parentObjectId: parent.object.id,
      name: name('Child Object'),
      referenceCode: `CHILD-${String(RUN_ID)}`,
      serialNumber: 'sensor-1',
      description: 'Same-Tenant child Object.',
    });
    expect(child.status).toBe('created');
    if (child.status !== 'created') {
      throw new Error('Expected same-Tenant child Object creation.');
    }
    objectIds.push(child.object.id);

    await expect(
      repository.createOrganizationObject({
        tenantId: secondTenant.id,
        organizationId: foreignOrganization.id,
        objectTypeCode: typeCode,
        parentObjectId: parent.object.id,
        name: name('Cross-Tenant Child'),
        referenceCode: `FOREIGN-${String(RUN_ID)}`,
        serialNumber: null,
        description: null,
      }),
    ).resolves.toEqual({ status: 'parent_unavailable' });

    await expect(
      repository.createOrganizationObject({
        tenantId: secondTenant.id,
        organizationId: childOrganization.id,
        objectTypeCode: typeCode,
        parentObjectId: null,
        name: name('Wrong Tenant'),
        referenceCode: null,
        serialNumber: null,
        description: null,
      }),
    ).resolves.toEqual({ status: 'organization_unavailable' });

    await expect(
      repository.createOrganizationObject({
        tenantId: firstTenant.id,
        organizationId: childOrganization.id,
        objectTypeCode: typeCode,
        parentObjectId: null,
        name: name('Duplicate Reference'),
        referenceCode: child.object.referenceCode,
        serialNumber: null,
        description: null,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    const page = await repository.listOrganizationObjects({
      tenantId: firstTenant.id,
      organizationId: childOrganization.id,
      objectTypeCode: typeCode,
      limit: 10,
    });
    expect(page.status).toBe('available');
    if (page.status !== 'available') {
      throw new Error('Expected current Organization Objects.');
    }
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: child.object.id,
      tenantId: firstTenant.id,
      owningOrganizationId: childOrganization.id,
      parentObjectId: parent.object.id,
    });

    await expect(
      repository.listOrganizationObjects({
        tenantId: firstTenant.id,
        organizationId: childOrganization.id,
        limit: 10,
        afterId: parent.object.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });

    await expect(
      prisma.coreObject.create({
        data: {
          tenantId: secondTenant.id,
          owningOrganizationId: foreignOrganization.id,
          objectTypeId: registered.objectType.id,
          parentObjectId: parent.object.id,
          name: name('Database Cross-Tenant Child'),
        },
      }),
    ).rejects.toThrow();
  });
});
