import { Buffer } from 'node:buffer';

import type { FileRepository } from '../database/file-repository';
import type { FileEventPublisher } from '../events/file-event';
import { FileModuleError, type FileErrorCode } from '../errors/file-module-error';
import { FILE_PERMISSIONS, type FilePermission } from '../permissions/file-permissions';
import type {
  FileRecord,
  OrganizationFileListQuery,
  OrganizationFilePage,
  OrganizationFileRequestContext,
  RegisterOrganizationFileInput,
} from '../types/file';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_STORAGE_KEY_LENGTH = 2_048;
const MAX_STORAGE_KEY_UTF8_BYTES = 2_048;
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PROVIDER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const MIME_TYPE_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+\/[!#$%&'*+.^_`|~0-9a-z-]+$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PATH_SEPARATOR_PATTERN = /[\\/]/u;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

export class FilesService {
  constructor(
    private readonly repository: FileRepository,
    private readonly eventPublisher: FileEventPublisher,
  ) {}

  async registerCurrentOrganizationFile(
    context: OrganizationFileRequestContext,
    input: RegisterOrganizationFileInput,
  ): Promise<FileRecord> {
    const trusted = this.requireOrganizationContext(context, FILE_PERMISSIONS.register);
    const result = await this.repository.registerOrganizationFile({
      actorUserId: trusted.actorUserId,
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      storageProvider: this.requireStorageProvider(input.storageProvider),
      storageKey: this.requireStorageKey(input.storageKey),
      fileName: this.requireFileName(input.fileName),
      mimeType: this.requireMimeType(input.mimeType),
      fileSize: this.requireFileSize(input.fileSize),
      checksum: this.requireChecksum(input.checksum),
    });

    if (result.status === 'organization_unavailable') {
      throw new FileModuleError(
        'FILE_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'actor_unavailable') {
      throw new FileModuleError('FILE_ACTOR_UNAVAILABLE', 'The actor is unavailable.');
    }
    if (result.status === 'conflict') {
      throw new FileModuleError('FILE_CONFLICT', 'The storage object is already registered.');
    }

    const file = this.requireFileBoundary(result.file, trusted);
    await this.eventPublisher.publish({
      name: 'file.registered',
      actorUserId: trusted.actorUserId,
      tenantId: file.tenantId,
      organizationId: file.organizationId,
      fileId: file.id,
      occurredAt: new Date(),
    });
    return file;
  }

  async listCurrentOrganizationFiles(
    context: OrganizationFileRequestContext,
    query: OrganizationFileListQuery = {},
  ): Promise<OrganizationFilePage> {
    const trusted = this.requireOrganizationContext(context, FILE_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new FileModuleError(
        'FILE_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }

    const result = await this.repository.listOrganizationFiles({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      limit,
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId') }),
    });

    if (result.status === 'organization_unavailable') {
      throw new FileModuleError(
        'FILE_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new FileModuleError(
        'FILE_CURSOR_INVALID',
        'The file cursor is invalid for the current organization.',
      );
    }
    if (!Array.isArray(result.items) || result.items.length > limit) {
      throw new FileModuleError(
        'FILE_INTEGRITY_FAILURE',
        'The file repository returned an invalid page.',
      );
    }

    const items = result.items.map((file) => this.requireFileBoundary(file, trusted));
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'FILE_INTEGRITY_FAILURE');
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requireOrganizationContext(
    context: OrganizationFileRequestContext,
    permission: FilePermission,
  ): {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly organizationId: string;
  } {
    const actorUserId = this.requireUuid(context.actorUserId, 'context.actorUserId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    if (!context.permissionCodes.has(permission)) {
      throw new FileModuleError('FILE_FORBIDDEN', `The operation requires ${permission}.`);
    }
    return { actorUserId, tenantId, organizationId };
  }

  private requireFileBoundary(
    record: FileRecord,
    context: { readonly tenantId: string; readonly organizationId: string },
  ): FileRecord {
    const id = this.requireUuid(record.id, 'file.id', 'FILE_INTEGRITY_FAILURE');
    const tenantId = this.requireUuid(record.tenantId, 'file.tenantId', 'FILE_INTEGRITY_FAILURE');
    const organizationId = this.requireUuid(
      record.organizationId,
      'file.organizationId',
      'FILE_INTEGRITY_FAILURE',
    );
    if (tenantId !== context.tenantId || organizationId !== context.organizationId) {
      throw new FileModuleError(
        'FILE_INTEGRITY_FAILURE',
        'The file repository returned a record outside the trusted boundary.',
      );
    }
    if (!(record.createdAt instanceof Date) || Number.isNaN(record.createdAt.getTime())) {
      throw new FileModuleError(
        'FILE_INTEGRITY_FAILURE',
        'The file repository returned an invalid creation timestamp.',
      );
    }
    return Object.freeze({
      id,
      tenantId,
      organizationId,
      fileName: this.requireStoredFileName(record.fileName),
      mimeType: this.requireStoredMimeType(record.mimeType),
      fileSize: this.requireFileSize(record.fileSize, 'FILE_INTEGRITY_FAILURE'),
      createdAt: new Date(record.createdAt.getTime()),
    });
  }

  private requireStorageProvider(value: string): string {
    if (typeof value !== 'string') {
      throw new FileModuleError('FILE_INVALID_INPUT', 'storageProvider is invalid.');
    }
    const normalized = value.normalize('NFKC').trim().toLowerCase();
    if (normalized.length > 64 || !PROVIDER_PATTERN.test(normalized)) {
      throw new FileModuleError('FILE_INVALID_INPUT', 'storageProvider is invalid.');
    }
    return normalized;
  }

  private requireStorageKey(value: string): string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > MAX_STORAGE_KEY_LENGTH ||
      Buffer.byteLength(value, 'utf8') > MAX_STORAGE_KEY_UTF8_BYTES ||
      containsControlCharacter(value)
    ) {
      throw new FileModuleError('FILE_INVALID_INPUT', 'storageKey is invalid.');
    }
    return value;
  }

  private requireFileName(value: string): string {
    if (typeof value !== 'string') {
      throw new FileModuleError('FILE_INVALID_INPUT', 'fileName is invalid.');
    }
    const normalized = this.normalizeText(value);
    if (
      normalized.length === 0 ||
      normalized.length > 255 ||
      containsControlCharacter(normalized) ||
      PATH_SEPARATOR_PATTERN.test(normalized)
    ) {
      throw new FileModuleError('FILE_INVALID_INPUT', 'fileName is invalid.');
    }
    return normalized;
  }

  private requireStoredFileName(value: string): string {
    if (typeof value !== 'string') {
      throw new FileModuleError('FILE_INTEGRITY_FAILURE', 'file.fileName is invalid.');
    }
    const normalized = this.normalizeText(value);
    if (
      value !== normalized ||
      value.length === 0 ||
      value.length > 255 ||
      containsControlCharacter(value) ||
      PATH_SEPARATOR_PATTERN.test(value)
    ) {
      throw new FileModuleError('FILE_INTEGRITY_FAILURE', 'file.fileName is invalid.');
    }
    return value;
  }

  private requireMimeType(value: string): string {
    if (typeof value !== 'string') {
      throw new FileModuleError('FILE_INVALID_INPUT', 'mimeType is invalid.');
    }
    const normalized = value.trim().toLowerCase();
    if (normalized.length > 255 || !MIME_TYPE_PATTERN.test(normalized)) {
      throw new FileModuleError('FILE_INVALID_INPUT', 'mimeType is invalid.');
    }
    return normalized;
  }

  private requireStoredMimeType(value: string): string {
    if (
      typeof value !== 'string' ||
      value !== value.trim().toLowerCase() ||
      value.length > 255 ||
      !MIME_TYPE_PATTERN.test(value)
    ) {
      throw new FileModuleError('FILE_INTEGRITY_FAILURE', 'file.mimeType is invalid.');
    }
    return value;
  }

  private requireFileSize(value: bigint, code: FileErrorCode = 'FILE_INVALID_INPUT'): bigint {
    if (typeof value !== 'bigint' || value < 0n || value > MAX_DATABASE_BIGINT) {
      throw new FileModuleError(code, 'fileSize is invalid.');
    }
    return value;
  }

  private requireChecksum(value: string): string {
    if (typeof value !== 'string') {
      throw new FileModuleError('FILE_INVALID_INPUT', 'checksum is invalid.');
    }
    const normalized = value.trim().toLowerCase();
    if (!SHA256_PATTERN.test(normalized)) {
      throw new FileModuleError(
        'FILE_INVALID_INPUT',
        'checksum must use the sha256:<lowercase-hex> format.',
      );
    }
    return normalized;
  }

  private requireUuid(
    value: string,
    field: string,
    code: FileErrorCode = 'FILE_INVALID_INPUT',
  ): string {
    if (typeof value !== 'string') {
      throw new FileModuleError(code, `${field} must be a valid UUID.`);
    }
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new FileModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  }
}
