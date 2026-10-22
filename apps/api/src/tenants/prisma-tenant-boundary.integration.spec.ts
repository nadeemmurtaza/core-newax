import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;

function name(suffix: string): string {
  return `Tenant Boundary ${suffix} ${Date.now()}`;
}

describeWithDatabase('Tenant and organization PostgreSQL boundary', () => {
  let prisma: PrismaClient;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const relationshipIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreOrganizationRelationship.deleteMany({
      where: { id: { in: relationshipIds } },
    });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('gives tenants independent IDs and rejects cross-tenant organization structure', async () => {
    const firstTenant = await prisma.coreTenant.create({ data: { name: name('Customer A') } });
    const secondTenant = await prisma.coreTenant.create({ data: { name: name('Customer B') } });
    tenantIds.push(firstTenant.id, secondTenant.id);
    expect(firstTenant.id).not.toBe(secondTenant.id);

    const firstOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        legalName: name('Company A'),
        displayName: name('A'),
        organizationType: 'company',
      },
    });
    const secondOrganization = await prisma.coreOrganization.create({
      data: {
        tenantId: secondTenant.id,
        legalName: name('Company B'),
        displayName: name('B'),
        organizationType: 'company',
      },
    });
    organizationIds.push(firstOrganization.id, secondOrganization.id);

    const branch = await prisma.coreOrganization.create({
      data: {
        tenantId: firstTenant.id,
        parentOrganizationId: firstOrganization.id,
        legalName: name('Branch A'),
        displayName: name('Branch A'),
        organizationType: 'branch',
      },
    });
    organizationIds.push(branch.id);
    expect(branch.tenantId).toBe(firstTenant.id);

    await expect(
      prisma.coreOrganization.create({
        data: {
          tenantId: secondTenant.id,
          parentOrganizationId: firstOrganization.id,
          legalName: name('Invalid Branch'),
          displayName: name('Invalid Branch'),
          organizationType: 'branch',
        },
      }),
    ).rejects.toBeDefined();

    await expect(
      prisma.coreOrganizationRelationship.create({
        data: {
          tenantId: firstTenant.id,
          sourceOrganizationId: firstOrganization.id,
          targetOrganizationId: secondOrganization.id,
          relationshipType: 'affiliate',
        },
      }),
    ).rejects.toBeDefined();

    const relationship = await prisma.coreOrganizationRelationship.create({
      data: {
        tenantId: firstTenant.id,
        sourceOrganizationId: firstOrganization.id,
        targetOrganizationId: branch.id,
        relationshipType: 'operates',
      },
    });
    relationshipIds.push(relationship.id);
    expect(relationship.tenantId).toBe(firstTenant.id);
  });
});
