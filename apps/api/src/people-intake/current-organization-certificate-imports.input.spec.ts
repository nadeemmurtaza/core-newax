import { describe, expect, it } from 'vitest';
import {
  parseApplyImportBody,
  parseAttachEvidenceBody,
  parseExtractionBody,
} from './current-organization-certificate-imports.input';

describe('certificate import HTTP input', () => {
  it('parses evidence attachment', () => {
    expect(parseAttachEvidenceBody({ file_id: 'id', document_type: 'birth_certificate' })).toEqual({
      fileId: 'id',
      documentType: 'birth_certificate',
    });
  });
  it('parses extraction and preserves structured payload', () => {
    const result = parseExtractionBody({
      expected_version: 1,
      extractor_code: 'manual',
      extraction_version: '1',
      confidence_bps: 9000,
      payload: { schemaVersion: 1, people: [], relationships: [] },
    });
    expect(result.confidenceBps).toBe(9000);
  });
  it('rejects unsupported fields', () => {
    expect(() =>
      parseApplyImportBody({
        expected_import_version: 1,
        expected_intake_version: 1,
        tenant_id: 'forged',
      }),
    ).toThrow();
  });
});
