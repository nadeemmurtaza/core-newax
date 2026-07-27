import { createHash } from 'node:crypto';

import type { AddressRepository } from '../database/address-repository';
import type { AddressEventPublisher } from '../events/address-event';
import { AddressModuleError } from '../errors/address-module-error';
import { ADDRESS_PERMISSIONS, type AddressPermission } from '../permissions/address-permissions';
import type {
  CreateOrganizationAddressInput,
  OrganizationAddressListQuery,
  OrganizationAddressPage,
  OrganizationAddressRecord,
  OrganizationAddressRequestContext,
  OrganizationAddressType,
} from '../types/address';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/u;
const allowedAddressTypes = new Set<OrganizationAddressType>([
  'registered',
  'office',
  'billing',
  'shipping',
  'mailing',
  'campus',
  'facility',
  'other',
]);

export class AddressesService {
  constructor(
    private readonly repository: AddressRepository,
    private readonly eventPublisher: AddressEventPublisher,
  ) {}

  async addCurrentOrganizationAddress(
    context: OrganizationAddressRequestContext,
    input: CreateOrganizationAddressInput,
  ): Promise<OrganizationAddressRecord> {
    const trusted = this.requireContext(context, ADDRESS_PERMISSIONS.create);
    const addressType = this.requireAddressType(input.addressType);
    const isPrimary = this.requireBoolean(input.isPrimary, 'isPrimary');
    const line1 = this.requireText(input.line1, 'line1', 255);
    const line2 = this.requireOptionalText(input.line2, 'line2', 255);
    const city = this.requireText(input.city, 'city', 128);
    const stateRegion = this.requireOptionalText(input.stateRegion, 'stateRegion', 128);
    const postalCode = this.requireOptionalPostalCode(input.postalCode);
    const countryCode = this.requireCountryCode(input.countryCode);
    const canonicalKey = this.createCanonicalKey({
      line1,
      line2,
      city,
      stateRegion,
      postalCode,
      countryCode,
    });

    const result = await this.repository.createOrganizationAddress({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      addressType,
      isPrimary,
      line1,
      line2,
      city,
      stateRegion,
      postalCode,
      countryCode,
      canonicalKey,
    });

    if (result.status === 'organization_unavailable') {
      throw new AddressModuleError(
        'ADDRESS_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'conflict') {
      throw new AddressModuleError('ADDRESS_CONFLICT', 'The organization address already exists.');
    }

    const address = this.requireRecordBoundary(result.address, trusted);
    await this.eventPublisher.publish({
      name: 'address.created',
      actorUserId: trusted.actorUserId,
      tenantId: address.tenantId,
      organizationId: address.organizationId,
      organizationAddressId: address.id,
      addressId: address.addressId,
      addressType: address.addressType,
      isPrimary: address.isPrimary,
      occurredAt: new Date(),
    });
    return address;
  }

  async listCurrentOrganizationAddresses(
    context: OrganizationAddressRequestContext,
    query: OrganizationAddressListQuery = {},
  ): Promise<OrganizationAddressPage> {
    const trusted = this.requireContext(context, ADDRESS_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new AddressModuleError(
        'ADDRESS_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }

    const result = await this.repository.listOrganizationAddresses({
      tenantId: trusted.tenantId,
      organizationId: trusted.organizationId,
      limit,
      ...(query.addressType === undefined
        ? {}
        : { addressType: this.requireAddressType(query.addressType) }),
      ...(query.afterId === undefined
        ? {}
        : { afterId: this.requireUuid(query.afterId, 'afterId') }),
    });

    if (result.status === 'organization_unavailable') {
      throw new AddressModuleError(
        'ADDRESS_ORGANIZATION_UNAVAILABLE',
        'The organization is unavailable.',
      );
    }
    if (result.status === 'cursor_invalid') {
      throw new AddressModuleError(
        'ADDRESS_CURSOR_INVALID',
        'The address cursor is invalid for the current organization.',
      );
    }
    if (!Array.isArray(result.items) || result.items.length > limit) {
      throw new AddressModuleError(
        'ADDRESS_INTEGRITY_FAILURE',
        'The address repository returned an invalid page.',
      );
    }

    const items = result.items.map((address) => this.requireRecordBoundary(address, trusted));
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'ADDRESS_INTEGRITY_FAILURE');
    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requireContext(
    context: OrganizationAddressRequestContext,
    permission: AddressPermission,
  ): {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly organizationId: string;
  } {
    const actorUserId = this.requireUuid(context.actorUserId, 'context.actorUserId');
    const tenantId = this.requireUuid(context.tenantId, 'context.tenantId');
    const organizationId = this.requireUuid(context.organizationId, 'context.organizationId');
    if (!context.permissionCodes.has(permission)) {
      throw new AddressModuleError('ADDRESS_FORBIDDEN', `The operation requires ${permission}.`);
    }
    return { actorUserId, tenantId, organizationId };
  }

  private requireRecordBoundary(
    record: OrganizationAddressRecord,
    context: { readonly tenantId: string; readonly organizationId: string },
  ): OrganizationAddressRecord {
    const id = this.requireUuid(record.id, 'address.id', 'ADDRESS_INTEGRITY_FAILURE');
    const tenantId = this.requireUuid(
      record.tenantId,
      'address.tenantId',
      'ADDRESS_INTEGRITY_FAILURE',
    );
    const organizationId = this.requireUuid(
      record.organizationId,
      'address.organizationId',
      'ADDRESS_INTEGRITY_FAILURE',
    );
    const addressId = this.requireUuid(
      record.addressId,
      'address.addressId',
      'ADDRESS_INTEGRITY_FAILURE',
    );
    if (tenantId !== context.tenantId || organizationId !== context.organizationId) {
      throw new AddressModuleError(
        'ADDRESS_INTEGRITY_FAILURE',
        'The address repository returned a record outside the trusted boundary.',
      );
    }
    if (!(record.createdAt instanceof Date) || Number.isNaN(record.createdAt.getTime())) {
      throw new AddressModuleError(
        'ADDRESS_INTEGRITY_FAILURE',
        'The address repository returned an invalid creation timestamp.',
      );
    }
    return Object.freeze({
      id,
      tenantId,
      organizationId,
      addressId,
      addressType: this.requireAddressType(record.addressType, 'ADDRESS_INTEGRITY_FAILURE'),
      isPrimary: this.requireBoolean(
        record.isPrimary,
        'address.isPrimary',
        'ADDRESS_INTEGRITY_FAILURE',
      ),
      line1: this.requireStoredText(record.line1, 'address.line1', 255),
      line2: this.requireStoredOptionalText(record.line2, 'address.line2', 255),
      city: this.requireStoredText(record.city, 'address.city', 128),
      stateRegion: this.requireStoredOptionalText(record.stateRegion, 'address.stateRegion', 128),
      postalCode: this.requireStoredOptionalPostalCode(record.postalCode),
      countryCode: this.requireCountryCode(record.countryCode, 'ADDRESS_INTEGRITY_FAILURE'),
      createdAt: new Date(record.createdAt.getTime()),
    });
  }

  private requireAddressType(
    value: string,
    code: 'ADDRESS_INTEGRITY_FAILURE' | 'ADDRESS_INVALID_INPUT' = 'ADDRESS_INVALID_INPUT',
  ): OrganizationAddressType {
    const normalized = value.trim().toLowerCase();
    if (!allowedAddressTypes.has(normalized as OrganizationAddressType)) {
      throw new AddressModuleError(code, 'addressType is invalid.');
    }
    return normalized as OrganizationAddressType;
  }

  private requireBoolean(
    value: boolean,
    field: string,
    code: 'ADDRESS_INTEGRITY_FAILURE' | 'ADDRESS_INVALID_INPUT' = 'ADDRESS_INVALID_INPUT',
  ): boolean {
    if (typeof value !== 'boolean') {
      throw new AddressModuleError(code, `${field} must be a boolean.`);
    }
    return value;
  }

  private requireText(value: string, field: string, maxLength: number): string {
    const normalized = this.normalizeText(value);
    if (normalized.length === 0 || normalized.length > maxLength) {
      throw new AddressModuleError('ADDRESS_INVALID_INPUT', `${field} is invalid.`);
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
      throw new AddressModuleError('ADDRESS_INTEGRITY_FAILURE', `${field} is invalid.`);
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

  private requireOptionalPostalCode(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = this.normalizeText(value).toUpperCase();
    if (normalized.length === 0 || normalized.length > 32) {
      throw new AddressModuleError('ADDRESS_INVALID_INPUT', 'postalCode is invalid.');
    }
    return normalized;
  }

  private requireStoredOptionalPostalCode(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    if (value.length === 0 || value.length > 32 || value !== value.toUpperCase()) {
      throw new AddressModuleError('ADDRESS_INTEGRITY_FAILURE', 'address.postalCode is invalid.');
    }
    return value;
  }

  private requireCountryCode(
    value: string,
    code: 'ADDRESS_INTEGRITY_FAILURE' | 'ADDRESS_INVALID_INPUT' = 'ADDRESS_INVALID_INPUT',
  ): string {
    const normalized = this.normalizeText(value).toUpperCase();
    if (!COUNTRY_CODE_PATTERN.test(normalized)) {
      throw new AddressModuleError(code, 'countryCode must contain exactly two ASCII letters.');
    }
    return normalized;
  }

  private requireUuid(
    value: string,
    field: string,
    code: 'ADDRESS_INTEGRITY_FAILURE' | 'ADDRESS_INVALID_INPUT' = 'ADDRESS_INVALID_INPUT',
  ): string {
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new AddressModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  }

  private createCanonicalKey(input: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly stateRegion: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  }): string {
    return createHash('sha256')
      .update(
        [
          input.line1,
          input.line2 ?? '',
          input.city,
          input.stateRegion ?? '',
          input.postalCode ?? '',
          input.countryCode,
        ]
          .map((value) => value.toLowerCase())
          .join('\u001f'),
      )
      .digest('hex');
  }
}
