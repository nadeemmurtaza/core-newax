import type { CreateOrganizationObjectInput, OrganizationObjectListQuery } from '@newax/objects';
import { HttpSecurityError } from '@newax/http-security';

interface CurrentOrganizationObjectBody {
  readonly object_type_code: unknown;
  readonly parent_object_id?: unknown;
  readonly name: unknown;
  readonly reference_code?: unknown;
  readonly serial_number?: unknown;
  readonly description?: unknown;
}

const CREATE_BODY_KEYS = new Set([
  'object_type_code',
  'parent_object_id',
  'name',
  'reference_code',
  'serial_number',
  'description',
]);
const CREATE_QUERY_KEYS = new Set<string>();
const LIST_QUERY_KEYS = new Set(['object_type_code', 'limit', 'after_id']);
const INTEGER_PATTERN = /^[1-9]\d{0,2}$/u;

export function parseCurrentOrganizationObjectCreateQuery(query: unknown): void {
  const record = requireRecord(query, 'The object creation query must be an object.');
  rejectUnknownKeys(
    record,
    CREATE_QUERY_KEYS,
    'The object creation query does not support parameters.',
  );
}

export function parseCurrentOrganizationObjectBody(body: unknown): CreateOrganizationObjectInput {
  const record = requireRecord(body, 'The object request body must be a JSON object.');
  rejectUnknownKeys(
    record,
    CREATE_BODY_KEYS,
    'The object request body contains an unsupported field.',
  );

  for (const required of ['object_type_code', 'name']) {
    if (!hasOwn(record, required)) {
      throw invalidInput('object_type_code and name are required.');
    }
  }

  const parsed = record as unknown as CurrentOrganizationObjectBody;
  return {
    objectTypeCode: parseString(parsed.object_type_code, 'object_type_code'),
    ...(hasOwn(record, 'parent_object_id')
      ? {
          parentObjectId: parseNullableString(parsed.parent_object_id, 'parent_object_id'),
        }
      : {}),
    name: parseString(parsed.name, 'name'),
    ...(hasOwn(record, 'reference_code')
      ? {
          referenceCode: parseNullableString(parsed.reference_code, 'reference_code'),
        }
      : {}),
    ...(hasOwn(record, 'serial_number')
      ? {
          serialNumber: parseNullableString(parsed.serial_number, 'serial_number'),
        }
      : {}),
    ...(hasOwn(record, 'description')
      ? { description: parseNullableString(parsed.description, 'description') }
      : {}),
  };
}

export function parseCurrentOrganizationObjectsQuery(query: unknown): OrganizationObjectListQuery {
  const record = requireRecord(query, 'The objects query must be an object.');
  rejectUnknownKeys(record, LIST_QUERY_KEYS, 'The objects query contains an unsupported field.');

  const objectTypeCode = hasOwn(record, 'object_type_code')
    ? parseSingleString(record.object_type_code, 'object_type_code')
    : undefined;
  const limit = hasOwn(record, 'limit') ? parseLimit(record.limit) : undefined;
  const afterId = hasOwn(record, 'after_id')
    ? parseSingleString(record.after_id, 'after_id')
    : undefined;

  return {
    ...(objectTypeCode === undefined ? {} : { objectTypeCode }),
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

function invalidInput(message: string): HttpSecurityError {
  return new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
