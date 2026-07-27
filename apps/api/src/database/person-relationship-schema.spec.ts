import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260715190000_add_person_relationship_foundation/migration.sql',
  ),
  'utf8',
);

describe('person relationship database foundation', () => {
  it('registers the tenant-scoped person relationship model', () => {
    expect(schema).toContain('model CorePersonRelationship');
    expect(schema).toContain('tenantId');
    expect(schema).toContain('sourcePersonId');
    expect(schema).toContain('targetPersonId');
    expect(schema).toContain('relationshipType');
    expect(schema).toContain('relationshipRole');
    expect(schema).toContain('relationshipBasis');
    expect(schema).toContain('verificationSource');
    expect(schema).toContain('@@map("core_person_relationships")');
  });

  it('enforces relational, temporal, verification, duplicate, and cycle integrity', () => {
    expect(migration).toContain('core_person_relationships_distinct_people_check');
    expect(migration).toContain('core_person_relationships_validity_check');
    expect(migration).toContain('core_person_relationships_verification_check');
    expect(migration).toContain('core_person_relationships_active_identity_key');
    expect(migration).toContain('core_person_relationships_tenant_id_fkey');
    expect(migration).toContain('core_person_relationships_source_person_id_fkey');
    expect(migration).toContain('core_person_relationships_target_person_id_fkey');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('core_person_relationships_parent_cycle_trigger');
  });
});
