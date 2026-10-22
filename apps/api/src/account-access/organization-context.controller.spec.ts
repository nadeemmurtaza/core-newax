import { describe, expect, it } from 'vitest';

import type {
  OrganizationContextConfirmation,
  OrganizationContextConfirmationService,
  TrustedOrganizationRequestContext,
} from '@newax/request-context';

import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { OrganizationContextController } from './organization-context.controller';

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

class FakeConfirmationService {
  context: TrustedOrganizationRequestContext | null = null;

  async confirm(
    context: TrustedOrganizationRequestContext,
  ): Promise<OrganizationContextConfirmation> {
    this.context = context;
    return {
      membershipId: MEMBERSHIP_ID,
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      organizationDisplayName: 'NEWAX Academy',
      organizationType: 'education',
      membershipType: 'lecturer',
      jobTitle: 'Senior Lecturer',
      sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
      permissionsEvaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
      capabilities: {
        organizationView: true,
        organizationManage: false,
        peopleView: false,
        peopleManage: false,
        membershipsView: false,
        membershipsManage: false,
        usersView: false,
        usersManage: false,
        accessControlView: false,
        accessControlManage: false,
      },
    };
  }
}

function request(context?: TrustedOrganizationRequestContext): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

describe('OrganizationContextController', () => {
  it('returns minimal organization confirmation without raw authority data', async () => {
    const confirmation = new FakeConfirmationService();
    const controller = new OrganizationContextController(
      confirmation as unknown as OrganizationContextConfirmationService,
    );

    const result = await controller.get(request(CONTEXT));

    expect(confirmation.context).toBe(CONTEXT);
    expect(result).toEqual({
      success: true,
      data: {
        context_scope: 'organization',
        tenant_id: TENANT_ID,
        membership_id: MEMBERSHIP_ID,
        organization: {
          id: ORGANIZATION_ID,
          display_name: 'NEWAX Academy',
          type: 'education',
        },
        membership: {
          type: 'lecturer',
          job_title: 'Senior Lecturer',
        },
        session_expires_at: '2026-07-12T12:00:00.000Z',
        permissions_evaluated_at: '2026-07-12T10:00:00.000Z',
        capabilities: {
          organization_view: true,
          organization_manage: false,
          people_view: false,
          people_manage: false,
          memberships_view: false,
          memberships_manage: false,
          users_view: false,
          users_manage: false,
          access_control_view: false,
          access_control_manage: false,
        },
      },
    });
    expect(result.data).not.toHaveProperty('permission_codes');
    expect(result.data).not.toHaveProperty('roles');
    expect(result.data).not.toHaveProperty('user_id');
    expect(result.data).not.toHaveProperty('person_id');
    expect(result.data).not.toHaveProperty('session_id');
  });

  it('fails closed without trusted organization context', async () => {
    const controller = new OrganizationContextController(
      new FakeConfirmationService() as unknown as OrganizationContextConfirmationService,
    );

    await expect(controller.get(request())).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 500,
    });
  });
});
