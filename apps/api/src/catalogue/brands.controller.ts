import { Controller, Get, Header, Inject, Req } from '@nestjs/common';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import { OrganizationContextEndpoint } from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CatalogueService } from './catalogue.service';

interface BrandResource {
  readonly id: string;
  readonly display_name: string;
  readonly slug: string;
}

interface ListBrandsResponse {
  readonly success: true;
  readonly data: readonly BrandResource[];
}

/** CORE-SVC-01's data source: the brands available in the current organization context. */
@Controller('core/organizations/current/brands')
export class BrandsController {
  constructor(
    @Inject(CatalogueService) private readonly catalogue: CatalogueService,
    @Inject(ContextAuthorizer) private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  async list(@Req() request: HttpSecurityRequestAdapter): Promise<ListBrandsResponse> {
    const context = this.requireOrganizationContext(request);
    const brands = await this.catalogue.listBrands(this.authorizer.toModuleContext(context));
    return {
      success: true,
      data: brands.map((b) => ({ id: b.id, display_name: b.displayName, slug: b.slug })),
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
