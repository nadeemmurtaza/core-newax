import { describe, expect, it } from 'vitest';

import type {
  CurrentOrganizationProfile,
  CurrentOrganizationRequestContext,
  OrganizationsService,
} from '@newax/organizations';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CurrentOrganizationController } from './current-organization.controller';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';

const CONTEXT: TrustedOrganizationRequestContext = {
  scope: 'organization',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
  membershipId: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  permissionCodes: new Set(['organizations.view']),
  evaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
};

const PROFILE: CurrentOrganizationProfile = {
  id: ORGANIZATION_ID,
  tenantId: TENANT_ID,
  legalName: 'NEWAX (SMC-PRIVATE) LIMITED',
  displayName: 'NEWAX',
  organizationType: 'company',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

class FakeOrganizationsService {
  context: CurrentOrganizationRequestContext | null = null;

  async getCurrent(
    context: CurrentOrganizationRequestContext,
  ): Promise<CurrentOrganizationProfile> {
    this.context = context;
    return PROFILE;
  }
}

function request(context?: TrustedOrganizationRequestContext): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

describe('CurrentOrganizationController', () => {
  it('reads the organization only from trusted request context', async () => {
    const organizations = new FakeOrganizationsService();
    const controller = new CurrentOrganizationController(
      organizations as unknown as OrganizationsService,
      new ContextAuthorizer(),
    );

    const result = await controller.get(request(CONTEXT), {});

    expect(organizations.context).toEqual({
      actorUserId: USER_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      permissionCodes: CONTEXT.permissionCodes,
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: ORGANIZATION_ID,
        tenant_id: TENANT_ID,
        legal_name: 'NEWAX (SMC-PRIVATE) LIMITED',
        display_name: 'NEWAX',
        type: 'company',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
    });
    expect(result.data).not.toHaveProperty('registration_number');
    expect(result.data).not.toHaveProperty('tax_number');
    expect(result.data).not.toHaveProperty('parent_organization_id');
  });

  it('rejects every query parameter, including organization identifiers', async () => {
    const controller = new CurrentOrganizationController(
      new FakeOrganizationsService() as unknown as OrganizationsService,
      new ContextAuthorizer(),
    );

    await expect(
      controller.get(request(CONTEXT), { organization_id: ORGANIZATION_ID }),
    ).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
  });

  it('fails closed without trusted organization context', async () => {
    const controller = new CurrentOrganizationController(
      new FakeOrganizationsService() as unknown as OrganizationsService,
      new ContextAuthorizer(),
    );

    await expect(controller.get(request(), {})).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 500,
    });
  });
});
