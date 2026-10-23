/**
 * NEWAX Core service catalogue -- see schema.prisma's CoreBrand/CoreService/
 * CoreServiceCategory/CoreBrandServiceConfiguration doc comments and
 * NEWAX_CORE_SERVICE_CATALOGUE_AND_MODULE_PAGES_ADDENDUM_v1 section 4.
 */

export type ServiceAvailability = 'available' | 'active' | 'setup_required' | 'unavailable';

export interface BrandRecord {
  id: string;
  organizationId: string;
  displayName: string;
  slug: string;
  status: string;
}

export interface ServiceCategoryRecord {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
}

export interface ServiceRecord {
  id: string;
  code: string;
  displayName: string;
  outcomeDescription: string;
  categoryId: string;
  parentApplication: string;
  destinationKey: string;
  iconKey: string | null;
  availability: ServiceAvailability;
}

export interface CategoryWithServices extends ServiceCategoryRecord {
  services: ServiceRecord[];
}

export type LaunchState =
  | { outcome: 'blocked_no_bridge' }
  | { outcome: 'setup_required' }
  | { outcome: 'unavailable'; reason: 'disabled' | 'not_entitled' }
  | { outcome: 'not_found' };
