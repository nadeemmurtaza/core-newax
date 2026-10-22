import { HttpSecurityError } from '@newax/http-security';
import type { AddOrganizationContactInput, OrganizationContactListQuery } from '@newax/contacts';

interface CurrentOrganizationContactBody {
  readonly contact_type: unknown;
  readonly contact_value: unknown;
  readonly label?: unknown;
  readonly is_primary?: unknown;
  readonly valid_from?: unknown;
  readonly valid_until?: unknown;
}

const CREATE_BODY_KEYS = new Set([
  'contact_type',
  'contact_value',
  'label',
  'is_primary',
  'valid_from',
  'valid_until',
]);
const CREATE_QUERY_KEYS = new Set<string>();
const LIST_QUERY_KEYS = new Set(['limit', 'after_id']);
const INTEGER_PATTERN = /^[1-9]\d{0,2}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function parseCurrentOrganizationContactCreateQuery(query: unknown): void {
  const record = requireRecord(query, 'The contact creation query must be an object.');
  rejectUnknownKeys(
    record,
    CREATE_QUERY_KEYS,
    'The contact creation query does not support parameters.',
  );
}

export function parseCurrentOrganizationContactBody(body: unknown): AddOrganizationContactInput {
  const record = requireRecord(body, 'The contact request body must be a JSON object.');
  rejectUnknownKeys(
    record,
    CREATE_BODY_KEYS,
    'The contact request body contains an unsupported field.',
  );

  if (!hasOwn(record, 'contact_type') || !hasOwn(record, 'contact_value')) {
    throw invalidInput('contact_type and contact_value are required.');
  }

  const parsed = record as unknown as CurrentOrganizationContactBody;
  const contactType = parsed.contact_type;
  if (contactType !== 'email' && contactType !== 'phone') {
    throw invalidInput('contact_type must be email or phone.');
  }
  if (typeof parsed.contact_value !== 'string') {
    throw invalidInput('contact_value must be a string.');
  }

  return {
    contactType,
    contactValue: parsed.contact_value,
    ...(hasOwn(record, 'label') ? { label: parseNullableString(parsed.label, 'label') } : {}),
    ...(hasOwn(record, 'is_primary')
      ? { isPrimary: parseBoolean(parsed.is_primary, 'is_primary') }
      : {}),
    ...(hasOwn(record, 'valid_from')
      ? { validFrom: parseNullableDate(parsed.valid_from, 'valid_from') }
      : {}),
    ...(hasOwn(record, 'valid_until')
      ? { validUntil: parseNullableDate(parsed.valid_until, 'valid_until') }
      : {}),
  };
}

export function parseCurrentOrganizationContactsQuery(
  query: unknown,
): OrganizationContactListQuery {
  const record = requireRecord(query, 'The contacts query must be an object.');
  rejectUnknownKeys(record, LIST_QUERY_KEYS, 'The contacts query contains an unsupported field.');

  const limit = hasOwn(record, 'limit') ? parseLimit(record.limit) : undefined;
  const afterId = hasOwn(record, 'after_id')
    ? parseSingleString(record.after_id, 'after_id')
    : undefined;

  return {
    ...(limit === undefined ? {} : { limit }),
    ...(afterId === undefined ? {} : { afterId }),
  };
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidInput(message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  record: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  message: string,
): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw invalidInput(message);
  }
}

function parseLimit(value: unknown): number {
  const normalized = parseSingleString(value, 'limit');
  if (!INTEGER_PATTERN.test(normalized)) {
    throw invalidInput('limit must be an integer between 1 and 100.');
  }
  const limit = Number(normalized);
  if (limit < 1 || limit > 100) {
    throw invalidInput('limit must be an integer between 1 and 100.');
  }
  return limit;
}

function parseSingleString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidInput(`${field} must be a single non-empty string.`);
  }
  return value;
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidInput(`${field} must be a string or null.`);
  }
  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalidInput(`${field} must be a boolean.`);
  }
  return value;
}

function parseNullableDate(value: unknown, field: string): Date | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw invalidInput(`${field} must use YYYY-MM-DD format or be null.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalidInput(`${field} must be a valid calendar date.`);
  }
  return parsed;
}

function invalidInput(message: string): HttpSecurityError {
  return new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
