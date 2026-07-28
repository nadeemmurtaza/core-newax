import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;

interface Fixture {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly creatorUserId: string;
  readonly reviewerUserId: string;
}

async function fixture(client: PoolClient): Promise<Fixture> {
  const tenantId = randomUUID();
  const organizationId = randomUUID();
  const creatorPersonId = randomUUID();
  const reviewerPersonId = randomUUID();
  const creatorUserId = randomUUID();
  const reviewerUserId = randomUUID();
  await client.query(
    `INSERT INTO "core_tenants" ("id", "name", "updated_at") VALUES ($1, 'Intake Test', CURRENT_TIMESTAMP)`,
    [tenantId],
  );
  await client.query(
    `INSERT INTO "core_organizations" (
      "id", "tenant_id", "legal_name", "display_name", "organization_type", "updated_at"
    ) VALUES ($1, $2, 'Intake Test', 'Intake Test', 'company', CURRENT_TIMESTAMP)`,
    [organizationId, tenantId],
  );
  for (const [personId, firstName] of [
    [creatorPersonId, 'Creator'],
    [reviewerPersonId, 'Reviewer'],
  ] as const) {
    await client.query(
      `INSERT INTO "core_people" ("id", "first_name", "last_name", "updated_at")
       VALUES ($1, $2, 'IntakeTest', CURRENT_TIMESTAMP)`,
      [personId, firstName],
    );
  }
  await client.query(
    `INSERT INTO "core_users" ("id", "person_id", "status", "updated_at")
     VALUES ($1, $2, 'active', CURRENT_TIMESTAMP), ($3, $4, 'active', CURRENT_TIMESTAMP)`,
    [creatorUserId, creatorPersonId, reviewerUserId, reviewerPersonId],
  );
  return { tenantId, organizationId, creatorUserId, reviewerUserId };
}

async function createDraft(client: PoolClient, value: Fixture): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "core_people_intakes" (
      "id", "tenant_id", "organization_id", "title", "source_type", "payload",
      "person_count", "relationship_count", "created_by_user_id"
    ) VALUES ($1, $2, $3, 'Family intake', 'manual', $4::jsonb, 1, 0, $5)`,
    [
      id,
      value.tenantId,
      value.organizationId,
      JSON.stringify({ schemaVersion: 1, people: [{ clientKey: 'person' }], relationships: [] }),
      value.creatorUserId,
    ],
  );
  return id;
}

async function submit(client: PoolClient, id: string): Promise<void> {
  await client.query(
    `UPDATE "core_people_intakes"
     SET "status" = 'submitted', "submitted_at" = CURRENT_TIMESTAMP, "version" = 2
     WHERE "id" = $1`,
    [id],
  );
}

describe.skipIf(!databaseUrl)('People Intake PostgreSQL integrity', () => {
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

  it('supports a four-eye draft, submit, and approval transition', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await submit(client, id);
      await client.query(
        `UPDATE "core_people_intakes"
         SET "status" = 'approved', "review_decision" = 'approved',
             "reviewed_at" = CURRENT_TIMESTAMP, "reviewed_by_user_id" = $2, "version" = 3
         WHERE "id" = $1`,
        [id, value.reviewerUserId],
      );
      const result = await client.query<{ status: string; version: number }>(
        `SELECT "status", "version" FROM "core_people_intakes" WHERE "id" = $1`,
        [id],
      );
      expect(result.rows).toEqual([{ status: 'approved', version: 3 }]);
    });
  });

  it('rejects self-review', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await submit(client, id);
      await expect(
        client.query(
          `UPDATE "core_people_intakes"
           SET "status" = 'approved', "review_decision" = 'approved',
               "reviewed_at" = CURRENT_TIMESTAMP, "reviewed_by_user_id" = $2, "version" = 3
           WHERE "id" = $1`,
          [id, value.creatorUserId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('requires nonblank notes for rejection', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await submit(client, id);
      await expect(
        client.query(
          `UPDATE "core_people_intakes"
           SET "status" = 'rejected', "review_decision" = 'rejected',
               "reviewed_at" = CURRENT_TIMESTAMP, "reviewed_by_user_id" = $2,
               "review_notes" = '   ', "version" = 3
           WHERE "id" = $1`,
          [id, value.reviewerUserId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('keeps Tenant, Organization, and creator ownership immutable while draft', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await expect(
        client.query(
          `UPDATE "core_people_intakes"
           SET "created_by_user_id" = $2, "version" = 2
           WHERE "id" = $1`,
          [id, value.reviewerUserId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('requires every update to increment the optimistic version exactly once', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await expect(
        client.query(
          `UPDATE "core_people_intakes"
           SET "title" = 'Skipped version', "version" = 3
           WHERE "id" = $1`,
          [id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('makes submitted content immutable', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const id = await createDraft(client, value);
      await submit(client, id);
      await expect(
        client.query(
          `UPDATE "core_people_intakes"
           SET "title" = 'Changed after submit', "version" = 3 WHERE "id" = $1`,
          [id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });
});
