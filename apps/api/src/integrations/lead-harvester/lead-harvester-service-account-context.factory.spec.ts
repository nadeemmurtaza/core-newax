import type { ConfigService } from '@nestjs/config';
import type { PermissionEvaluator } from '@newax/access-control';
import { describe, expect, it } from 'vitest';

import type { ApplicationEnvironment } from '../../config/environment';
import {
  LeadHarvesterIntegrationNotConfiguredError,
  LeadHarvesterServiceAccountContextFactory,
} from './lead-harvester-service-account-context.factory';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const SERVICE_USER_ID = '22222222-2222-2222-2222-222222222222';
const SERVICE_MEMBERSHIP_ID = '33333333-3333-3333-3333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-4444-444444444444';

function configService(
  values: Partial<{
    LEAD_HARVESTER_TENANT_ID: string;
    LEAD_HARVESTER_SERVICE_USER_ID: string;
    LEAD_HARVESTER_SERVICE_MEMBERSHIP_ID: string;
  }>,
): ConfigService<ApplicationEnvironment, true> {
  return {
    get: (key: string) => (values as Record<string, string | undefined>)[key],
  } as unknown as ConfigService<ApplicationEnvironment, true>;
}

function fakePermissionEvaluator(effectivePermissionCodes: readonly string[]): PermissionEvaluator {
  return {
    evaluate: async (membershipId: string) => {
      expect(membershipId).toBe(SERVICE_MEMBERSHIP_ID);
      return {
        membershipId,
        organizationId: 'some-organization-id',
        evaluatedAt: new Date(),
        allowedPermissionCodes: effectivePermissionCodes,
        deniedPermissionCodes: [],
        effectivePermissionCodes,
      };
    },
  } as unknown as PermissionEvaluator;
}

const validConfig = {
  LEAD_HARVESTER_TENANT_ID: TENANT_ID,
  LEAD_HARVESTER_SERVICE_USER_ID: SERVICE_USER_ID,
  LEAD_HARVESTER_SERVICE_MEMBERSHIP_ID: SERVICE_MEMBERSHIP_ID,
};

describe('LeadHarvesterServiceAccountContextFactory', () => {
  it('builds a tenant context from the evaluated permission grant', async () => {
    const factory = new LeadHarvesterServiceAccountContextFactory(
      configService(validConfig),
      fakePermissionEvaluator(['organizations.create', 'organizations.update']),
    );

    const context = await factory.buildTenantContext();

    expect(context.actorUserId).toBe(SERVICE_USER_ID);
    expect(context.tenantId).toBe(TENANT_ID);
    expect(context.permissionCodes.has('organizations.create')).toBe(true);
    expect(context.permissionCodes.has('organizations.update')).toBe(true);
    expect(context.permissionCodes.has('organizations.archive')).toBe(false);
  });

  it('builds an organization context scoped to the given organization', async () => {
    const factory = new LeadHarvesterServiceAccountContextFactory(
      configService(validConfig),
      fakePermissionEvaluator(['addresses.create']),
    );

    const context = await factory.buildOrganizationContext(ORGANIZATION_ID);

    expect(context.organizationId).toBe(ORGANIZATION_ID);
    expect(context.tenantId).toBe(TENANT_ID);
    expect(context.permissionCodes.has('addresses.create')).toBe(true);
  });

  it('reflects an empty evaluation as no permissions, not a thrown error', async () => {
    const factory = new LeadHarvesterServiceAccountContextFactory(
      configService(validConfig),
      fakePermissionEvaluator([]),
    );

    const context = await factory.buildTenantContext();

    expect(context.permissionCodes.size).toBe(0);
  });

  it('throws when the integration is not configured', async () => {
    const factory = new LeadHarvesterServiceAccountContextFactory(
      configService({}),
      fakePermissionEvaluator(['organizations.create']),
    );

    await expect(factory.buildTenantContext()).rejects.toThrow(
      LeadHarvesterIntegrationNotConfiguredError,
    );
  });

  it('throws when only some configuration values are set', async () => {
    const factory = new LeadHarvesterServiceAccountContextFactory(
      configService({ LEAD_HARVESTER_TENANT_ID: TENANT_ID }),
      fakePermissionEvaluator(['organizations.create']),
    );

    await expect(factory.buildTenantContext()).rejects.toThrow(
      LeadHarvesterIntegrationNotConfiguredError,
    );
  });
});
