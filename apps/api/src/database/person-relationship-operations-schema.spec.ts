import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260717010000_govern_person_relationship_operations/migration.sql',
  ),
  'utf8',
);

describe('person relationship operation schema', () => {
  it('adds optimistic version and verification revocation ownership', () => {
    expect(schema).toContain('version                      Int       @default(1)');
    expect(schema).toContain('verificationRevocationReason');
    expect(schema).toContain('PersonRelationshipVerificationRevokedBy');
  });

  it('enforces version and complete verification states in PostgreSQL', () => {
    expect(migration).toContain('core_person_relationships_version_check');
    expect(migration).toContain('verification_revocation_reason');
    expect(migration).toContain('btrim("verification_source") <>');
    expect(migration).toContain('verification_revoked_by_user_id_fkey');
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(schema).toContain('onDelete: Restrict');
  });
});
