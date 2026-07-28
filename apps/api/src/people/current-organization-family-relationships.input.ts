import type {
  CreatePersonRelationshipInput,
  EndPersonRelationshipInput,
  FamilyTreeQuery,
  RevokePersonRelationshipVerificationInput,
  UpdatePersonRelationshipInput,
  VerifyPersonRelationshipInput,
} from '@newax/people';
import { HttpSecurityError } from '@newax/http-security';

type ObjectValue = Record<string, unknown>;

export function parseFamilyTreeQuery(query: unknown): FamilyTreeQuery {
  const object = objectValue(query, 'query');
  allowed(object, ['depth', 'include_sensitive'], 'query');
  const result: { depth?: number; includeSensitive?: boolean } = {};
  if (object.depth !== undefined) {
    const depth = Number(stringValue(object.depth, 'depth'));
    if (!Number.isInteger(depth)) {
      invalid('depth must be an integer.');
    }
    result.depth = depth;
  }
  if (object.include_sensitive !== undefined) {
    result.includeSensitive = booleanQuery(object.include_sensitive, 'include_sensitive');
  }
  return result;
}

export function parseRelationshipViewQuery(query: unknown): boolean {
  const object = objectValue(query, 'query');
  allowed(object, ['include_sensitive'], 'query');
  return object.include_sensitive === undefined
    ? false
    : booleanQuery(object.include_sensitive, 'include_sensitive');
}

export function parseCreateRelationshipBody(body: unknown): CreatePersonRelationshipInput {
  const object = objectValue(body, 'body');
  allowed(
    object,
    [
      'source_person_id',
      'target_person_id',
      'relationship_type',
      'relationship_role',
      'relationship_basis',
      'valid_from',
      'valid_until',
      'source_reference',
    ],
    'body',
  );
  const result: {
    sourcePersonId: string;
    targetPersonId: string;
    relationshipType: string;
    relationshipRole: string;
    relationshipBasis: string;
    validFrom?: Date | null;
    validUntil?: Date | null;
    sourceReference?: string | null;
  } = {
    sourcePersonId: stringValue(object.source_person_id, 'source_person_id'),
    targetPersonId: stringValue(object.target_person_id, 'target_person_id'),
    relationshipType: stringValue(object.relationship_type, 'relationship_type'),
    relationshipRole: stringValue(object.relationship_role, 'relationship_role'),
    relationshipBasis: stringValue(object.relationship_basis, 'relationship_basis'),
  };
  if ('valid_from' in object) {
    result.validFrom = nullableDate(object.valid_from, 'valid_from');
  }
  if ('valid_until' in object) {
    result.validUntil = nullableDate(object.valid_until, 'valid_until');
  }
  if ('source_reference' in object) {
    result.sourceReference = nullableString(object.source_reference, 'source_reference');
  }
  return result;
}

export function parseUpdateRelationshipBody(body: unknown): UpdatePersonRelationshipInput {
  const object = objectValue(body, 'body');
  allowed(
    object,
    [
      'expected_version',
      'relationship_role',
      'relationship_basis',
      'valid_from',
      'valid_until',
      'source_reference',
    ],
    'body',
  );
  const result: {
    expectedVersion: number;
    relationshipRole?: string;
    relationshipBasis?: string;
    validFrom?: Date | null;
    validUntil?: Date | null;
    sourceReference?: string | null;
  } = { expectedVersion: integerValue(object.expected_version, 'expected_version') };
  if ('relationship_role' in object) {
    result.relationshipRole = stringValue(object.relationship_role, 'relationship_role');
  }
  if ('relationship_basis' in object) {
    result.relationshipBasis = stringValue(object.relationship_basis, 'relationship_basis');
  }
  if ('valid_from' in object) {
    result.validFrom = nullableDate(object.valid_from, 'valid_from');
  }
  if ('valid_until' in object) {
    result.validUntil = nullableDate(object.valid_until, 'valid_until');
  }
  if ('source_reference' in object) {
    result.sourceReference = nullableString(object.source_reference, 'source_reference');
  }
  return result;
}

export function parseEndRelationshipBody(body: unknown): EndPersonRelationshipInput {
  const object = objectValue(body, 'body');
  allowed(object, ['expected_version', 'valid_until'], 'body');
  const result: { expectedVersion: number; validUntil?: Date | null } = {
    expectedVersion: integerValue(object.expected_version, 'expected_version'),
  };
  if ('valid_until' in object) {
    result.validUntil = nullableDate(object.valid_until, 'valid_until');
  }
  return result;
}

export function parseVerifyRelationshipBody(body: unknown): VerifyPersonRelationshipInput {
  const object = objectValue(body, 'body');
  allowed(object, ['expected_version', 'verification_source', 'source_reference'], 'body');
  const result: {
    expectedVersion: number;
    verificationSource: string;
    sourceReference?: string | null;
  } = {
    expectedVersion: integerValue(object.expected_version, 'expected_version'),
    verificationSource: stringValue(object.verification_source, 'verification_source'),
  };
  if ('source_reference' in object) {
    result.sourceReference = nullableString(object.source_reference, 'source_reference');
  }
  return result;
}

export function parseRevokeVerificationBody(
  body: unknown,
): RevokePersonRelationshipVerificationInput {
  const object = objectValue(body, 'body');
  allowed(object, ['expected_version', 'reason'], 'body');
  return {
    expectedVersion: integerValue(object.expected_version, 'expected_version'),
    reason: stringValue(object.reason, 'reason'),
  };
}

function objectValue(value: unknown, field: string): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as ObjectValue;
}

function allowed(object: ObjectValue, keys: readonly string[], field: string): void {
  const accepted = new Set(keys);
  for (const key of Object.keys(object)) {
    if (!accepted.has(key)) {
      invalid(`${field} contains unsupported field ${key}.`);
    }
  }
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    invalid(`${field} must be text.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : stringValue(value, field);
}

function integerValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    invalid(`${field} must be an integer.`);
  }
  return value;
}

function nullableDate(value: unknown, field: string): Date | null {
  if (value === null) {
    return null;
  }
  const text = stringValue(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    invalid(`${field} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    invalid(`${field} must be a real calendar date.`);
  }
  return date;
}

function booleanQuery(value: unknown, field: string): boolean {
  const text = stringValue(value, field);
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  invalid(`${field} must be true or false.`);
}

function invalid(message: string): never {
  throw new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
