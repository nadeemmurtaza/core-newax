import { Controller, Get, Header, Inject, Req } from '@nestjs/common';
import { HttpSecurityError } from '@newax/http-security';
import {
  OrganizationContextConfirmationService,
  type TrustedOrganizationRequestContext,
} from '@newax/request-context';

import { OrganizationContextEndpoint } from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';

interface OrganizationContextCapabilitiesResponse {
  readonly organization_view: boolean;
  readonly organization_manage: boolean;
  readonly people_view: boolean;
  readonly people_manage: boolean;
  readonly memberships_view: boolean;
  readonly memberships_manage: boolean;
  readonly users_view: boolean;
  readonly users_manage: boolean;
  readonly access_control_view: boolean;
  readonly access_control_manage: boolean;
}

interface OrganizationContextConfirmationResponse {
  readonly success: true;
  readonly data: {
    readonly context_scope: 'organization';
    readonly tenant_id: string;
    readonly membership_id: string;
    readonly organization: {
      readonly id: string;
      readonly display_name: string;
      readonly type: string;
    };
    readonly membership: {
      readonly type: string;
      readonly job_title: string | null;
    };
    readonly session_expires_at: string;
    readonly permissions_evaluated_at: string;
    readonly capabilities: OrganizationContextCapabilitiesResponse;
  };
}

@Controller('account/organization-context')
export class OrganizationContextController {
  constructor(
    @Inject(OrganizationContextConfirmationService)
    private readonly confirmation: OrganizationContextConfirmationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  async get(
    @Req() request: HttpSecurityRequestAdapter,
  ): Promise<OrganizationContextConfirmationResponse> {
    const context = this.requireOrganizationContext(request);
    const result = await this.confirmation.confirm(context);

    return {
      success: true,
      data: {
        context_scope: 'organization',
        tenant_id: result.tenantId,
        membership_id: result.membershipId,
        organization: {
          id: result.organizationId,
          display_name: result.organizationDisplayName,
          type: result.organizationType,
        },
        membership: {
          type: result.membershipType,
          job_title: result.jobTitle,
        },
        session_expires_at: result.sessionExpiresAt.toISOString(),
        permissions_evaluated_at: result.permissionsEvaluatedAt.toISOString(),
        capabilities: {
          organization_view: result.capabilities.organizationView,
          organization_manage: result.capabilities.organizationManage,
          people_view: result.capabilities.peopleView,
          people_manage: result.capabilities.peopleManage,
          memberships_view: result.capabilities.membershipsView,
          memberships_manage: result.capabilities.membershipsManage,
          users_view: result.capabilities.usersView,
          users_manage: result.capabilities.usersManage,
          access_control_view: result.capabilities.accessControlView,
          access_control_manage: result.capabilities.accessControlManage,
        },
      },
    };
  }

  private requireOrganizationContext(
    request: HttpSecurityRequestAdapter,
  ): TrustedOrganizationRequestContext {
    const context = request.trustedContext;
    if (context === undefined || context.scope !== 'organization') {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Trusted organization context was not established.',
        500,
      );
    }
    return context;
  }
}
