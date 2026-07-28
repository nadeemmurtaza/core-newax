import type { ObjectRepository } from '../database/object-repository';
import type { ObjectEventPublisher } from '../events/object-event';
import { ObjectModuleError, type ObjectErrorCode } from '../errors/object-module-error';
import { OBJECT_PERMISSIONS, type ObjectPermission } from '../permissions/object-permissions';
import type {
  CreateOrganizationObjectInput,
  ObjectRecord,
  ObjectTypeRecord,
  OrganizationObjectListQuery,
  OrganizationObjectPage,
  OrganizationObjectRequestContext,
  PlatformObjectRequestContext,
  RegisterObjectTypeInput,
} from '../types/object';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

export class ObjectsService {
  constructor(
    private readonly repository: ObjectRepository,
    private readonly eventPublisher: ObjectEventPublisher,
  ) {}

  async registerObjectType(
    context: PlatformObjectRequestContext,
    input: RegisterObjectTypeInput,
  ): Promise<ObjectTypeRecord> {
    const actorUserId = this.requirePlatformContext(context, OBJECT_PERMISSIONS.typesManage);
    const result = await this.repository.registerObjectType({
      code: this.requireCode(input.code, 'code', 96),
      name: this.requireText(input.name, 'name', 128),
      category: this.requireOptionalCode(input.category, 'category', 96),
      description: this.requireOptionalText(input.description, 'description', 2_000),
    });

    if (result.status === 'conflict') {
      throw new ObjectModuleError('OBJECT_CONFLICT', 'The object type already exists.');
    }

    const objectType = this.requireObjectTypeBoundary(result.objectType);
    await this.eventPublisher.publish({
      name: 'object.type_registered',
      actorUserId,
      objectTypeId: objectType.id,
      objectTypeCode: objectType.code,
      occurredAt: new Date(),
    });
    return objectType;
  }

  async addCurrentOrganizationObject(
    context: OrganizationObjectRequestContext,
    input: CreateOrganizationObjectInput,
  ): Promise<ObjectRecord> {
    const trusted = this.requireOrganizationContext(context, OBJECT_PERMISSIONS.create);
    const result = await this.repository.createOrganizationObject({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      objectTypeCode: this.requireCode(input.objectTypeCode, 'objectTypeCode', 96),
      parentObjectId: this.requireOptionalUuid(input.parentObjectId, 'parentObjectId'),
      name: this.requireText(input.name, 'name', 255),
      referenceCode: this.requireOptionalReferenceCode(input.referenceCode),
      serialNumber: this.requireOptionalText(input.serialNumber, 'serialNumber', 128),
      description: this.requireOptionalText(input.description, 'description', 2_000),
    });

    if (result.status === 'organization_unavailable') {
      throw new ObjectModuleError(
        'OBJECT_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'object_type_unavailable') {
      throw new ObjectModuleError('OBJECT_TYPE_UNAVAILABLE', 'The object type is unavailable.');
    }
    if (result.status === 'parent_unavailable') {
      throw new ObjectModuleError(
        'OBJECT_PARENT_UNAVAILABLE',
        'The parent object is unavailable in the current tenant.',
      );
    }
    if (result.status === 'conflict') {
      throw new ObjectModuleError('OBJECT_CONFLICT', 'The object already exists.');
    }

    const object = this.requireObjectBoundary(result.object, trusted);
    await this.eventPublisher.publish({
      name: 'object.created',
      actorUserId: trusted.actorUserId,
      tenantId: object.tenantId,
      organizationId: object.owningOrganizationId,
      objectId: object.id,
      objectTypeId: object.objectTypeId,
      objectTypeCode: object.objectTypeCode,
      parentObjectId: object.parentObjectId,
      occurredAt: new Date(),
    });
    return object;
  }

  async listCurrentOrganizationObjects(
    context: OrganizationObjectRequestContext,
    query: OrganizationObjectListQuery = {},
  ): Promise<OrganizationObjectPage> {
    const trusted = this.requireOrganizationContext(context, OBJECT_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ObjectModuleError(
        'OBJECT_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }

    const result = await this.repository.listOrganizationObjects({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      limit,
      ...(query.objectTypeCode === undefined
        ? {}
        : { objectTypeCode: this.requireCode(query.objectTypeCode, 'objectTypeCode', 96) }),
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId') }),
    });

    if (result.status === 'organization_unavailable') {
      throw new ObjectModuleError(
        'OBJECT_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new ObjectModuleError(
        'OBJECT_CURSOR_INVALID',
        'The object cursor is invalid for the current organization.',
      );
    }
    if (!Array.isArray(result.items) || result.items.length > limit) {
      throw new ObjectModuleError(
        'OBJECT_INTEGRITY_FAILURE',
        'The object repository returned an invalid page.',
      );
    }

    const items = result.items.map((object) => this.requireObjectBoundary(object, trusted));
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'OBJECT_INTEGRITY_FAILURE');
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requirePlatformContext(
    context: PlatformObjectRequestContext,
    permission: ObjectPermission,
  ): string {
    const actorUserId = this.requireUuid(context.actorUserId, 'context.actorUserId');
    if (!context.permissionCodes.has(permission)) {
      throw new ObjectModuleError('OBJECT_FORBIDDEN', `The operation requires ${permission}.`);
    }
    return actorUserId;
  }

  private requireOrganizationContext(
    context: OrganizationObjectRequestContext,
    permission: ObjectPermission,
  ): {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly organizationId: string;
  } {
    const actorUserId = this.requireUuid(context.actorUserId, 'context.actorUserId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    if (!context.permissionCodes.has(permission)) {
      throw new ObjectModuleError('OBJECT_FORBIDDEN', `The operation requires ${permission}.`);
    }
    return { actorUserId, tenantId, organizationId };
  }

  private requireObjectTypeBoundary(record: ObjectTypeRecord): ObjectTypeRecord {
    const id = this.requireUuid(record.id, 'objectType.id', 'OBJECT_INTEGRITY_FAILURE');
    if (!(record.createdAt instanceof Date) || Number.isNaN(record.createdAt.getTime())) {
      throw new ObjectModuleError(
        'OBJECT_INTEGRITY_FAILURE',
        'The object repository returned an invalid type timestamp.',
      );
    }
    return Object.freeze({
      id,
      code: this.requireStoredCode(record.code, 'objectType.code', 96),
      name: this.requireStoredText(record.name, 'objectType.name', 128),
      category: this.requireStoredOptionalCode(record.category, 'objectType.category', 96),
      description: this.requireStoredOptionalText(
        record.description,
        'objectType.description',
        2_000,
      ),
      createdAt: new Date(record.createdAt.getTime()),
    });
  }

  private requireObjectBoundary(
    record: ObjectRecord,
    context: { readonly tenantId: string; readonly organizationId: string },
  ): ObjectRecord {
    const id = this.requireUuid(record.id, 'object.id', 'OBJECT_INTEGRITY_FAILURE');
    const tenantId = this.requireUuid(
      record.tenantId,
      'object.tenantId',
      'OBJECT_INTEGRITY_FAILURE',
    );
    const owningOrganizationId = this.requireUuid(
      record.owningOrganizationId,
      'object.owningOrganizationId',
      'OBJECT_INTEGRITY_FAILURE',
    );
    if (tenantId !== context.tenantId || owningOrganizationId !== context.organizationId) {
      throw new ObjectModuleError(
        'OBJECT_INTEGRITY_FAILURE',
        'The object repository returned a record outside the trusted boundary.',
      );
    }
    if (!(record.createdAt instanceof Date) || Number.isNaN(record.createdAt.getTime())) {
      throw new ObjectModuleError(
        'OBJECT_INTEGRITY_FAILURE',
        'The object repository returned an invalid creation timestamp.',
      );
    }
    return Object.freeze({
      id,
      tenantId,
      owningOrganizationId,
      objectTypeId: this.requireUuid(
        record.objectTypeId,
        'object.objectTypeId',
        'OBJECT_INTEGRITY_FAILURE',
      ),
      objectTypeCode: this.requireStoredCode(record.objectTypeCode, 'object.objectTypeCode', 96),
      parentObjectId:
        record.parentObjectId === null
          ? null
          : this.requireUuid(
              record.parentObjectId,
              'object.parentObjectId',
              'OBJECT_INTEGRITY_FAILURE',
            ),
      name: this.requireStoredText(record.name, 'object.name', 255),
      referenceCode: this.requireStoredOptionalReferenceCode(record.referenceCode),
      serialNumber: this.requireStoredOptionalText(record.serialNumber, 'object.serialNumber', 128),
      description: this.requireStoredOptionalText(record.description, 'object.description', 2_000),
      createdAt: new Date(record.createdAt.getTime()),
    });
  }

  private requireCode(value: string, field: string, maxLength: number): string {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized.length > maxLength || !CODE_PATTERN.test(normalized)) {
      throw new ObjectModuleError('OBJECT_INVALID_INPUT', `${field} is invalid.`);
    }
    return normalized;
  }

  private requireOptionalCode(
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    return this.requireCode(value, field, maxLength);
  }

  private requireStoredCode(value: string, field: string, maxLength: number): string {
    if (value.length > maxLength || value !== value.toLowerCase() || !CODE_PATTERN.test(value)) {
      throw new ObjectModuleError('OBJECT_INTEGRITY_FAILURE', `${field} is invalid.`);
    }
    return value;
  }

  private requireStoredOptionalCode(
    value: string | null,
    field: string,
    maxLength: number,
  ): string | null {
    return value === null ? null : this.requireStoredCode(value, field, maxLength);
  }

  private requireText(value: string, field: string, maxLength: number): string {
    const normalized = this.normalizeText(value);
    if (normalized.length === 0 || normalized.length > maxLength) {
      throw new ObjectModuleError('OBJECT_INVALID_INPUT', `${field} is invalid.`);
    }
    return normalized;
  }

  private requireOptionalText(
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    return this.requireText(value, field, maxLength);
  }

  private requireStoredText(value: string, field: string, maxLength: number): string {
    if (value.length === 0 || value.length > maxLength || value !== this.normalizeText(value)) {
      throw new ObjectModuleError('OBJECT_INTEGRITY_FAILURE', `${field} is invalid.`);
    }
    return value;
  }

  private requireStoredOptionalText(
    value: string | null,
    field: string,
    maxLength: number,
  ): string | null {
    return value === null ? null : this.requireStoredText(value, field, maxLength);
  }

  private requireOptionalReferenceCode(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = this.normalizeText(value).toUpperCase();
    if (normalized.length === 0 || normalized.length > 128) {
      throw new ObjectModuleError('OBJECT_INVALID_INPUT', 'referenceCode is invalid.');
    }
    return normalized;
  }

  private requireStoredOptionalReferenceCode(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    if (value.length === 0 || value.length > 128 || value !== value.toUpperCase()) {
      throw new ObjectModuleError('OBJECT_INTEGRITY_FAILURE', 'object.referenceCode is invalid.');
    }
    return value;
  }

  private requireUuid(
    value: string,
    field: string,
    code: ObjectErrorCode = 'OBJECT_INVALID_INPUT',
  ): string {
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new ObjectModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }

  private requireOptionalUuid(value: string | null | undefined, field: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    return this.requireUuid(value, field);
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  }
}
