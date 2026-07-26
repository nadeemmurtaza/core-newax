import type {
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
} from '../types/contact';

export interface ContactsRepository {
  createOrganizationContact(
    input: CreateOrganizationContactRecordInput,
  ): Promise<CreateOrganizationContactResult>;
  listOrganizationContacts(
    input: ListOrganizationContactsRecordInput,
  ): Promise<ListOrganizationContactsResult>;
}
