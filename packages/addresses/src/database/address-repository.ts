import type {
  CreateOrganizationAddressRecordInput,
  CreateOrganizationAddressResult,
  ListOrganizationAddressesRecordInput,
  ListOrganizationAddressesResult,
  UpdateOrganizationAddressRecordInput,
  UpdateOrganizationAddressResult,
} from '../types/address';

export interface AddressRepository {
  createOrganizationAddress(
    input: CreateOrganizationAddressRecordInput,
  ): Promise<CreateOrganizationAddressResult>;
  updateOrganizationAddress(
    input: UpdateOrganizationAddressRecordInput,
  ): Promise<UpdateOrganizationAddressResult>;
  listOrganizationAddresses(
    input: ListOrganizationAddressesRecordInput,
  ): Promise<ListOrganizationAddressesResult>;
}
