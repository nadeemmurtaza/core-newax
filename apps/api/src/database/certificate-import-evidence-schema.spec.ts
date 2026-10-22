import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260717070000_add_certificate_import_evidence_staging/migration.sql',
  ),
  'utf8',
);

describe('certificate import evidence schema', () => {
  it('owns evidence and certificate import records', () => {
    expect(schema).toContain('model CorePeopleIntakeEvidence');
    expect(schema).toContain('model CoreCertificateImport');
    expect(schema).toContain('extractionPayload');
    expect(schema).toContain('confidenceBps');
  });

  it('enforces scope, lifecycle, reviewer separation, and evidence immutability', () => {
    expect(migration).toContain('core_certificate_imports_payload_check');
    expect(migration).toContain('core_certificate_imports_state_check');
    expect(migration).toContain('core_certificate_imports_reviewer_check');
    expect(migration).toContain('core_certificate_imports_transition_trigger');
    expect(migration).toContain('core_people_intake_evidence_draft_trigger');
    expect(migration).toContain('core_people_intake_evidence_mutation_trigger');
    expect(migration).toContain('core_files_scope_organization_id_key');
  });
});
