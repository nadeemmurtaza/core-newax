import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  BrandRecord,
  CategoryWithServices,
  ServiceAvailability,
  ServiceRecord,
} from './catalogue.types';

/**
 * Reads only -- writing brands/categories/services/activation is
 * CORE-SVC-07/CORE-SVC-10 (deferred; see catalogue.module.ts's doc
 * comment for what's in this pass and what isn't).
 */
@Injectable()
export class CatalogueRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBrandsForOrganization(organizationId: string): Promise<BrandRecord[]> {
    const rows = await this.prisma.coreBrand.findMany({
      where: { organizationId, status: 'active', deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      displayName: r.displayName,
      slug: r.slug,
      status: r.status,
    }));
  }

  async findBrand(brandId: string, organizationId: string): Promise<BrandRecord | null> {
    const row = await this.prisma.coreBrand.findFirst({
      where: { id: brandId, organizationId, deletedAt: null },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      organizationId: row.organizationId,
      displayName: row.displayName,
      slug: row.slug,
      status: row.status,
    };
  }

  /** Every active category with its services, scoped to what this brand can see. */
  async listCategoriesWithServices(brandId: string): Promise<CategoryWithServices[]> {
    const categories = await this.prisma.coreServiceCategory.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
      include: {
        services: {
          where: { lifecycleStatus: 'active' },
          orderBy: { sortOrder: 'asc' },
          include: { brandConfig: { where: { brandId } } },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      code: category.code,
      label: category.label,
      description: category.description,
      sortOrder: category.sortOrder,
      services: category.services.map((service) => this.toServiceRecord(service)),
    }));
  }

  async getCategory(categoryId: string, brandId: string): Promise<CategoryWithServices | null> {
    const category = await this.prisma.coreServiceCategory.findFirst({
      where: { id: categoryId, status: 'active' },
      include: {
        services: {
          where: { lifecycleStatus: 'active' },
          orderBy: { sortOrder: 'asc' },
          include: { brandConfig: { where: { brandId } } },
        },
      },
    });
    if (!category) {
      return null;
    }
    return {
      id: category.id,
      code: category.code,
      label: category.label,
      description: category.description,
      sortOrder: category.sortOrder,
      services: category.services.map((service) => this.toServiceRecord(service)),
    };
  }

  async findServiceByCode(serviceCode: string, brandId: string): Promise<ServiceRecord | null> {
    const service = await this.prisma.coreService.findFirst({
      where: { code: serviceCode, lifecycleStatus: 'active' },
      include: { brandConfig: { where: { brandId } } },
    });
    if (!service) {
      return null;
    }
    return this.toServiceRecord(service);
  }

  private toServiceRecord(service: {
    id: string;
    code: string;
    displayName: string;
    outcomeDescription: string;
    categoryId: string;
    parentApplication: string;
    destinationKey: string;
    iconKey: string | null;
    brandConfig: { activationState: string; setupState: string }[];
  }): ServiceRecord {
    return {
      id: service.id,
      code: service.code,
      displayName: service.displayName,
      outcomeDescription: service.outcomeDescription,
      categoryId: service.categoryId,
      parentApplication: service.parentApplication,
      destinationKey: service.destinationKey,
      iconKey: service.iconKey,
      availability: this.resolveAvailability(service.brandConfig[0]),
    };
  }

  private resolveAvailability(config?: {
    activationState: string;
    setupState: string;
  }): ServiceAvailability {
    if (!config || config.activationState === 'not_configured') {
      return 'available';
    }
    if (config.activationState === 'disabled') {
      return 'unavailable';
    }
    if (config.setupState === 'required' || config.setupState === 'in_progress') {
      return 'setup_required';
    }
    return 'active';
  }
}
