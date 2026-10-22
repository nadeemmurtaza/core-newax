import { Buffer } from 'node:buffer';

import type { ExternalReferenceRepository } from '../database/external-reference-repository';
import type { ExternalReferenceEventPublisher } from '../events/external-reference-event';
import {
  ExternalReferenceModuleError,
  type ExternalReferenceErrorCode,
} from '../errors/external-reference-module-error';
import {
  EXTERNAL_REFERENCE_PERMISSIONS,
  type ExternalReferencePermission,
} from '../permissions/external-reference-permissions';
import type {
  ExternalReferenceRecord,
  OrganizationExternalReferenceListQuery,
  OrganizationExternalReferencePage,
  OrganizationExternalReferenceRequestContext,
  RegisterOrganizationExternalReferenceInput,
} from '../types/external-reference';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_ENTITY_ID_UTF8_BYTES = 512;
const MAX_EXTERNAL_KEY_UTF8_BYTES = 1_020;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

export class ExternalReferencesService {
  constructor(
    private readonly repository: ExternalReferenceRepository,
    private readonly eventPublisher: ExternalReferenceEventPublisher,
  ) {}

  async registerCurrentOrganizationExternalReference(
    context: OrganizationExternalReferenceRequestContext,
    input: RegisterOrganizationExternalReferenceInput,
  ): Promise<ExternalReferenceRecord> {
    const trusted = this.requireOrganizationContext(
      context,
      EXTERNAL_REFERENCE_PERMISSIONS.register,
    );
    const result = await this.repository.registerOrganizationExternalReference({
      actorUserId: trusted.actorUserId,
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      domainCode: this.requireCode(input.domainCode, 'domainCode', 64),
      entityType: this.requireCode(input.entityType, 'entityType', 128),
      entityId: this.requireOpaqueIdentifier(
        input.entityId,
        'entityId',
        128,
        MAX_ENTITY_ID_UTF8_BYTES,
      ),
      externalSystem: this.requireCode(input.externalSystem, 'externalSystem', 128),
      externalKey: this.requireOpaqueIdentifier(
        input.externalKey,
        'externalKey',
        255,
        MAX_EXTERNAL_KEY_UTF8_BYTES,
      ),
    });

    if (result.status === 'organization_unavailable') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'actor_unavailable') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_ACTOR_UNAVAILABLE',
        'The actor is unavailable.',
      );
    }
    if (result.status === 'conflict') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_CONFLICT',
        'The external reference is already registered for this organization.',
      );
    }

    const externalReference = this.requireExternalReferenceBoundary(
      result.externalReference,
      trusted,
    );
    await this.eventPublisher.publish({
      name: 'external_reference.registered',
      actorUserId: trusted.actorUserId,
      tenantId: externalReference.tenantId,
      organizationId: externalReference.organizationId,
      externalReferenceId: externalReference.id,
      occurredAt: new Date(),
    });
    return externalReference;
  }

  async listCurrentOrganizationExternalReferences(
    context: OrganizationExternalReferenceRequestContext,
    query: OrganizationExternalReferenceListQuery = {},
  ): Promise<OrganizationExternalReferencePage> {
    const trusted = this.requireOrganizationContext(context, EXTERNAL_REFERENCE_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }

    const result = await this.repository.listOrganizationExternalReferences({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      limit,
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId') }),
    });

    if (result.status === 'organization_unavailable') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_CURSOR_INVALID',
        'The external reference cursor is invalid for the current organization.',
      );
    }
    if (!Array.isArray(result.items) || result.items.length > limit) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
        'The external reference repository returned an invalid page.',
      );
    }

    const items = result.items.map((record) =>
      this.requireExternalReferenceBoundary(record, trusted),
    );
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'EXTERNAL_REFERENCE_INTEGRITY_FAILURE');
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requireOrganizationContext(
    context: OrganizationExternalReferenceRequestContext,
    permission: ExternalReferencePermission,
  ): {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly organizationId: string;
  } {
    const actorUserId = this.requireUuid(context.actorUserId, 'context.actorUserId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    if (!context.permissionCodes.has(permission)) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_FORBIDDEN',
        `The operation requires ${permission}.`,
      );
    }
    return { actorUserId, tenantId, organizationId };
  }

  private requireExternalReferenceBoundary(
    record: ExternalReferenceRecord,
    context: { readonly tenantId: string; readonly organizationId: string },
  ): ExternalReferenceRecord {
    const id = this.requireUuid(
      record.id,
      'externalReference.id',
      'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
    );
    const tenantId = this.requireUuid(
      record.tenantId,
      'externalReference.tenantId',
      'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
    );
    const organizationId = this.requireUuid(
      record.organizationId,
      'externalReference.organizationId',
      'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
    );
    if (tenantId !== context.tenantId || organizationId !== context.organizationId) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
        'The external reference repository returned a record outside the trusted boundary.',
      );
    }
    const createdAt = this.requireDate(
      record.createdAt,
      'externalReference.createdAt',
      'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
    );
    const updatedAt = this.requireDate(
      record.updatedAt,
      'externalReference.updatedAt',
      'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
    );
    if (updatedAt.getTime() < createdAt.getTime()) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
        'The external reference repository returned invalid timestamps.',
      );
    }

    return Object.freeze({
      id,
      tenantId,
      organizationId,
      domainCode: this.requireStoredCode(record.domainCode, 'externalReference.domainCode', 64),
      entityType: this.requireStoredCode(record.entityType, 'externalReference.entityType', 128),
      entityId: this.requireOpaqueIdentifier(
        record.entityId,
        'externalReference.entityId',
        128,
        MAX_ENTITY_ID_UTF8_BYTES,
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
      ),
      externalSystem: this.requireStoredCode(
        record.externalSystem,
        'externalReference.externalSystem',
        128,
      ),
      externalKey: this.requireOpaqueIdentifier(
        record.externalKey,
        'externalReference.externalKey',
        255,
        MAX_EXTERNAL_KEY_UTF8_BYTES,
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
      ),
      createdAt,
      updatedAt,
    });
  }

  private requireCode(value: string, field: string, maximumLength: number): string {
    if (typeof value !== 'string') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INVALID_INPUT',
        `${field} is invalid.`,
      );
    }
    const normalized = value.normalize('NFKC').trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > maximumLength ||
      !CODE_PATTERN.test(normalized)
    ) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INVALID_INPUT',
        `${field} is invalid.`,
      );
    }
    return normalized;
  }

  private requireStoredCode(value: string, field: string, maximumLength: number): string {
    if (typeof value !== 'string') {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
        `${field} is invalid.`,
      );
    }
    const normalized = value.normalize('NFKC').trim().toLowerCase();
    if (
      value !== normalized ||
      value.length === 0 ||
      value.length > maximumLength ||
      !CODE_PATTERN.test(value)
    ) {
      throw new ExternalReferenceModuleError(
        'EXTERNAL_REFERENCE_INTEGRITY_FAILURE',
        `${field} is invalid.`,
      );
    }
    return value;
  }

  private requireOpaqueIdentifier(
    value: string,
    field: string,
    maximumLength: number,
    maximumUtf8Bytes: number,
    code: ExternalReferenceErrorCode = 'EXTERNAL_REFERENCE_INVALID_INPUT',
  ): string {
    if (
      typeof value !== 'string' ||
      value.trim().length === 0 ||
      Array.from(value).length > maximumLength ||
      Buffer.byteLength(value, 'utf8') > maximumUtf8Bytes ||
      containsControlCharacter(value)
    ) {
      throw new ExternalReferenceModuleError(code, `${field} is invalid.`);
    }
    return value;
  }

  private requireUuid(
    value: string,
    field: string,
    code: ExternalReferenceErrorCode = 'EXTERNAL_REFERENCE_INVALID_INPUT',
  ): string {
    if (typeof value !== 'string') {
      throw new ExternalReferenceModuleError(code, `${field} must be a valid UUID.`);
    }
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new ExternalReferenceModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }

  private requireDate(value: Date, field: string, code: ExternalReferenceErrorCode): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ExternalReferenceModuleError(code, `${field} is invalid.`);
    }
    return new Date(value.getTime());
  }
}
