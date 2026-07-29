import { Body, Controller, Header, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { LeadHarvesterSyncService, type LeadHarvesterSyncResult } from '@newax/lead-harvester-sync';

import { PublicSignedMutationEndpoint } from '../../http-security/http-security.decorators';
import { LeadHarvesterServiceAccountContextFactory } from './lead-harvester-service-account-context.factory';
import { parseLeadHarvesterInstitutionUpsertedPayload } from './lead-harvester-webhook.input';
import { LeadHarvesterWebhookGuard } from './lead-harvester-webhook.guard';

interface LeadHarvesterWebhookResponse {
  readonly success: true;
  readonly data: {
    readonly status: 'applied' | 'stale';
    readonly organization_id: string;
    readonly skipped: readonly {
      readonly kind: 'contact_point';
      readonly id: string;
      readonly reason: string;
    }[];
  };
}

// The service account's own context is built fresh per call from bootstrapped
// env config + the real CoreRole/CoreRolePermission grant (never a request-
// scoped TrustedRequestContext, since there is no human session here -- the
// caller authenticates via LeadHarvesterWebhookGuard's HMAC signature check).
@Controller('integrations/lead-harvester')
export class LeadHarvesterWebhookController {
  constructor(
    @Inject(LeadHarvesterServiceAccountContextFactory)
    private readonly contextFactory: LeadHarvesterServiceAccountContextFactory,
    @Inject(LeadHarvesterSyncService)
    private readonly syncService: LeadHarvesterSyncService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @PublicSignedMutationEndpoint()
  @UseGuards(LeadHarvesterWebhookGuard)
  async handleWebhook(@Body() body: unknown): Promise<LeadHarvesterWebhookResponse> {
    const payload = parseLeadHarvesterInstitutionUpsertedPayload(body);
    const context = await this.contextFactory.buildTenantContext();
    const result = await this.syncService.syncInstitutionUpserted(context, payload);

    return { success: true, data: this.toResource(result) };
  }

  private toResource(result: LeadHarvesterSyncResult): LeadHarvesterWebhookResponse['data'] {
    if (result.status === 'stale') {
      return { status: 'stale', organization_id: result.organizationId, skipped: [] };
    }
    return {
      status: 'applied',
      organization_id: result.organizationId,
      skipped: result.skipped.map((item) => ({
        kind: item.kind,
        id: item.id,
        reason: item.reason,
      })),
    };
  }
}
