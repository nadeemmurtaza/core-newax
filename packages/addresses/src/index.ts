export type { AddressRepository } from './database/address-repository';
export type { AddressEvent, AddressEventPublisher } from './events/address-event';
export { AddressModuleError, type AddressErrorCode } from './errors/address-module-error';
export { ADDRESS_PERMISSIONS, type AddressPermission } from './permissions/address-permissions';
export { AddressesService } from './services/addresses.service';
export type {
  CreateOrganizationAddressInput,
  CreateOrganizationAddressRecordInput,
  CreateOrganizationAddressResult,
  ListOrganizationAddressesRecordInput,
  ListOrganizationAddressesResult,
  OrganizationAddressListQuery,
  OrganizationAddressPage,
  OrganizationAddressRecord,
  OrganizationAddressRequestContext,
  OrganizationAddressType,
} from './types/address';
