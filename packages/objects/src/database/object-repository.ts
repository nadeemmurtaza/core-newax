import type {
  CreateOrganizationObjectRecordInput,
  CreateOrganizationObjectResult,
  ListOrganizationObjectsRecordInput,
  ListOrganizationObjectsResult,
  RegisterObjectTypeRecordInput,
  RegisterObjectTypeResult,
} from '../types/object';

export interface ObjectRepository {
  registerObjectType(input: RegisterObjectTypeRecordInput): Promise<RegisterObjectTypeResult>;
  createOrganizationObject(
    input: CreateOrganizationObjectRecordInput,
  ): Promise<CreateOrganizationObjectResult>;
  listOrganizationObjects(
    input: ListOrganizationObjectsRecordInput,
  ): Promise<ListOrganizationObjectsResult>;
}
