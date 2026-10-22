import type {
  CreateOrganizationAddressInput,
  OrganizationAddressListQuery,
  OrganizationAddressType,
} from '@newax/addresses';
import { HttpSecurityError } from '@newax/http-security';

interface CurrentOrganizationAddressBody {
  readonly address_type: unknown;
  readonly is_primary: unknown;
  readonly line_1: unknown;
  readonly line_2?: unknown;
  readonly city: unknown;
  readonly state_region?: unknown;
  readonly postal_code?: unknown;
  readonly country_code: unknown;
}

const CREATE_BODY_KEYS = new Set([
  'address_type',
  'is_primary',
  'line_1',
  'line_2',
  'city',
  'state_region',
  'postal_code',
  'country_code',
]);
const CREATE_QUERY_KEYS = new Set<string>();
const LIST_QUERY_KEYS = new Set(['address_type', 'limit', 'after_id']);
const ADDRESS_TYPES = new Set<OrganizationAddressType>([
  'registered',
  'office',
  'billing',
  'shipping',
  'mailing',
  'campus',
  'facility',
  'other',
]);
const INTEGER_PATTERN = /^[1-9]\d{0,2}$/u;

export function parseCurrentOrganizationAddressCreateQuery(query: unknown): void {
  const record = requireRecord(query, 'The address creation query must be an object.');
  rejectUnknownKeys(
    record,
    CREATE_QUERY_KEYS,
    'The address creation query does not support parameters.',
  );
}

export function parseCurrentOrganizationAddressBody(body: unknown): CreateOrganizationAddressInput {
  const record = requireRecord(body, 'The address request body must be a JSON object.');
  rejectUnknownKeys(
    record,
    CREATE_BODY_KEYS,
    'The address request body contains an unsupported field.',
  );

  for (const required of ['address_type', 'is_primary', 'line_1', 'city', 'country_code']) {
    if (!hasOwn(record, required)) {
      throw invalidInput('address_type, is_primary, line_1, city, and country_code are required.');
    }
  }

  const parsed = record as unknown as CurrentOrganizationAddressBody;
  return {
    addressType: parseAddressType(parsed.address_type),
    isPrimary: parseBoolean(parsed.is_primary, 'is_primary'),
    line1: parseString(parsed.line_1, 'line_1'),
    ...(hasOwn(record, 'line_2') ? { line2: parseNullableString(parsed.line_2, 'line_2') } : {}),
    city: parseString(parsed.city, 'city'),
    ...(hasOwn(record, 'state_region')
      ? { stateRegion: parseNullableString(parsed.state_region, 'state_region') }
      : {}),
    ...(hasOwn(record, 'postal_code')
      ? { postalCode: parseNullableString(parsed.postal_code, 'postal_code') }
      : {}),
    countryCode: parseString(parsed.country_code, 'country_code'),
  };
}

export function parseCurrentOrganizationAddressesQuery(
  query: unknown,
): OrganizationAddressListQuery {
  const record = requireRecord(query, 'The addresses query must be an object.');
  rejectUnknownKeys(record, LIST_QUERY_KEYS, 'The addresses query contains an unsupported field.');

  const addressType = hasOwn(record, 'address_type')
    ? parseAddressType(record.address_type)
    : undefined;
  const limit = hasOwn(record, 'limit') ? parseLimit(record.limit) : undefined;
  const afterId = hasOwn(record, 'after_id')
    ? parseSingleString(record.after_id, 'after_id')
    : undefined;

  return {
    ...(addressType === undefined ? {} : { addressType }),
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

function parseAddressType(value: unknown): OrganizationAddressType {
  if (typeof value !== 'string' || !ADDRESS_TYPES.has(value as OrganizationAddressType)) {
    throw invalidInput('address_type is invalid.');
  }
  return value as OrganizationAddressType;
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

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw invalidInput(`${field} must be a string.`);
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

function invalidInput(message: string): HttpSecurityError {
  return new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
