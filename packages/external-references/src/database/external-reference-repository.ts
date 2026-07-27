import type {
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
}
