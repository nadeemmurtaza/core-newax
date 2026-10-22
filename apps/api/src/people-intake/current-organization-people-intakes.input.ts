import type {
  CreatePeopleIntakeDraftInput,
  PeopleIntakeListQuery,
  PeopleIntakePayloadInput,
  ReviewPeopleIntakeInput,
  SubmitPeopleIntakeInput,
  UpdatePeopleIntakeDraftInput,
} from '@newax/people-intake';
import { HttpSecurityError } from '@newax/http-security';

type ObjectValue = Record<string, unknown>;

export function parsePeopleIntakeListQuery(query: unknown): PeopleIntakeListQuery {
  const object = objectValue(query, 'query');
  allowed(object, ['status', 'limit', 'after_id'], 'query');
  const result: {
    status?: 'draft' | 'submitted' | 'approved' | 'rejected';
    limit?: number;
    afterId?: string;
  } = {};
  if (object.status !== undefined) {
    const value = stringValue(object.status, 'status');
    if (
      value !== 'draft' &&
      value !== 'submitted' &&
      value !== 'approved' &&
      value !== 'rejected'
    ) {
      invalid('status must be draft, submitted, approved, or rejected.');
    }
    result.status = value;
  }
  if (object.limit !== undefined) {
    const value = Number(stringValue(object.limit, 'limit'));
    if (!Number.isInteger(value)) {
      invalid('limit must be an integer.');
    }
    result.limit = value;
  }
  if (object.after_id !== undefined) {
    result.afterId = stringValue(object.after_id, 'after_id');
  }
  return result;
}

export function parseCreatePeopleIntakeBody(body: unknown): CreatePeopleIntakeDraftInput {
  const object = objectValue(body, 'body');
  allowed(object, ['title', 'source_type', 'source_reference', 'payload'], 'body');
  const result: {
    title: string;
    sourceType: string;
    sourceReference?: string | null;
    payload: PeopleIntakePayloadInput;
  } = {
    title: stringValue(object.title, 'title'),
    sourceType: stringValue(object.source_type, 'source_type'),
    payload: payloadValue(object.payload),
  };
  if ('source_reference' in object) {
    result.sourceReference = nullableString(object.source_reference, 'source_reference');
  }
  return result;
}

export function parseUpdatePeopleIntakeBody(body: unknown): UpdatePeopleIntakeDraftInput {
  const object = objectValue(body, 'body');
  allowed(
    object,
    ['expected_version', 'title', 'source_type', 'source_reference', 'payload'],
    'body',
  );
  const createBody: ObjectValue = {
    title: object.title,
    source_type: object.source_type,
    payload: object.payload,
  };
  if ('source_reference' in object) {
    createBody.source_reference = object.source_reference;
  }
  const base = parseCreatePeopleIntakeBody(createBody);
  return { ...base, expectedVersion: integerValue(object.expected_version, 'expected_version') };
}

export function parseSubmitPeopleIntakeBody(body: unknown): SubmitPeopleIntakeInput {
  const object = objectValue(body, 'body');
  allowed(object, ['expected_version'], 'body');
  return { expectedVersion: integerValue(object.expected_version, 'expected_version') };
}

export function parseReviewPeopleIntakeBody(body: unknown): ReviewPeopleIntakeInput {
  const object = objectValue(body, 'body');
  allowed(object, ['expected_version', 'decision', 'notes'], 'body');
  const decision = stringValue(object.decision, 'decision');
  if (decision !== 'approved' && decision !== 'rejected') {
    invalid('decision must be approved or rejected.');
  }
  const result: {
    expectedVersion: number;
    decision: 'approved' | 'rejected';
    notes?: string | null;
  } = {
    expectedVersion: integerValue(object.expected_version, 'expected_version'),
    decision,
  };
  if ('notes' in object) {
    result.notes = nullableString(object.notes, 'notes');
  }
  return result;
}

export function assertEmptyPeopleIntakeQuery(query: unknown): void {
  const object = objectValue(query, 'query');
  allowed(object, [], 'query');
}

function payloadValue(value: unknown): PeopleIntakePayloadInput {
  const object = objectValue(value, 'payload');
  allowed(object, ['schema_version', 'people', 'relationships'], 'payload');
  if (object.schema_version !== 1) {
    invalid('payload.schema_version must be 1.');
  }
  if (!Array.isArray(object.people) || !Array.isArray(object.relationships)) {
    invalid('payload.people and payload.relationships must be arrays.');
  }
  return {
    schemaVersion: 1,
    people: object.people.map((person, index) => personValue(person, index)),
    relationships: object.relationships.map((relationship, index) =>
      relationshipValue(relationship, index),
    ),
  };
}

function personValue(value: unknown, index: number) {
  const field = `payload.people[${String(index)}]`;
  const object = objectValue(value, field);
  allowed(
    object,
    [
      'client_key',
      'first_name',
      'middle_name',
      'last_name',
      'preferred_name',
      'date_of_birth',
      'gender',
      'identifiers',
    ],
    field,
  );
  const result: {
    clientKey: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    preferredName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    identifiers?: readonly ReturnType<typeof identifierValue>[];
  } = {
    clientKey: stringValue(object.client_key, `${field}.client_key`),
    firstName: stringValue(object.first_name, `${field}.first_name`),
    lastName: stringValue(object.last_name, `${field}.last_name`),
  };
  if ('middle_name' in object) {
    result.middleName = nullableString(object.middle_name, `${field}.middle_name`);
  }
  if ('preferred_name' in object) {
    result.preferredName = nullableString(object.preferred_name, `${field}.preferred_name`);
  }
  if ('date_of_birth' in object) {
    result.dateOfBirth = nullableString(object.date_of_birth, `${field}.date_of_birth`);
  }
  if ('gender' in object) {
    result.gender = nullableString(object.gender, `${field}.gender`);
  }
  if ('identifiers' in object) {
    if (!Array.isArray(object.identifiers)) {
      invalid(`${field}.identifiers must be an array.`);
    }
    result.identifiers = object.identifiers.map((identifier, identifierIndex) =>
      identifierValue(identifier, index, identifierIndex),
    );
  }
  return result;
}

function identifierValue(value: unknown, personIndex: number, identifierIndex: number) {
  const field = `payload.people[${String(personIndex)}].identifiers[${String(identifierIndex)}]`;
  const object = objectValue(value, field);
  allowed(
    object,
    ['identifier_type', 'identifier_value', 'issuing_authority', 'issuing_country_code'],
    field,
  );
  const result: {
    identifierType: string;
    identifierValue: string;
    issuingAuthority?: string | null;
    issuingCountryCode?: string | null;
  } = {
    identifierType: stringValue(object.identifier_type, `${field}.identifier_type`),
    identifierValue: stringValue(object.identifier_value, `${field}.identifier_value`),
  };
  if ('issuing_authority' in object) {
    result.issuingAuthority = nullableString(
      object.issuing_authority,
      `${field}.issuing_authority`,
    );
  }
  if ('issuing_country_code' in object) {
    result.issuingCountryCode = nullableString(
      object.issuing_country_code,
      `${field}.issuing_country_code`,
    );
  }
  return result;
}

function relationshipValue(value: unknown, index: number) {
  const field = `payload.relationships[${String(index)}]`;
  const object = objectValue(value, field);
  allowed(
    object,
    [
      'source_person_key',
      'target_person_key',
      'relationship_type',
      'relationship_role',
      'relationship_basis',
    ],
    field,
  );
  return {
    sourcePersonKey: stringValue(object.source_person_key, `${field}.source_person_key`),
    targetPersonKey: stringValue(object.target_person_key, `${field}.target_person_key`),
    relationshipType: stringValue(object.relationship_type, `${field}.relationship_type`),
    relationshipRole: stringValue(object.relationship_role, `${field}.relationship_role`),
    relationshipBasis: stringValue(object.relationship_basis, `${field}.relationship_basis`),
  };
}

function objectValue(value: unknown, field: string): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as ObjectValue;
}

function allowed(object: ObjectValue, keys: readonly string[], field: string): void {
  const allowedKeys = new Set(keys);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) {
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
  if (value === null) {
    return null;
  }
  return stringValue(value, field);
}

function integerValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    invalid(`${field} must be an integer.`);
  }
  return value;
}

function invalid(message: string): never {
  throw new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
