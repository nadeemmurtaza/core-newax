import type {
  CreateTenantRecordInput,
  TenantListQuery,
  TenantPage,
  TenantRecord,
} from '../types/tenant';

export interface TenantRepository {
  create(input: CreateTenantRecordInput): Promise<TenantRecord>;
  findById(id: string): Promise<TenantRecord | null>;
  list(query: TenantListQuery): Promise<TenantPage>;
}
