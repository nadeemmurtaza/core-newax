import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;

function code(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

describe.skipIf(!databaseUrl)('person relationship operation database integrity', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl ?? 'postgresql://invalid/invalid' });
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  async function transaction(assertion: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertion(client);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  it('accepts complete revocation metadata and rejects partial revocation claims', async () => {
    await transaction(async (client) => {
      const tenantId = randomUUID();
      const verifierPersonId = randomUUID();
      const sourcePersonId = randomUUID();
      const targetPersonId = randomUUID();
      const verifierUserId = randomUUID();
      await client.query(
        `INSERT INTO "core_tenants" ("id", "name", "updated_at") VALUES ($1, 'Test', CURRENT_TIMESTAMP)`,
        [tenantId],
      );
      for (const [id, firstName] of [
        [verifierPersonId, 'Verifier'],
        [sourcePersonId, 'Source'],
        [targetPersonId, 'Target'],
      ]) {
        await client.query(
          `INSERT INTO "core_people" ("id", "first_name", "last_name", "updated_at")
           VALUES ($1, $2, 'Person', CURRENT_TIMESTAMP)`,
          [id, firstName],
        );
      }
      await client.query(
        `INSERT INTO "core_users" ("id", "person_id", "status", "updated_at")
         VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)`,
        [verifierUserId, verifierPersonId],
      );
      await client.query(
        `INSERT INTO "core_person_relationships" (
           "id", "tenant_id", "source_person_id", "target_person_id",
           "relationship_type", "relationship_role", "relationship_basis",
           "verification_revoked_at", "verification_revoked_by_user_id",
           "verification_revocation_reason"
         ) VALUES ($1, $2, $3, $4, 'parent_of', 'parent', 'declared', CURRENT_TIMESTAMP, $5, 'Evidence was superseded')`,
        [randomUUID(), tenantId, sourcePersonId, targetPersonId, verifierUserId],
      );
      await expect(
        client.query(
          `INSERT INTO "core_person_relationships" (
             "id", "tenant_id", "source_person_id", "target_person_id",
             "relationship_type", "relationship_role", "relationship_basis",
             "verification_revoked_at", "verification_revoked_by_user_id"
           ) VALUES ($1, $2, $3, $4, 'guardian_of', 'guardian', 'legal', CURRENT_TIMESTAMP, $5)`,
          [randomUUID(), tenantId, sourcePersonId, targetPersonId, verifierUserId],
        ),
      ).rejects.toSatisfy((error: unknown) => code(error) === '23514');
    });
  });
});
