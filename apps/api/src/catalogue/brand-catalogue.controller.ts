import { Controller, Get, Header, Inject, Param, Req } from '@nestjs/common';
import { HttpSecurityError } from '@newax/http-security';
import { ContextAuthorizer, type TrustedOrganizationRequestContext } from '@newax/request-context';

import { OrganizationContextEndpoint } from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CatalogueService } from './catalogue.service';
import type { CategoryWithServices, LaunchState, ServiceRecord } from './catalogue.types';

interface ServiceResource {
  readonly id: string;
  readonly code: string;
  readonly display_name: string;
  readonly outcome_description: string;
  readonly icon_key: string | null;
  readonly availability: string;
}

interface CategoryResource {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly services: readonly ServiceResource[];
}

/**
 * CORE-SVC-02/03's data source. CORE-SVC-05/09's launch resolution lives
 * here too -- see catalogue.service.ts's resolveLaunch doc comment for why
 * every real-service outcome is honestly "blocked_no_bridge" right now.
 */
@Controller('core/brands/:brandId/catalogue')
export class BrandCatalogueController {
  constructor(
    @Inject(CatalogueService) private readonly catalogue: CatalogueService,
    @Inject(ContextAuthorizer) private readonly authorizer: ContextAuthorizer,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  async list(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('brandId') brandId: string,
  ): Promise<{ success: true; data: { categories: readonly CategoryResource[] } }> {
    const context = this.requireOrganizationContext(request);
    const { categories } = await this.catalogue.getCatalogue(
      this.authorizer.toModuleContext(context),
      brandId,
    );
    return {
      success: true,
      data: { categories: categories.map((c) => this.toCategoryResource(c)) },
    };
  }

  @Get('categories/:categoryId')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  async category(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('brandId') brandId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<{ success: true; data: CategoryResource }> {
    const context = this.requireOrganizationContext(request);
    const { category } = await this.catalogue.getCategory(
      this.authorizer.toModuleContext(context),
      brandId,
      categoryId,
    );
    return { success: true, data: this.toCategoryResource(category) };
  }

  @Get('services/:serviceCode/launch')
  @Header('Cache-Control', 'no-store')
  @OrganizationContextEndpoint()
  async launch(
    @Req() request: HttpSecurityRequestAdapter,
    @Param('brandId') brandId: string,
    @Param('serviceCode') serviceCode: string,
  ): Promise<{
    success: true;
    data: { service: ServiceResource | null; launch: LaunchState };
  }> {
    const context = this.requireOrganizationContext(request);
    const { service, launch } = await this.catalogue.resolveLaunch(
      this.authorizer.toModuleContext(context),
      brandId,
      serviceCode,
    );
    return {
      success: true,
      data: { service: service ? this.toServiceResource(service) : null, launch },
    };
  }

  private toCategoryResource(category: CategoryWithServices): CategoryResource {
    return {
      id: category.id,
      code: category.code,
      label: category.label,
      description: category.description,
      services: category.services.map((s) => this.toServiceResource(s)),
    };
  }

  private toServiceResource(service: ServiceRecord): ServiceResource {
    return {
      id: service.id,
      code: service.code,
      display_name: service.displayName,
      outcome_description: service.outcomeDescription,
      icon_key: service.iconKey,
      availability: service.availability,
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
