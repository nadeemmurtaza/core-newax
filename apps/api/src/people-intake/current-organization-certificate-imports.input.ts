import type {
  ApplyCertificateImportInput,
  AttachEvidenceInput,
  PeopleIntakePayloadInput,
  RecordCertificateExtractionInput,
  ReviewCertificateImportInput,
} from '@newax/people-intake';
import { HttpSecurityError } from '@newax/http-security';

type ObjectValue = Record<string, unknown>;

export function parseAttachEvidenceBody(body: unknown): AttachEvidenceInput {
  const value = object(body);
  allowed(value, ['file_id', 'document_type', 'evidence_role']);
  return {
    fileId: text(value.file_id, 'file_id'),
    documentType: text(value.document_type, 'document_type'),
    ...(value.evidence_role === undefined
      ? {}
      : { evidenceRole: text(value.evidence_role, 'evidence_role') }),
  };
}

export function parseExtractionBody(body: unknown): RecordCertificateExtractionInput {
  const value = object(body);
  allowed(value, [
    'expected_version',
    'extractor_code',
    'extraction_version',
    'confidence_bps',
    'payload',
  ]);
  return {
    expectedVersion: integer(value.expected_version, 'expected_version'),
    extractorCode: text(value.extractor_code, 'extractor_code'),
    extractionVersion: text(value.extraction_version, 'extraction_version'),
    confidenceBps: integer(value.confidence_bps, 'confidence_bps'),
    payload: object(value.payload) as unknown as PeopleIntakePayloadInput,
  };
}

export function parseImportReviewBody(body: unknown): ReviewCertificateImportInput {
  const value = object(body);
  allowed(value, ['expected_version', 'decision', 'notes']);
  return {
    expectedVersion: integer(value.expected_version, 'expected_version'),
    decision: text(value.decision, 'decision') as 'accepted' | 'rejected',
    ...(value.notes === undefined ? {} : { notes: nullableText(value.notes, 'notes') }),
  };
}

export function parseApplyImportBody(body: unknown): ApplyCertificateImportInput {
  const value = object(body);
  allowed(value, ['expected_import_version', 'expected_intake_version']);
  return {
    expectedImportVersion: integer(value.expected_import_version, 'expected_import_version'),
    expectedIntakeVersion: integer(value.expected_intake_version, 'expected_intake_version'),
  };
}

function object(value: unknown): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid('body must be an object.');
  }
  return value as ObjectValue;
}

function allowed(value: ObjectValue, keys: readonly string[]): void {
  const accepted = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) {
      invalid(`body contains unsupported field ${key}.`);
    }
  }
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    invalid(`${field} must be text.`);
  }
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  return value === null ? null : text(value, field);
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    invalid(`${field} must be an integer.`);
  }
  return value;
}

function invalid(message: string): never {
  throw new HttpSecurityError('HTTP_SECURITY_INVALID_INPUT', message, 400);
}
