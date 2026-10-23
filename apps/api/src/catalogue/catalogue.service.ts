import { Inject, Injectable } from '@nestjs/common';
import { ORGANIZATION_PERMISSIONS } from '@newax/organizations';
import type { ModuleRequestContext } from '@newax/request-context';
import { CatalogueModuleError } from './catalogue.errors';
import { CatalogueRepository } from './catalogue.repository';
import type {
  BrandRecord,
  CategoryWithServices,
  LaunchState,
  ServiceRecord,
} from './catalogue.types';

/**
 * See catalogue.module.ts's doc comment for what this pass does and
 * doesn't cover. Read access reuses ORGANIZATION_PERMISSIONS.view --
 * browsing the catalogue of an organization you already have a
 * confirmed membership in is base-level, not a privileged action; a new,
 * separately-granted permission for it would be unusable until
 * CORE-SVC-08 (role assignment) exists to grant it.
 */
@Injectable()
export class CatalogueService {
  constructor(@Inject(CatalogueRepository) private readonly repository: CatalogueRepository) {}

  async listBrands(context: ModuleRequestContext): Promise<BrandRecord[]> {
    this.requireView(context);
    return this.repository.listBrandsForOrganization(
      this.requireTrustedUuid(context.organizationId, 'context.organizationId'),
    );
  }

  async getCatalogue(
    context: ModuleRequestContext,
    brandId: string,
  ): Promise<{ brand: BrandRecord; categories: CategoryWithServices[] }> {
    this.requireView(context);
    const brand = await this.requireBrand(context, brandId);
    const categories = await this.repository.listCategoriesWithServices(brand.id);
    return { brand, categories: categories.filter((c) => c.services.length > 0) };
  }

  async getCategory(
    context: ModuleRequestContext,
    brandId: string,
    categoryId: string,
  ): Promise<{ brand: BrandRecord; category: CategoryWithServices }> {
    this.requireView(context);
    const brand = await this.requireBrand(context, brandId);
    const category = await this.repository.getCategory(categoryId, brand.id);
    if (!category) {
      throw CatalogueModuleError.notFound('Category not found.');
    }
    return { brand, category };
  }

  /**
   * Resolves whether a service is launchable -- but never actually
   * launches it. There is no secure nID -> Core -> destination-application
   * session bridge yet (see NEWAX_CORE_SERVICE_CATALOGUE_AND_MODULE_PAGES
   * _ADDENDUM_v1 section 5 and the "Instruction to the development agent"
   * in section 10), so every outcome short of "the service itself isn't
   * ready" resolves to blocked_no_bridge -- an honest state, not a 501
   * the frontend has to interpret.
   */
  async resolveLaunch(
    context: ModuleRequestContext,
    brandId: string,
    serviceCode: string,
  ): Promise<{ brand: BrandRecord; service: ServiceRecord | null; launch: LaunchState }> {
    this.requireView(context);
    const brand = await this.requireBrand(context, brandId);
    const service = await this.repository.findServiceByCode(serviceCode, brand.id);

    if (!service) {
      return { brand, service: null, launch: { outcome: 'not_found' } };
    }
    if (service.availability === 'unavailable') {
      return { brand, service, launch: { outcome: 'unavailable', reason: 'disabled' } };
    }
    if (service.availability === 'available') {
      return { brand, service, launch: { outcome: 'unavailable', reason: 'not_entitled' } };
    }
    if (service.availability === 'setup_required') {
      return { brand, service, launch: { outcome: 'setup_required' } };
    }
    return { brand, service, launch: { outcome: 'blocked_no_bridge' } };
  }

  private async requireBrand(context: ModuleRequestContext, brandId: string): Promise<BrandRecord> {
    const organizationId = this.requireTrustedUuid(
      context.organizationId,
      'context.organizationId',
    );
    const brand = await this.repository.findBrand(
      this.requireTrustedUuid(brandId, 'brandId'),
      organizationId,
    );
    // Not-found and belongs-to-another-organization return the identical
    // 404 -- never confirm a brand ID exists outside the caller's own org.
    if (!brand) {
      throw CatalogueModuleError.notFound('Brand not found.');
    }
    return brand;
  }

  private requireView(context: ModuleRequestContext): void {
    if (!context.permissionCodes.has(ORGANIZATION_PERMISSIONS.view)) {
      throw CatalogueModuleError.forbidden('Not permitted to view this organization.');
    }
  }

  private requireTrustedUuid(value: string, field: string): string {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
    if (!UUID_PATTERN.test(value)) {
      throw CatalogueModuleError.invalidInput(`${field} must be a UUID.`);
    }
    return value;
  }
}
