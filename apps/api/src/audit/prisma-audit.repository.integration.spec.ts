import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RecordTrustedAuditEntryRecordInput } from '@newax/audit';

import type { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaAuditRepository } from './prisma-audit.repository';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;
const RUN_ID = Date.now();

function name(suffix: string): string {
  return 'Audit Integration ' + suffix + ' ' + String(RUN_ID);
}

function recordInput(
  overrides: Partial<RecordTrustedAuditEntryRecordInput> = {},
): RecordTrustedAuditEntryRecordInput {
  return {
    tenantId: null,
    organizationId: null,
    actorUserId: null,
    moduleCode: 'integration',
    action: 'integration.audit.recorded',
    entityType: 'integration_record',
    entityId: 'record-' + String(RUN_ID),
    outcome: 'success',
    sensitivity: 'standard',
    metadata: { source: 'postgresql-integration' },
    correlationId: null,
    requestId: null,
    ipAddress: null,
    userAgent: null,
    occurredAt: new Date('2026-07-14T09:00:00.000Z'),
    ...overrides,
  };
}

describeWithDatabase('PrismaAuditRepository PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaAuditRepository;
  const tenantIds: string[] = [];
  const organizationIds: string[] = [];
  const personIds: string[] = [];
  const userIds: string[] = [];
  const auditIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL! }) });
    await prisma.$connect();
    repository = new PrismaAuditRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma === undefined) {
      return;
    }
    await prisma.coreAuditLog.deleteMany({ where: { id: { in: auditIds } } });
    await prisma.coreUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.corePerson.deleteMany({ where: { id: { in: personIds } } });
    await prisma.coreOrganization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.coreTenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('resolves Tenant ownership, enforces cross-Tenant scope, and paginates safely', async () => {
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
      data: { firstName: 'Audit', lastName: name('Actor') },
    });
    personIds.push(person.id);
    const actor = await prisma.coreUser.create({
      data: { personId: person.id, status: 'active' },
    });
    userIds.push(actor.id);

    const global = await repository.recordTrustedEntry(
      recordInput({ action: 'integration.audit.global' }),
    );
    const tenantScoped = await repository.recordTrustedEntry(
      recordInput({
        tenantId: firstTenant.id,
        action: 'integration.audit.tenant',
      }),
    );
    if (global.status !== 'created' || tenantScoped.status !== 'created') {
      throw new Error('Expected global and Tenant Audit entries.');
    }
    auditIds.push(global.entry.id, tenantScoped.entry.id);
    expect(global.entry).toMatchObject({ tenantId: null, organizationId: null });
    expect(tenantScoped.entry).toMatchObject({
      tenantId: firstTenant.id,
      organizationId: null,
    });

    const older = await repository.recordTrustedEntry(
      recordInput({
        organizationId: firstOrganization.id,
        actorUserId: actor.id,
        action: 'integration.audit.older',
        occurredAt: new Date('2026-07-14T09:00:00.000Z'),
      }),
    );
    const newer = await repository.recordTrustedEntry(
      recordInput({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        actorUserId: actor.id,
        action: 'integration.audit.newer',
        occurredAt: new Date('2026-07-14T10:00:00.000Z'),
      }),
    );
    if (older.status !== 'created' || newer.status !== 'created') {
      throw new Error('Expected Organization Audit entries.');
    }
    auditIds.push(older.entry.id, newer.entry.id);
    expect(older.entry).toMatchObject({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      actorUserId: actor.id,
    });
    expect(older.entry).not.toHaveProperty('metadata');
    expect(older.entry).not.toHaveProperty('ipAddress');
    expect(older.entry).not.toHaveProperty('userAgent');

    await expect(
      repository.recordTrustedEntry(
        recordInput({
          tenantId: secondTenant.id,
          organizationId: firstOrganization.id,
        }),
      ),
    ).resolves.toEqual({ status: 'scope_unavailable' });
    await expect(
      repository.recordTrustedEntry(
        recordInput({
          tenantId: firstTenant.id,
          actorUserId: '00000000-0000-4000-8000-000000000099',
        }),
      ),
    ).resolves.toEqual({ status: 'actor_unavailable' });

    const foreign = await repository.recordTrustedEntry(
      recordInput({
        organizationId: secondOrganization.id,
        action: 'integration.audit.foreign',
      }),
    );
    if (foreign.status !== 'created') {
      throw new Error('Expected foreign Organization Audit entry.');
    }
    auditIds.push(foreign.entry.id);

    const firstPage = await repository.listOrganizationEntries({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      limit: 1,
    });
    expect(firstPage.status).toBe('available');
    if (firstPage.status !== 'available') {
      throw new Error('Expected first Audit page.');
    }
    expect(firstPage.items.map((item) => item.id)).toEqual([newer.entry.id]);
    expect(firstPage.nextCursor).toBe(newer.entry.id);

    const secondPage = await repository.listOrganizationEntries({
      tenantId: firstTenant.id,
      organizationId: firstOrganization.id,
      limit: 1,
      afterId: firstPage.nextCursor!,
    });
    expect(secondPage).toMatchObject({
      status: 'available',
      nextCursor: null,
    });
    if (secondPage.status !== 'available') {
      throw new Error('Expected second Audit page.');
    }
    expect(secondPage.items.map((item) => item.id)).toEqual([older.entry.id]);

    await expect(
      repository.listOrganizationEntries({
        tenantId: firstTenant.id,
        organizationId: firstOrganization.id,
        limit: 10,
        afterId: foreign.entry.id,
      }),
    ).resolves.toEqual({ status: 'cursor_invalid' });

    await expect(
      prisma.coreAuditLog.create({
        data: {
          tenantId: secondTenant.id,
          organizationId: firstOrganization.id,
          moduleCode: 'integration',
          action: 'integration.audit.cross_tenant',
          entityType: 'integration_record',
          outcome: 'failed',
          sensitivity: 'security',
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.coreAuditLog.create({
        data: {
          tenantId: null,
          organizationId: firstOrganization.id,
          moduleCode: 'integration',
          action: 'integration.audit.missing_tenant',
          entityType: 'integration_record',
          outcome: 'failed',
          sensitivity: 'security',
        },
      }),
    ).rejects.toThrow();
  });
});
