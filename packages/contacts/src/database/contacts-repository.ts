import type {
  CreateOrganizationContactRecordInput,
  CreateOrganizationContactResult,
  CreatePersonContactRecordInput,
  CreatePersonContactResult,
  ListOrganizationContactsRecordInput,
  ListOrganizationContactsResult,
  UpdateOrganizationContactRecordInput,
  UpdateOrganizationContactResult,
  UpdatePersonContactRecordInput,
  UpdatePersonContactResult,
} from '../types/contact';

export interface ContactsRepository {
  createOrganizationContact(
    input: CreateOrganizationContactRecordInput,
  ): Promise<CreateOrganizationContactResult>;
  updateOrganizationContact(
    input: UpdateOrganizationContactRecordInput,
  ): Promise<UpdateOrganizationContactResult>;
  listOrganizationContacts(
    input: ListOrganizationContactsRecordInput,
  ): Promise<ListOrganizationContactsResult>;
  createPersonContact(input: CreatePersonContactRecordInput): Promise<CreatePersonContactResult>;
  updatePersonContact(input: UpdatePersonContactRecordInput): Promise<UpdatePersonContactResult>;
}
