export type { ContactsRepository } from './database/contacts-repository';
export type {
  ContactCreatedEvent,
  ContactEvent,
  ContactEventPublisher,
} from './events/contact-event';
export { ContactsModuleError, type ContactsErrorCode } from './errors/contacts-module-error';
export { CONTACT_PERMISSIONS, type ContactPermission } from './permissions/contact-permissions';
export { ContactsService } from './services/contacts.service';
export type {
  AddOrganizationContactInput,
  ContactsRequestContext,
  ContactType,
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  OrganizationContact,
  OrganizationContactListQuery,
  OrganizationContactPage,
  OrganizationContactRecord,
  OrganizationContactStatus,
} from './types/contact';
