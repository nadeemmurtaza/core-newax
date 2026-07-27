import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;

interface RelationshipFixture {
  readonly tenantId: string;
  readonly personIds: readonly string[];
}

async function createFixture(
  client: PoolClient,
  personCount: number,
): Promise<RelationshipFixture> {
  const tenantId = randomUUID();

  await client.query(
    `INSERT INTO "core_tenants" ("id", "name", "updated_at")
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [tenantId, `Relationship test ${tenantId}`],
  );

  const personIds = Array.from({ length: personCount }, () => randomUUID());
  for (const [index, personId] of personIds.entries()) {
    await client.query(
      `INSERT INTO "core_people" (
         "id",
         "first_name",
         "last_name",
         "updated_at"
       ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [personId, `Person${index + 1}`, 'RelationshipTest'],
    );
  }

  return { tenantId, personIds };
}

function personIdAt(fixture: RelationshipFixture, index: number): string {
  const personId = fixture.personIds[index];
  if (!personId) {
    throw new Error(`Missing fixture person at index ${index}.`);
  }
  return personId;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function insertParentRelationship(
  client: PoolClient,
  fixture: RelationshipFixture,
  sourcePersonId: string,
  targetPersonId: string,
  overrides: {
    readonly id?: string;
    readonly validUntil?: string | null;
    readonly isVerified?: boolean;
    readonly verifiedAt?: string | null;
    readonly verificationSource?: string | null;
  } = {},
): Promise<void> {
  await client.query(
    `INSERT INTO "core_person_relationships" (
       "id",
       "tenant_id",
       "source_person_id",
       "target_person_id",
       "relationship_type",
       "relationship_role",
       "relationship_basis",
       "valid_until",
       "is_verified",
       "verified_at",
       "verification_source"
     ) VALUES ($1, $2, $3, $4, 'parent_of', 'parent', 'declared', $5, $6, $7, $8)`,
    [
      overrides.id ?? randomUUID(),
      fixture.tenantId,
      sourcePersonId,
      targetPersonId,
      overrides.validUntil ?? null,
      overrides.isVerified ?? false,
      overrides.verifiedAt ?? null,
      overrides.verificationSource ?? null,
    ],
  );
}

describe.skipIf(!databaseUrl)('person relationship PostgreSQL integrity', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: databaseUrl ?? 'postgresql://invalid/invalid',
    });
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  async function withTransaction(assertion: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertion(client);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  async function waitForAdvisoryLockWait(backendPid: number): Promise<void> {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const result = await pool.query<{ waiting: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_locks
           WHERE pid = $1
             AND locktype = 'advisory'
             AND granted = false
         ) AS "waiting"`,
        [backendPid],
      );
      if (result.rows[0]?.waiting) {
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('The competing relationship write did not wait on the Tenant advisory lock.');
  }

  async function deleteCommittedFixture(fixture: RelationshipFixture): Promise<void> {
    await pool.query(`DELETE FROM "core_person_relationships" WHERE "tenant_id" = $1`, [
      fixture.tenantId,
    ]);
    await pool.query(`DELETE FROM "core_people" WHERE "id" = ANY($1::uuid[])`, [fixture.personIds]);
    await pool.query(`DELETE FROM "core_tenants" WHERE "id" = $1`, [fixture.tenantId]);
  }

  it('stores one verified parent relationship between two people', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 2);
      const parentId = personIdAt(fixture, 0);
      const childId = personIdAt(fixture, 1);

      await insertParentRelationship(client, fixture, parentId, childId, {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verificationSource: 'nadra_crc',
      });

      const result = await client.query<{
        relationship_type: string;
        is_verified: boolean;
      }>(
        `SELECT "relationship_type", "is_verified"
         FROM "core_person_relationships"
         WHERE "tenant_id" = $1`,
        [fixture.tenantId],
      );

      expect(result.rows).toEqual([{ relationship_type: 'parent_of', is_verified: true }]);
    });
  });

  it('rejects a relationship from a person to the same person', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 1);
      const personId = personIdAt(fixture, 0);

      await expect(
        insertParentRelationship(client, fixture, personId, personId),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('rejects duplicate active relationships even when an end date is scheduled', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 2);
      const parentId = personIdAt(fixture, 0);
      const childId = personIdAt(fixture, 1);
      const validUntil = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

      await insertParentRelationship(client, fixture, parentId, childId, {
        validUntil,
      });

      await expect(
        insertParentRelationship(client, fixture, parentId, childId, {
          validUntil,
        }),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('rejects a verified relationship without verification evidence', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 2);
      const parentId = personIdAt(fixture, 0);
      const childId = personIdAt(fixture, 1);

      await expect(
        insertParentRelationship(client, fixture, parentId, childId, {
          isVerified: true,
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('rejects a verified relationship with a blank verification source', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 2);
      const parentId = personIdAt(fixture, 0);
      const childId = personIdAt(fixture, 1);

      await expect(
        insertParentRelationship(client, fixture, parentId, childId, {
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          verificationSource: '   ',
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('rejects an active parentage cycle', async () => {
    await withTransaction(async (client) => {
      const fixture = await createFixture(client, 3);
      const firstPersonId = personIdAt(fixture, 0);
      const secondPersonId = personIdAt(fixture, 1);
      const thirdPersonId = personIdAt(fixture, 2);

      await insertParentRelationship(client, fixture, firstPersonId, secondPersonId);
      await insertParentRelationship(client, fixture, secondPersonId, thirdPersonId);

      await expect(
        insertParentRelationship(client, fixture, thirdPersonId, firstPersonId),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('serializes concurrent inverse parent links and rejects the second cycle', async () => {
    let fixture: RelationshipFixture | undefined;
    const setupClient = await pool.connect();
    try {
      fixture = await createFixture(setupClient, 2);
    } finally {
      setupClient.release();
    }

    const firstClient = await pool.connect();
    const secondClient = await pool.connect();
    let firstTransactionEnded = false;
    let secondTransactionEnded = false;

    try {
      const firstPersonId = personIdAt(fixture, 0);
      const secondPersonId = personIdAt(fixture, 1);

      await firstClient.query('BEGIN');
      await secondClient.query('BEGIN');
      const secondBackend = await secondClient.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS "pid"',
      );
      const secondBackendPid = secondBackend.rows[0]?.pid;
      if (!secondBackendPid) {
        throw new Error('Could not resolve the competing PostgreSQL backend PID.');
      }

      await insertParentRelationship(firstClient, fixture, firstPersonId, secondPersonId);

      const inverseAttempt = insertParentRelationship(
        secondClient,
        fixture,
        secondPersonId,
        firstPersonId,
      ).then(
        () => ({ status: 'fulfilled' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      );

      await waitForAdvisoryLockWait(secondBackendPid);
      await firstClient.query('COMMIT');
      firstTransactionEnded = true;

      const inverseResult = await inverseAttempt;
      expect(inverseResult.status).toBe('rejected');
      if (inverseResult.status !== 'rejected') {
        throw new Error('The concurrent inverse parent relationship unexpectedly succeeded.');
      }
      expect(postgresErrorCode(inverseResult.error)).toBe('23514');

      await secondClient.query('ROLLBACK');
      secondTransactionEnded = true;
    } finally {
      if (!firstTransactionEnded) {
        await firstClient.query('ROLLBACK').catch(() => undefined);
      }
      if (!secondTransactionEnded) {
        await secondClient.query('ROLLBACK').catch(() => undefined);
      }
      firstClient.release();
      secondClient.release();
      await deleteCommittedFixture(fixture);
    }
  });
});
