import { Buffer } from 'node:buffer';

import type { AuditRepository } from '../database/audit-repository';
import { AuditModuleError, type AuditErrorCode } from '../errors/audit-module-error';
import { AUDIT_PERMISSIONS } from '../permissions/audit-permissions';
import type {
  AuditEntry,
  AuditJsonObject,
  AuditJsonValue,
  AuditOutcome,
  AuditSensitivity,
  OrganizationAuditListQuery,
  OrganizationAuditPage,
  OrganizationAuditRequestContext,
  TrustedAuditEntryInput,
} from '../types/audit';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_METADATA_BYTES = 16_384;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_ENTRIES = 32;
const MAX_METADATA_STRING_BYTES = 1_024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/u;
const SENSITIVE_METADATA_KEY_PATTERN =
  /(accesskey|apikey|authorization|bearer|cookie|credential|csrf|encryptionkey|password|privatekey|recovery|secret|session|signingkey|token)/u;
const RESERVED_METADATA_KEY_PATTERN = /^(?:__proto__|constructor|prototype)$/u;

interface ExpectedBoundary {
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly actorUserId?: string | null;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async recordTrustedEntry(input: TrustedAuditEntryInput): Promise<AuditEntry> {
    const tenantId = this.requireOptionalUuid(input.tenantId, 'tenantId');
    const organizationId = this.requireOptionalUuid(input.organizationId, 'organizationId');
    const actorUserId = this.requireOptionalUuid(input.actorUserId, 'actorUserId');
    const result = await this.repository.recordTrustedEntry({
      tenantId,
      organizationId,
      actorUserId,
      moduleCode: this.requireCode(input.moduleCode, 'moduleCode', 64),
      action: this.requireCode(input.action, 'action', 160),
      entityType: this.requireCode(input.entityType, 'entityType', 128),
      entityId: this.requireOptionalText(input.entityId, 'entityId', 128),
      outcome: this.requireOutcome(input.outcome ?? 'success'),
      sensitivity: this.requireSensitivity(input.sensitivity ?? 'standard'),
      metadata: this.requireMetadata(input.metadata),
      correlationId: this.requireOptionalUuid(input.correlationId, 'correlationId'),
      requestId: this.requireOptionalText(input.requestId, 'requestId', 128),
      ipAddress: this.requireOptionalText(input.ipAddress, 'ipAddress', 64),
      userAgent: this.requireOptionalText(input.userAgent, 'userAgent', 1_024),
      occurredAt: this.requireDate(input.occurredAt, 'occurredAt'),
    });

    if (result.status === 'scope_unavailable') {
      throw new AuditModuleError(
        'AUDIT_SCOPE_UNAVAILABLE',
        'The Audit Tenant or Organization scope is unavailable.',
      );
    }
    if (result.status === 'actor_unavailable') {
      throw new AuditModuleError('AUDIT_ACTOR_UNAVAILABLE', 'The Audit actor is unavailable.');
    }

    return this.requireEntryBoundary(result.entry, {
      tenantId,
      organizationId,
      actorUserId,
    });
  }

  async listCurrentOrganizationEntries(
    context: OrganizationAuditRequestContext,
    query: OrganizationAuditListQuery = {},
  ): Promise<OrganizationAuditPage> {
    const boundary = this.requireOrganizationContext(context);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new AuditModuleError(
        'AUDIT_INVALID_INPUT',
        'limit must be an integer between 1 and ' + String(MAX_PAGE_SIZE) + '.',
      );
    }

    const result = await this.repository.listOrganizationEntries({
      tenantId: boundary.tenantId,
      organizationId: boundary.organizationId,
      limit,
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId') }),
    });

    if (result.status === 'scope_unavailable') {
      throw new AuditModuleError(
        'AUDIT_SCOPE_UNAVAILABLE',
        'The Audit Tenant or Organization scope is unavailable.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new AuditModuleError(
        'AUDIT_CURSOR_INVALID',
        'The Audit cursor is invalid for the current Organization.',
      );
    }
    if (!Array.isArray(result.items) || result.items.length > limit) {
      throw new AuditModuleError(
        'AUDIT_INTEGRITY_FAILURE',
        'The Audit repository returned an invalid page.',
      );
    }

    const items = result.items.map((entry) =>
      this.requireEntryBoundary(entry, {
        tenantId: boundary.tenantId,
        organizationId: boundary.organizationId,
      }),
    );
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'AUDIT_INTEGRITY_FAILURE');
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requireOrganizationContext(context: OrganizationAuditRequestContext): {
    readonly tenantId: string;
    readonly organizationId: string;
  } {
    this.requireUuid(context.actorUserId, 'context.actorUserId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    if (!context.permissionCodes.has(AUDIT_PERMISSIONS.view)) {
      throw new AuditModuleError(
        'AUDIT_FORBIDDEN',
        'The operation requires ' + AUDIT_PERMISSIONS.view + '.',
      );
    }
    return { tenantId, organizationId };
  }

  private requireEntryBoundary(record: AuditEntry, expected: ExpectedBoundary): AuditEntry {
    const id = this.requireUuid(record.id, 'audit.id', 'AUDIT_INTEGRITY_FAILURE');
    const tenantId = this.requireOptionalUuid(
      record.tenantId,
      'audit.tenantId',
      'AUDIT_INTEGRITY_FAILURE',
    );
    const organizationId = this.requireOptionalUuid(
      record.organizationId,
      'audit.organizationId',
      'AUDIT_INTEGRITY_FAILURE',
    );
    const actorUserId = this.requireOptionalUuid(
      record.actorUserId,
      'audit.actorUserId',
      'AUDIT_INTEGRITY_FAILURE',
    );

    if (
      organizationId !== expected.organizationId ||
      (expected.tenantId !== null && tenantId !== expected.tenantId) ||
      (expected.organizationId === null && expected.tenantId === null && tenantId !== null) ||
      (expected.organizationId !== null && tenantId === null) ||
      ('actorUserId' in expected && actorUserId !== expected.actorUserId)
    ) {
      throw new AuditModuleError(
        'AUDIT_INTEGRITY_FAILURE',
        'The Audit repository returned a record outside the trusted boundary.',
      );
    }

    return Object.freeze({
      id,
      tenantId,
      organizationId,
      actorUserId,
      moduleCode: this.requireStoredCode(record.moduleCode, 'audit.moduleCode', 64),
      action: this.requireStoredCode(record.action, 'audit.action', 160),
      entityType: this.requireStoredCode(record.entityType, 'audit.entityType', 128),
      entityId: this.requireStoredOptionalText(record.entityId, 'audit.entityId', 128),
      outcome: this.requireOutcome(record.outcome, 'AUDIT_INTEGRITY_FAILURE'),
      sensitivity: this.requireSensitivity(record.sensitivity, 'AUDIT_INTEGRITY_FAILURE'),
      requestId: this.requireStoredOptionalText(record.requestId, 'audit.requestId', 128),
      createdAt: this.requireDate(record.createdAt, 'audit.createdAt', 'AUDIT_INTEGRITY_FAILURE'),
    });
  }

  private requireMetadata(value: Readonly<Record<string, unknown>> | undefined): AuditJsonObject {
    const normalized = this.normalizeJsonObject(value ?? {}, 1);
    if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_METADATA_BYTES) {
      throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata is too large.');
    }
    return normalized;
  }

  private normalizeJsonObject(value: unknown, depth: number): AuditJsonObject {
    if (!isPlainObject(value) || depth > MAX_METADATA_DEPTH) {
      throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata is invalid.');
    }
    const entries = Object.entries(value);
    if (entries.length > MAX_METADATA_ENTRIES) {
      throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata has too many entries.');
    }

    const normalized: Record<string, AuditJsonValue> = {};
    for (const [key, item] of entries) {
      const compactKey = key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
      if (
        !METADATA_KEY_PATTERN.test(key) ||
        RESERVED_METADATA_KEY_PATTERN.test(key.toLowerCase()) ||
        SENSITIVE_METADATA_KEY_PATTERN.test(compactKey)
      ) {
        throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata contains a forbidden key.');
      }
      normalized[key] = this.normalizeJsonValue(item, depth + 1);
    }
    return Object.freeze(normalized);
  }

  private normalizeJsonValue(value: unknown, depth: number): AuditJsonValue {
    if (value === null || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata is invalid.');
      }
      return value;
    }
    if (typeof value === 'string') {
      if (
        containsControlCharacter(value) ||
        Buffer.byteLength(value, 'utf8') > MAX_METADATA_STRING_BYTES
      ) {
        throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata is invalid.');
      }
      return value;
    }
    if (Array.isArray(value)) {
      if (depth > MAX_METADATA_DEPTH || value.length > MAX_METADATA_ENTRIES) {
        throw new AuditModuleError('AUDIT_INVALID_INPUT', 'metadata is invalid.');
      }
      return Object.freeze(value.map((item) => this.normalizeJsonValue(item, depth + 1)));
    }
    return this.normalizeJsonObject(value, depth);
  }

  private requireCode(
    value: string,
    field: string,
    maximumLength: number,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): string {
    if (typeof value !== 'string') {
      throw new AuditModuleError(code, field + ' is invalid.');
    }
    const normalized = value.trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > maximumLength ||
      !CODE_PATTERN.test(normalized)
    ) {
      throw new AuditModuleError(code, field + ' is invalid.');
    }
    return normalized;
  }

  private requireStoredCode(value: string, field: string, maximumLength: number): string {
    const normalized = this.requireCode(value, field, maximumLength, 'AUDIT_INTEGRITY_FAILURE');
    if (normalized !== value) {
      throw new AuditModuleError('AUDIT_INTEGRITY_FAILURE', field + ' is invalid.');
    }
    return value;
  }

  private requireOptionalText(
    value: string | null | undefined,
    field: string,
    maximumLength: number,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): string | null {
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new AuditModuleError(code, field + ' is invalid.');
    }
    const normalized = value.trim();
    if (
      normalized.length === 0 ||
      normalized.length > maximumLength ||
      containsControlCharacter(normalized)
    ) {
      throw new AuditModuleError(code, field + ' is invalid.');
    }
    return normalized;
  }

  private requireStoredOptionalText(
    value: string | null,
    field: string,
    maximumLength: number,
  ): string | null {
    const normalized = this.requireOptionalText(
      value,
      field,
      maximumLength,
      'AUDIT_INTEGRITY_FAILURE',
    );
    if (normalized !== value) {
      throw new AuditModuleError('AUDIT_INTEGRITY_FAILURE', field + ' is invalid.');
    }
    return value;
  }

  private requireOutcome(
    value: AuditOutcome,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): AuditOutcome {
    if (value !== 'allowed' && value !== 'denied' && value !== 'failed' && value !== 'success') {
      throw new AuditModuleError(code, 'outcome is invalid.');
    }
    return value;
  }

  private requireSensitivity(
    value: AuditSensitivity,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): AuditSensitivity {
    if (value !== 'security' && value !== 'sensitive' && value !== 'standard') {
      throw new AuditModuleError(code, 'sensitivity is invalid.');
    }
    return value;
  }

  private requireOptionalUuid(
    value: string | null | undefined,
    field: string,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): string | null {
    return value == null ? null : this.requireUuid(value, field, code);
  }

  private requireUuid(
    value: string,
    field: string,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): string {
    if (typeof value !== 'string') {
      throw new AuditModuleError(code, field + ' must be a valid UUID.');
    }
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new AuditModuleError(code, field + ' must be a valid UUID.');
    }
    return normalized;
  }

  private requireDate(
    value: Date,
    field: string,
    code: AuditErrorCode = 'AUDIT_INVALID_INPUT',
  ): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new AuditModuleError(code, field + ' must be a valid date.');
    }
    return new Date(value.getTime());
  }
}
