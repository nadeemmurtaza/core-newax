import { HttpSecurityError } from '@newax/http-security';
import type {
  LeadHarvesterBranchPayload,
  LeadHarvesterContactPointPayload,
  LeadHarvesterInstitutionPayload,
  LeadHarvesterInstitutionUpsertedPayload,
} from '@newax/lead-harvester-sync';

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'eventId',
  'eventType',
  'occurredAt',
  'institution',
  'branches',
  'contactPoints',
]);
const INSTITUTION_KEYS = new Set([
  'id',
  'canonicalName',
  'institutionType',
  'domain',
  'website',
  'status',
]);
const BRANCH_KEYS = new Set([
  'id',
  'branchName',
  'address',
  'city',
  'countryCode',
  'stateRegion',
  'postalCode',
]);
const CONTACT_POINT_KEYS = new Set(['id', 'contactType', 'contactValue', 'personName', 'role']);

export function parseLeadHarvesterInstitutionUpsertedPayload(
  body: unknown,
): LeadHarvesterInstitutionUpsertedPayload {
  const record = requireRecord(body, 'The webhook request body must be a JSON object.');
  rejectUnknownKeys(
    record,
    TOP_LEVEL_KEYS,
    'The webhook request body contains an unsupported field.',
  );

  return {
    schemaVersion: requireNumber(record.schemaVersion, 'schemaVersion'),
    eventId: requireNonBlankString(record.eventId, 'eventId'),
    eventType: requireLiteral(record.eventType, 'eventType', 'institution.upserted'),
    occurredAt: requireNonBlankString(record.occurredAt, 'occurredAt'),
    institution: parseInstitution(record.institution),
    branches: parseArray(record.branches, 'branches', parseBranch),
    contactPoints: parseArray(record.contactPoints, 'contactPoints', parseContactPoint),
  };
}

function parseInstitution(value: unknown): LeadHarvesterInstitutionPayload {
  const record = requireRecord(value, 'institution must be a JSON object.');
  rejectUnknownKeys(record, INSTITUTION_KEYS, 'institution contains an unsupported field.');

  return {
    id: requireNonBlankString(record.id, 'institution.id'),
    canonicalName: requireNonBlankString(record.canonicalName, 'institution.canonicalName'),
    institutionType: requireNonBlankString(record.institutionType, 'institution.institutionType'),
    domain: requireNullableString(record.domain, 'institution.domain'),
    website: requireNullableString(record.website, 'institution.website'),
    status: requireNonBlankString(record.status, 'institution.status'),
  };
}

function parseBranch(value: unknown, index: number): LeadHarvesterBranchPayload {
  const record = requireRecord(value, `branches[${String(index)}] must be a JSON object.`);
  rejectUnknownKeys(
    record,
    BRANCH_KEYS,
    `branches[${String(index)}] contains an unsupported field.`,
  );

  return {
    id: requireNonBlankString(record.id, `branches[${String(index)}].id`),
    branchName: requireNullableString(record.branchName, `branches[${String(index)}].branchName`),
    address: requireNonBlankString(record.address, `branches[${String(index)}].address`),
    city: requireNonBlankString(record.city, `branches[${String(index)}].city`),
    countryCode: requireNonBlankString(
      record.countryCode,
      `branches[${String(index)}].countryCode`,
    ),
    ...(hasOwn(record, 'stateRegion')
      ? {
          stateRegion: requireNullableString(
            record.stateRegion,
            `branches[${String(index)}].stateRegion`,
          ),
        }
      : {}),
    ...(hasOwn(record, 'postalCode')
      ? {
          postalCode: requireNullableString(
            record.postalCode,
            `branches[${String(index)}].postalCode`,
          ),
        }
      : {}),
  };
}

function parseContactPoint(value: unknown, index: number): LeadHarvesterContactPointPayload {
  const record = requireRecord(value, `contactPoints[${String(index)}] must be a JSON object.`);
  rejectUnknownKeys(
    record,
    CONTACT_POINT_KEYS,
    `contactPoints[${String(index)}] contains an unsupported field.`,
  );

  return {
    id: requireNonBlankString(record.id, `contactPoints[${String(index)}].id`),
    contactType: requireNonBlankString(
      record.contactType,
      `contactPoints[${String(index)}].contactType`,
    ),
    contactValue: requireNonBlankString(
      record.contactValue,
      `contactPoints[${String(index)}].contactValue`,
    ),
    ...(hasOwn(record, 'personName')
      ? {
          personName: requireNullableString(
            record.personName,
            `contactPoints[${String(index)}].personName`,
          ),
        }
      : {}),
    ...(hasOwn(record, 'role')
      ? { role: requireNullableString(record.role, `contactPoints[${String(index)}].role`) }
      : {}),
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

function parseArray<T>(
  value: unknown,
  field: string,
  parseItem: (item: unknown, index: number) => T,
): readonly T[] {
  if (!Array.isArray(value)) {
    throw invalidInput(`${field} must be an array.`);
  }
  return value.map((item, index) => parseItem(item, index));
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidInput(`${field} must be a number.`);
  }
  return value;
}

function requireNonBlankString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidInput(`${field} must be a non-blank string.`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidInput(`${field} must be a string or null.`);
  }
  return value;
}

function requireLiteral<T extends string>(value: unknown, field: string, literal: T): T {
  if (value !== literal) {
    throw invalidInput(`${field} must be "${literal}".`);
  }
  return literal;
}

function invalidInput(message: string): HttpSecurityError {
  return new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
