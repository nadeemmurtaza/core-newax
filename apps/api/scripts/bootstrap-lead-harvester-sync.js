#!/usr/bin/env node
'use strict';

/**
 * One-time, idempotent bootstrap for the Lead Harvester integration's service account.
 *
 * This is deliberately NOT wired through the normal @newax/access-control /
 * @newax/organizations service layer: those services require an already-authorized
 * actor to call registerPermission()/createRole()/assignRole(), and there is no
 * authorized actor yet the very first time this runs. Every other codepath in the
 * application still goes through the real services — this script only exists to
 * create the one root grant those services would otherwise have nothing to build on.
 *
 * Run with: node apps/api/scripts/bootstrap-lead-harvester-sync.js
 * Requires: DATABASE_URL in the environment, and `pnpm --filter api run db:generate`
 * to have been run at least once so ../src/generated/prisma/client exists.
 */

// This script is deliberately CommonJS (see header above).
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('../src/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
/* eslint-enable @typescript-eslint/no-require-imports */

// Named for the data's owner (NEWAX's own market-intelligence dataset), not the
// ingestion tool -- externalSystem/domainCode on each CoreExternalReference already
// say a record came from Lead Harvester specifically. Future sources (health,
// education, other directories) should land real-world organizations in this same
// tenant rather than each getting a source-named silo.
const TENANT_NAME = 'NEWAX Market Intelligence';
const SYSTEM_ORG_LEGAL_NAME = 'NEWAX Market Intelligence System Account';
const SYSTEM_ORG_DISPLAY_NAME = 'NEWAX Market Intelligence — System';
const SERVICE_ACCOUNT_NAME = 'Lead Harvester Sync Integration';
const SERVICE_ACCOUNT_DESCRIPTION =
  'Machine identity for the Lead Harvester webhook integration. Not a person — see ADR 0035.';
const ROLE_CODE = 'lead-harvester-integration';
const ROLE_NAME = 'Lead Harvester Integration';

// packages/contacts reuses the same contacts.create/contacts.update/contacts.view
// codes for both organization and person contacts (addCurrentPersonContact /
// updateCurrentPersonContact) -- there is no separate person_contacts.* code.
const REQUIRED_PERMISSIONS = [
  {
    code: 'organizations.create',
    moduleCode: 'organizations',
    resource: 'organizations',
    action: 'create',
  },
  {
    code: 'organizations.update',
    moduleCode: 'organizations',
    resource: 'organizations',
    action: 'update',
  },
  {
    code: 'organizations.view',
    moduleCode: 'organizations',
    resource: 'organizations',
    action: 'view',
  },
  { code: 'addresses.create', moduleCode: 'addresses', resource: 'addresses', action: 'create' },
  { code: 'addresses.update', moduleCode: 'addresses', resource: 'addresses', action: 'update' },
  { code: 'addresses.view', moduleCode: 'addresses', resource: 'addresses', action: 'view' },
  { code: 'contacts.create', moduleCode: 'contacts', resource: 'contacts', action: 'create' },
  { code: 'contacts.update', moduleCode: 'contacts', resource: 'contacts', action: 'update' },
  { code: 'contacts.view', moduleCode: 'contacts', resource: 'contacts', action: 'view' },
  { code: 'people.create', moduleCode: 'people', resource: 'people', action: 'create' },
  { code: 'people.update', moduleCode: 'people', resource: 'people', action: 'update' },
  { code: 'people.view', moduleCode: 'people', resource: 'people', action: 'view' },
  {
    code: 'memberships.create',
    moduleCode: 'memberships',
    resource: 'memberships',
    action: 'create',
  },
  {
    code: 'memberships.update',
    moduleCode: 'memberships',
    resource: 'memberships',
    action: 'update',
  },
  { code: 'memberships.view', moduleCode: 'memberships', resource: 'memberships', action: 'view' },
  {
    code: 'external_references.register',
    moduleCode: 'external_references',
    resource: 'external_references',
    action: 'register',
  },
  {
    code: 'external_references.view',
    moduleCode: 'external_references',
    resource: 'external_references',
    action: 'view',
  },
  {
    code: 'lead_harvester_sync.ingest',
    moduleCode: 'lead_harvester_sync',
    resource: 'lead_harvester_sync',
    action: 'ingest',
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the bootstrap script.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Advisory lock so concurrent/re-triggered runs (CI, multiple deploys) don't race.
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended('bootstrap|lead-harvester-sync', 0))",
      );

      const tenant = await findOrCreateTenant(tx);
      const systemOrganization = await findOrCreateSystemOrganization(tx, tenant.id);
      const { serviceAccount, user } = await findOrCreateServiceAccount(tx, tenant.id);
      const permissions = await findOrCreatePermissions(tx);
      const role = await findOrCreateRole(tx, systemOrganization.id);
      await findOrCreateRolePermissions(tx, role.id, permissions);
      const membership = await findOrCreateMembership(tx, serviceAccount.id, systemOrganization.id);
      await findOrCreateMembershipRole(tx, membership.id, role.id);

      return { tenant, systemOrganization, user, membership };
    });

    console.log('Lead Harvester sync bootstrap complete. Put these into your env config:');
    console.log(`LEAD_HARVESTER_TENANT_ID=${result.tenant.id}`);
    console.log(`LEAD_HARVESTER_SERVICE_USER_ID=${result.user.id}`);
    console.log(`LEAD_HARVESTER_SERVICE_MEMBERSHIP_ID=${result.membership.id}`);
    console.log(`# (system organization ${result.systemOrganization.id} anchors the service`);
    console.log('#  account membership only; it is not the parent of synced institutions.)');
  } finally {
    await prisma.$disconnect();
  }
}

async function findOrCreateTenant(tx) {
  const existing = await tx.coreTenant.findFirst({ where: { name: TENANT_NAME } });
  if (existing) {
    return existing;
  }
  return tx.coreTenant.create({ data: { name: TENANT_NAME, status: 'active' } });
}

async function findOrCreateSystemOrganization(tx, tenantId) {
  const existing = await tx.coreOrganization.findFirst({
    where: { tenantId, displayName: SYSTEM_ORG_DISPLAY_NAME },
  });
  if (existing) {
    return existing;
  }
  return tx.coreOrganization.create({
    data: {
      tenantId,
      legalName: SYSTEM_ORG_LEGAL_NAME,
      displayName: SYSTEM_ORG_DISPLAY_NAME,
      organizationType: 'system_integration',
      status: 'active',
    },
  });
}

async function findOrCreateServiceAccount(tx, tenantId) {
  const existingServiceAccount = await tx.coreServiceAccount.findFirst({
    where: { tenantId, name: SERVICE_ACCOUNT_NAME },
  });
  const serviceAccount =
    existingServiceAccount ??
    (await tx.coreServiceAccount.create({
      data: {
        tenantId,
        name: SERVICE_ACCOUNT_NAME,
        description: SERVICE_ACCOUNT_DESCRIPTION,
        status: 'active',
      },
    }));

  const existingUser = await tx.coreUser.findUnique({
    where: { serviceAccountId: serviceAccount.id },
  });
  const user =
    existingUser ??
    (await tx.coreUser.create({
      data: { serviceAccountId: serviceAccount.id, status: 'active' },
    }));

  if (user.status !== 'active') {
    throw new Error(
      `CoreUser ${user.id} for the Lead Harvester service account is not active; ` +
        'the external-references repository requires an active user before it will ' +
        'register a mapping. Activate it before using this integration.',
    );
  }

  return { serviceAccount, user };
}

async function findOrCreatePermissions(tx) {
  const permissions = [];
  for (const permission of REQUIRED_PERMISSIONS) {
    const existing = await tx.corePermission.findUnique({ where: { code: permission.code } });
    if (existing) {
      permissions.push(existing);
      continue;
    }
    permissions.push(
      await tx.corePermission.create({
        data: {
          code: permission.code,
          moduleCode: permission.moduleCode,
          resource: permission.resource,
          action: permission.action,
          riskLevel: 'standard',
          status: 'active',
        },
      }),
    );
  }
  return permissions;
}

// PermissionEvaluator.evaluateMembershipPermissions only resolves grants
// through roles where roleType === 'organization' and role.organizationId
// matches the membership's own organizationId (packages/access-control's
// Prisma repository query is scoped that way) -- a global roleType: 'system'
// role with organizationId: null is never evaluated by any real code path.
// So this role must live on the same umbrella system organization the
// service account's own membership anchors to, exactly like any other
// organization-scoped role.
async function findOrCreateRole(tx, systemOrganizationId) {
  const existing = await tx.coreRole.findFirst({
    where: { organizationId: systemOrganizationId, code: ROLE_CODE },
  });
  if (existing) {
    return existing;
  }
  return tx.coreRole.create({
    data: {
      organizationId: systemOrganizationId,
      code: ROLE_CODE,
      name: ROLE_NAME,
      description:
        'Role granting the Lead Harvester webhook integration exactly the ' +
        'permissions it needs to sync institutions, addresses, contacts, and people. ' +
        "Assigned only to the integration's own service-account membership, not " +
        'assignable to human memberships through the normal role UI.',
      roleType: 'organization',
      status: 'active',
    },
  });
}

async function findOrCreateRolePermissions(tx, roleId, permissions) {
  for (const permission of permissions) {
    const existing = await tx.coreRolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
    });
    if (existing) {
      continue;
    }
    await tx.coreRolePermission.create({
      data: { roleId, permissionId: permission.id, effect: 'allow' },
    });
  }
}

async function findOrCreateMembership(tx, serviceAccountId, organizationId) {
  const existing = await tx.coreMembership.findFirst({
    where: { serviceAccountId, organizationId },
  });
  if (existing) {
    return existing;
  }
  return tx.coreMembership.create({
    data: {
      serviceAccountId,
      organizationId,
      membershipType: 'system',
      status: 'active',
    },
  });
}

async function findOrCreateMembershipRole(tx, membershipId, roleId) {
  const existing = await tx.coreMembershipRole.findFirst({
    where: { membershipId, roleId, revokedAt: null },
  });
  if (existing) {
    return existing;
  }
  return tx.coreMembershipRole.create({ data: { membershipId, roleId } });
}

main().catch((error) => {
  console.error('Lead Harvester sync bootstrap failed:', error);
  process.exitCode = 1;
});
