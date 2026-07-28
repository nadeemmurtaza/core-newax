import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionEvaluator } from '@newax/access-control';

import type { ApplicationEnvironment } from '../../config/environment';

export interface LeadHarvesterTenantContext {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly permissionCodes: ReadonlySet<string>;
}

export interface LeadHarvesterServiceAccountContext extends LeadHarvesterTenantContext {
  readonly organizationId: string;
}

export class LeadHarvesterIntegrationNotConfiguredError extends Error {
  constructor() {
    super(
      'LEAD_HARVESTER_TENANT_ID, LEAD_HARVESTER_SERVICE_USER_ID, and ' +
        'LEAD_HARVESTER_SERVICE_MEMBERSHIP_ID must all be set (via ' +
        'apps/api/scripts/bootstrap-lead-harvester-sync.js) before the webhook can run.',
    );
  }
}

// Builds the trusted context every @newax/organizations / @newax/addresses /
// @newax/contacts / @newax/people / @newax/memberships / @newax/external-references
// service call needs, for the Lead Harvester webhook's service-account caller.
//
// permissionCodes is never hardcoded here: it comes from evaluating the service
// account's real CoreMembership/CoreRole/CoreRolePermission grant (bootstrapped by
// bootstrap-lead-harvester-sync.js) through the same PermissionEvaluator a human's
// request context is evaluated through. Revoking or changing that role through the
// normal access-control API changes what this integration can do, with nothing to
// update here.
@Injectable()
export class LeadHarvesterServiceAccountContextFactory {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<ApplicationEnvironment, true>,
    @Inject(PermissionEvaluator)
    private readonly permissionEvaluator: PermissionEvaluator,
  ) {}

  // For operations that create a brand-new organization (there is no
  // organizationId yet to scope the context to).
  async buildTenantContext(): Promise<LeadHarvesterTenantContext> {
    const tenantId = this.configService.get('LEAD_HARVESTER_TENANT_ID', { infer: true });
    const actorUserId = this.configService.get('LEAD_HARVESTER_SERVICE_USER_ID', { infer: true });
    const serviceMembershipId = this.configService.get('LEAD_HARVESTER_SERVICE_MEMBERSHIP_ID', {
      infer: true,
    });
    if (tenantId === undefined || actorUserId === undefined || serviceMembershipId === undefined) {
      throw new LeadHarvesterIntegrationNotConfiguredError();
    }

    const evaluation = await this.permissionEvaluator.evaluate(serviceMembershipId);

    return Object.freeze({
      actorUserId,
      tenantId,
      permissionCodes: new Set(evaluation.effectivePermissionCodes),
    });
  }

  // For everything else -- update, addresses, contacts, memberships -- scoped to
  // an institution's already-resolved CoreOrganization.
  async buildOrganizationContext(
    organizationId: string,
  ): Promise<LeadHarvesterServiceAccountContext> {
    const tenantContext = await this.buildTenantContext();
    return Object.freeze({ ...tenantContext, organizationId });
  }
}
