export type { ObjectRepository } from './database/object-repository';
export type { ObjectEvent, ObjectEventPublisher } from './events/object-event';
export { ObjectModuleError, type ObjectErrorCode } from './errors/object-module-error';
export { OBJECT_PERMISSIONS, type ObjectPermission } from './permissions/object-permissions';
export { ObjectsService } from './services/objects.service';
export type {
  CreateOrganizationObjectInput,
  CreateOrganizationObjectRecordInput,
  CreateOrganizationObjectResult,
  ListOrganizationObjectsRecordInput,
  ListOrganizationObjectsResult,
  ObjectRecord,
  ObjectTypeRecord,
  OrganizationObjectListQuery,
  OrganizationObjectPage,
  OrganizationObjectRequestContext,
  PlatformObjectRequestContext,
  RegisterObjectTypeInput,
  RegisterObjectTypeRecordInput,
  RegisterObjectTypeResult,
} from './types/object';
