import type {
  CreateOrganizationRecordInput,
  OrganizationListQuery,
  OrganizationPage,
  OrganizationRecord,
  UpdateOrganizationRecordInput,
} from '../types/organization';

export interface OrganizationRepository {
  archive(tenantId: string, id: string, archivedAt: Date): Promise<OrganizationRecord>;
  create(input: CreateOrganizationRecordInput): Promise<OrganizationRecord>;
  findById(tenantId: string, id: string): Promise<OrganizationRecord | null>;
  hasActiveChildren(tenantId: string, id: string): Promise<boolean>;
  list(tenantId: string, query: OrganizationListQuery): Promise<OrganizationPage>;
  update(
    tenantId: string,
    id: string,
    input: UpdateOrganizationRecordInput,
  ): Promise<OrganizationRecord>;
  wouldCreateCycle(
    tenantId: string,
    organizationId: string,
    candidateParentId: string,
  ): Promise<boolean>;
}
