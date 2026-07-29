import type {
  FindOrganizationExternalReferenceByKeyRecordInput,
  FindOrganizationExternalReferenceByKeyResult,
  FindTenantExternalReferenceByKeyRecordInput,
  FindTenantExternalReferenceByKeyResult,
  ListOrganizationExternalReferencesRecordInput,
  ListOrganizationExternalReferencesResult,
  RegisterOrganizationExternalReferenceRecordInput,
  RegisterOrganizationExternalReferenceResult,
} from '../types/external-reference';

export interface ExternalReferenceRepository {
  registerOrganizationExternalReference(
    input: RegisterOrganizationExternalReferenceRecordInput,
  ): Promise<RegisterOrganizationExternalReferenceResult>;
  listOrganizationExternalReferences(
    input: ListOrganizationExternalReferencesRecordInput,
  ): Promise<ListOrganizationExternalReferencesResult>;
  findOrganizationExternalReferenceByKey(
    input: FindOrganizationExternalReferenceByKeyRecordInput,
  ): Promise<FindOrganizationExternalReferenceByKeyResult>;
  findTenantExternalReferenceByKey(
    input: FindTenantExternalReferenceByKeyRecordInput,
  ): Promise<FindTenantExternalReferenceByKeyResult>;
}
