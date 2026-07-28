import { Controller, Get, Header, Inject, Query, Req } from '@nestjs/common';
import { HttpSecurityError } from '@newax/http-security';
import { ORGANIZATION_PERMISSIONS, OrganizationsService } from '@newax/organizations';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import {
  OrganizationContextEndpoint,
  RequirePermissions,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';

interface CurrentOrganizationResponse {
  readonly success: true;
  readonly data: {
    readonly id: string;
    readonly tenant_id: string;
    readonly legal_name: string;
    readonly display_name: string;
    readonly type: string;
    readonly status: 'active';
    readonly created_at: string;
    readonly updated_at: string;
  };
}

@Controller('core/organizations/current')
export class CurrentOrganizationController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(ContextAuthorizer)
    private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  @RequirePermissions(ORGANIZATION_PERMISSIONS.view)
  async get(
    @Req() request: HttpSecurityRequestAdapter,
    @Query() query: unknown,
  ): Promise<CurrentOrganizationResponse> {
    this.assertEmptyQuery(query);
    const context = this.requireOrganizationContext(request);
    const organization = await this.organizations.getCurrent(
      this.authorizer.toModuleContext(context),
    );

    return {
      success: true,
      data: {
        id: organization.id,
        tenant_id: organization.tenantId,
        legal_name: organization.legalName,
        display_name: organization.displayName,
        type: organization.organizationType,
        status: organization.status,
        created_at: organization.createdAt.toISOString(),
        updated_at: organization.updatedAt.toISOString(),
      },
    };
  }

  private assertEmptyQuery(query: unknown): void {
    if (
      typeof query !== 'object' ||
      query === null ||
      Array.isArray(query) ||
      Object.keys(query).length > 0
    ) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The current organization endpoint does not accept query parameters.',
        400,
      );
    }
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
