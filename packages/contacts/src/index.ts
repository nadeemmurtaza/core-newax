export type { ContactsRepository } from './database/contacts-repository';
export type {
  ContactCreatedEvent,
  ContactEvent,
  ContactEventPublisher,
  ContactUpdatedEvent,
  PersonContactCreatedEvent,
} from './events/contact-event';
export { ContactsModuleError, type ContactsErrorCode } from './errors/contacts-module-error';
export { CONTACT_PERMISSIONS, type ContactPermission } from './permissions/contact-permissions';
export { ContactsService } from './services/contacts.service';
export type {
  AddOrganizationContactInput,
  AddPersonContactInput,
  ContactsRequestContext,
  ContactType,
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  CreatePersonContactRecordInput,
  CreatePersonContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  OrganizationContact,
  OrganizationContactListQuery,
  OrganizationContactPage,
  OrganizationContactRecord,
  OrganizationContactStatus,
  PersonContact,
  PersonContactRecord,
  UpdateOrganizationContactInput,
  UpdateOrganizationContactRecordInput,
  UpdateOrganizationContactResult,
} from './types/contact';
