import type {
  CreateOrganizationAddressRecordInput,
  CreateOrganizationAddressResult,
  ListOrganizationAddressesRecordInput,
  ListOrganizationAddressesResult,
} from '../types/address';

export interface AddressRepository {
  createOrganizationAddress(
    input: CreateOrganizationAddressRecordInput,
  ): Promise<CreateOrganizationAddressResult>;
  listOrganizationAddresses(
    input: ListOrganizationAddressesRecordInput,
  ): Promise<ListOrganizationAddressesResult>;
}
