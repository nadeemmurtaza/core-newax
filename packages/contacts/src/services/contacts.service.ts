import type { ContactsRepository } from '../database/contacts-repository';
import type { ContactEventPublisher } from '../events/contact-event';
import { ContactsModuleError } from '../errors/contacts-module-error';
import { CONTACT_PERMISSIONS, type ContactPermission } from '../permissions/contact-permissions';
import type {
  AddOrganizationContactInput,
  ContactsRequestContext,
  ContactType,
  OrganizationContact,
  OrganizationContactListQuery,
  OrganizationContactPage,
  OrganizationContactRecord,
} from '../types/contact';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_CONTACT_VALUE_LENGTH = 320;
const MAX_LABEL_LENGTH = 64;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/u;

interface NormalizedContactValue {
  readonly contactValue: string;
  readonly normalizedValue: string;
}

export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly eventPublisher: ContactEventPublisher,
  ) {}

  async addCurrentOrganizationContact(
    context: ContactsRequestContext,
    input: AddOrganizationContactInput,
  ): Promise<OrganizationContact> {
    const trusted = this.requireContext(context, CONTACT_PERMISSIONS.create);
    const contactType = this.normalizeContactType(input.contactType);
    const normalized = this.normalizeContactValue(contactType, input.contactValue);
    const validFrom = this.normalizeDate(input.validFrom, 'validFrom');
    const validUntil = this.normalizeDate(input.validUntil, 'validUntil');
    this.validateDateRange(validFrom, validUntil);

    const result = await this.repository.createOrganizationContact({
      organizationId: trusted.organizationId,
      contactType,
      contactValue: normalized.contactValue,
      normalizedValue: normalized.normalizedValue,
      label: this.normalizeNullableText(input.label, 'label', MAX_LABEL_LENGTH),
      isPrimary: this.normalizeBoolean(input.isPrimary, 'isPrimary', false),
      validFrom,
      validUntil,
    });

    if (result.status === 'organization_unavailable') {
      throw new ContactsModuleError(
        'CONTACT_ORGANIZATION_UNAVAILABLE',
        'The current organization is unavailable for contact operations.',
      );
    }

    if (result.status === 'conflict') {
      throw new ContactsModuleError(
        'CONTACT_CONFLICT',
        'The contact method is already assigned to the current organization.',
        { contactType },
      );
    }

    const contact = this.toPublicContact(
      this.requireRecord(result.contact, trusted.organizationId, contactType),
    );

    await this.eventPublisher.publish({
      name: 'contact.created',
      actorUserId: trusted.actorUserId,
      organizationId: trusted.organizationId,
      contactId: contact.id,
      contactMethodId: contact.contactMethodId,
      contactType: contact.contactType,
      occurredAt: new Date(),
    });

    return contact;
  }

  async listCurrentOrganizationContacts(
    context: ContactsRequestContext,
    query: OrganizationContactListQuery = {},
  ): Promise<OrganizationContactPage> {
    const trusted = this.requireContext(context, CONTACT_PERMISSIONS.view);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ContactsModuleError(
        'CONTACT_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
        { field: 'limit' },
      );
    }

    const afterId =
      query.afterId === undefined
        ? undefined
        : this.requireUuid(query.afterId, 'afterId', 'CONTACT_INVALID_INPUT');

    const result = await this.repository.listOrganizationContacts({
      organizationId: trusted.organizationId,
      limit,
      ...(afterId === undefined ? {} : { afterId }),
    });

    if (result.status === 'organization_unavailable') {
      throw new ContactsModuleError(
        'CONTACT_ORGANIZATION_UNAVAILABLE',
        'The current organization is unavailable for contact operations.',
      );
    }

    if (result.status === 'cursor_invalid') {
      throw new ContactsModuleError('CONTACT_INVALID_INPUT', 'afterId is not a valid cursor.', {
        field: 'afterId',
      });
    }

    const items = result.items.map((record) =>
      this.toPublicContact(this.requireRecord(record, trusted.organizationId)),
    );
    const nextCursor =
      result.nextCursor === null
        ? null
        : this.requireUuid(result.nextCursor, 'nextCursor', 'CONTACT_INTEGRITY_FAILURE');

    return Object.freeze({ items: Object.freeze(items), nextCursor });
  }

  private requireContext(
    context: ContactsRequestContext,
    permission: ContactPermission,
  ): { readonly actorUserId: string; readonly organizationId: string } {
    const actorUserId = this.requireUuid(
      context.actorUserId,
      'context.actorUserId',
      'CONTACT_INTEGRITY_FAILURE',
    );
    const organizationId = this.requireUuid(
      context.organizationId,
      'context.organizationId',
      'CONTACT_INTEGRITY_FAILURE',
    );

    const permissionCodes = context.permissionCodes as unknown;
    if (
      typeof permissionCodes !== 'object' ||
      permissionCodes === null ||
      !('has' in permissionCodes) ||
      typeof permissionCodes.has !== 'function'
    ) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'context.permissionCodes must be a readable permission set.',
      );
    }

    if (!context.permissionCodes.has(permission)) {
      throw new ContactsModuleError(
        'CONTACT_FORBIDDEN',
        `The operation requires the ${permission} permission.`,
        { permission },
      );
    }

    return { actorUserId, organizationId };
  }

  private normalizeContactType(value: unknown): ContactType {
    if (value === 'email' || value === 'phone') {
      return value;
    }

    throw new ContactsModuleError('CONTACT_INVALID_INPUT', 'contactType must be email or phone.', {
      field: 'contactType',
    });
  }

  private normalizeContactValue(contactType: ContactType, value: unknown): NormalizedContactValue {
    if (typeof value !== 'string') {
      throw new ContactsModuleError('CONTACT_INVALID_INPUT', 'contactValue must be a string.', {
        field: 'contactValue',
      });
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CONTACT_VALUE_LENGTH) {
      throw new ContactsModuleError(
        'CONTACT_INVALID_INPUT',
        `contactValue must contain between 1 and ${String(MAX_CONTACT_VALUE_LENGTH)} characters.`,
        { field: 'contactValue' },
      );
    }

    if (contactType === 'email') {
      const normalized = trimmed.toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) {
        throw new ContactsModuleError(
          'CONTACT_INVALID_INPUT',
          'contactValue must be a valid email address.',
          { field: 'contactValue' },
        );
      }
      return { contactValue: normalized, normalizedValue: normalized };
    }

    const normalized = trimmed.replace(/[\s().-]+/gu, '');
    if (!E164_PHONE_PATTERN.test(normalized)) {
      throw new ContactsModuleError(
        'CONTACT_INVALID_INPUT',
        'Phone contact values must use international E.164 format.',
        { field: 'contactValue' },
      );
    }
    return { contactValue: normalized, normalizedValue: normalized };
  }

  private normalizeNullableText(value: unknown, field: string, maxLength: number): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new ContactsModuleError('CONTACT_INVALID_INPUT', `${field} must be a string.`, {
        field,
      });
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }
    if (normalized.length > maxLength) {
      throw new ContactsModuleError(
        'CONTACT_INVALID_INPUT',
        `${field} must not exceed ${String(maxLength)} characters.`,
        { field, maxLength },
      );
    }
    return normalized;
  }

  private normalizeBoolean(value: unknown, field: string, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== 'boolean') {
      throw new ContactsModuleError('CONTACT_INVALID_INPUT', `${field} must be a boolean.`, {
        field,
      });
    }
    return value;
  }

  private normalizeDate(value: unknown, field: string): Date | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ContactsModuleError('CONTACT_INVALID_INPUT', `${field} must be a valid date.`, {
        field,
      });
    }
    return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  private validateDateRange(validFrom: Date | null, validUntil: Date | null): void {
    if (validFrom !== null && validUntil !== null && validUntil < validFrom) {
      throw new ContactsModuleError(
        'CONTACT_INVALID_INPUT',
        'validUntil cannot be earlier than validFrom.',
        { field: 'validUntil' },
      );
    }
  }

  private requireRecord(
    record: OrganizationContactRecord,
    organizationId: string,
    expectedType?: ContactType,
  ): OrganizationContactRecord {
    const id = this.requireUuid(record.id, 'contact.id', 'CONTACT_INTEGRITY_FAILURE');
    const recordOrganizationId = this.requireUuid(
      record.organizationId,
      'contact.organizationId',
      'CONTACT_INTEGRITY_FAILURE',
    );
    const contactMethodId = this.requireUuid(
      record.contactMethodId,
      'contact.contactMethodId',
      'CONTACT_INTEGRITY_FAILURE',
    );

    if (recordOrganizationId !== organizationId) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned a record outside the trusted organization boundary.',
      );
    }
    if (record.status !== 'active') {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned an inactive contact record.',
      );
    }

    const contactType = this.requireStoredContactType(record.contactType);
    if (expectedType !== undefined && contactType !== expectedType) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned an unexpected contact type.',
      );
    }
    const normalized = this.requireStoredContactValue(
      contactType,
      record.contactValue,
      record.normalizedValue,
    );
    if (normalized.normalizedValue !== record.normalizedValue) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned inconsistent normalized contact data.',
      );
    }

    if (typeof record.isPrimary !== 'boolean') {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned invalid primary metadata.',
      );
    }
    if (record.isVerified !== false || record.verifiedAt !== null) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'Organization contact verification is unavailable until ownership and evidence are defined.',
      );
    }

    const validFrom = this.requireOptionalStoredDate(record.validFrom, 'contact.validFrom');
    const validUntil = this.requireOptionalStoredDate(record.validUntil, 'contact.validUntil');
    this.validateStoredDateRange(validFrom, validUntil);
    const createdAt = this.requireStoredDate(record.createdAt, 'contact.createdAt');

    return {
      id,
      organizationId: recordOrganizationId,
      contactMethodId,
      contactType,
      contactValue: normalized.contactValue,
      normalizedValue: normalized.normalizedValue,
      isVerified: false,
      verifiedAt: null,
      label: this.requireStoredNullableText(record.label, 'contact.label', MAX_LABEL_LENGTH),
      isPrimary: record.isPrimary,
      status: 'active',
      validFrom,
      validUntil,
      createdAt,
    };
  }

  private toPublicContact(record: OrganizationContactRecord): OrganizationContact {
    return Object.freeze({
      id: record.id,
      organizationId: record.organizationId,
      contactMethodId: record.contactMethodId,
      contactType: record.contactType,
      contactValue: record.contactValue,
      isVerified: record.isVerified,
      verifiedAt: record.verifiedAt,
      label: record.label,
      isPrimary: record.isPrimary,
      status: 'active',
      validFrom: record.validFrom,
      validUntil: record.validUntil,
      createdAt: record.createdAt,
    });
  }

  private requireUuid(
    value: unknown,
    field: string,
    code: 'CONTACT_INTEGRITY_FAILURE' | 'CONTACT_INVALID_INPUT',
  ): string {
    if (typeof value !== 'string') {
      throw new ContactsModuleError(code, `${field} must be a valid UUID.`);
    }
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw new ContactsModuleError(code, `${field} must be a valid UUID.`);
    }
    return normalized;
  }

  private requireStoredContactType(value: unknown): ContactType {
    if (value === 'email' || value === 'phone') {
      return value;
    }
    throw new ContactsModuleError(
      'CONTACT_INTEGRITY_FAILURE',
      'The contacts repository returned an unsupported contact type.',
    );
  }

  private requireStoredContactValue(
    contactType: ContactType,
    contactValue: unknown,
    normalizedValue: unknown,
  ): NormalizedContactValue {
    if (typeof normalizedValue !== 'string') {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned invalid normalized contact data.',
      );
    }

    try {
      return this.normalizeContactValue(contactType, contactValue);
    } catch {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned invalid contact data.',
      );
    }
  }

  private requireStoredDate(value: unknown, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ContactsModuleError('CONTACT_INTEGRITY_FAILURE', `${field} is invalid.`);
    }
    return new Date(value.getTime());
  }

  private requireOptionalStoredDate(value: unknown, field: string): Date | null {
    if (value === null) {
      return null;
    }
    return this.requireStoredDate(value, field);
  }

  private validateStoredDateRange(validFrom: Date | null, validUntil: Date | null): void {
    if (validFrom !== null && validUntil !== null && validUntil < validFrom) {
      throw new ContactsModuleError(
        'CONTACT_INTEGRITY_FAILURE',
        'The contacts repository returned an invalid validity range.',
      );
    }
  }

  private requireStoredNullableText(
    value: unknown,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === null) {
      return null;
    }
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > maxLength ||
      value.trim() !== value
    ) {
      throw new ContactsModuleError('CONTACT_INTEGRITY_FAILURE', `${field} is invalid.`);
    }
    return value;
  }
}
