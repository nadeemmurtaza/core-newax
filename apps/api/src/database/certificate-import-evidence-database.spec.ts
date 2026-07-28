import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const CHECKSUM = `sha256:${'a'.repeat(64)}`;

interface Fixture {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly foreignOrganizationId: string;
  readonly creatorUserId: string;
  readonly extractorUserId: string;
  readonly reviewerUserId: string;
  readonly intakeId: string;
  readonly fileId: string;
  readonly foreignFileId: string;
}

async function fixture(client: PoolClient): Promise<Fixture> {
  const tenantId = randomUUID();
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const creatorPersonId = randomUUID();
  const extractorPersonId = randomUUID();
  const reviewerPersonId = randomUUID();
  const creatorUserId = randomUUID();
  const extractorUserId = randomUUID();
  const reviewerUserId = randomUUID();
  const intakeId = randomUUID();
  const fileId = randomUUID();
  const foreignFileId = randomUUID();

  await client.query(
    `INSERT INTO "core_tenants" ("id", "name", "updated_at")
     VALUES ($1, 'Certificate Import Test', CURRENT_TIMESTAMP)`,
    [tenantId],
  );
  await client.query(
    `INSERT INTO "core_organizations" (
       "id", "tenant_id", "legal_name", "display_name", "organization_type", "updated_at"
     ) VALUES
       ($1, $3, 'Certificate Import Organization', 'Certificate Import Organization', 'company', CURRENT_TIMESTAMP),
       ($2, $3, 'Foreign Certificate Organization', 'Foreign Certificate Organization', 'company', CURRENT_TIMESTAMP)`,
    [organizationId, foreignOrganizationId, tenantId],
  );

  for (const [personId, firstName] of [
    [creatorPersonId, 'Creator'],
    [extractorPersonId, 'Extractor'],
    [reviewerPersonId, 'Reviewer'],
  ] as const) {
    await client.query(
      `INSERT INTO "core_people" ("id", "first_name", "last_name", "updated_at")
       VALUES ($1, $2, 'CertificateTest', CURRENT_TIMESTAMP)`,
      [personId, firstName],
    );
  }
  await client.query(
    `INSERT INTO "core_users" ("id", "person_id", "status", "updated_at")
     VALUES
       ($1, $2, 'active', CURRENT_TIMESTAMP),
       ($3, $4, 'active', CURRENT_TIMESTAMP),
       ($5, $6, 'active', CURRENT_TIMESTAMP)`,
    [
      creatorUserId,
      creatorPersonId,
      extractorUserId,
      extractorPersonId,
      reviewerUserId,
      reviewerPersonId,
    ],
  );

  await client.query(
    `INSERT INTO "core_people_intakes" (
       "id", "tenant_id", "organization_id", "title", "source_type", "payload",
       "person_count", "relationship_count", "created_by_user_id"
     ) VALUES ($1, $2, $3, 'Certificate intake', 'certificate', $4::jsonb, 1, 0, $5)`,
    [
      intakeId,
      tenantId,
      organizationId,
      JSON.stringify({
        schemaVersion: 1,
        people: [{ clientKey: 'person', firstName: 'Initial', lastName: 'Record' }],
        relationships: [],
      }),
      creatorUserId,
    ],
  );

  await client.query(
    `INSERT INTO "core_files" (
       "id", "tenant_id", "organization_id", "storage_provider", "storage_key",
       "file_name", "mime_type", "file_size", "checksum", "created_by_user_id"
     ) VALUES
       ($1, $3, $4, 'integration.store', $5, 'certificate.pdf', 'application/pdf', 1024, $6, $7),
       ($2, $3, $8, 'integration.store', $9, 'foreign.pdf', 'application/pdf', 1024, $6, $7)`,
    [
      fileId,
      foreignFileId,
      tenantId,
      organizationId,
      `certificate/${randomUUID()}`,
      CHECKSUM,
      creatorUserId,
      foreignOrganizationId,
      `certificate/${randomUUID()}`,
    ],
  );

  return {
    tenantId,
    organizationId,
    foreignOrganizationId,
    creatorUserId,
    extractorUserId,
    reviewerUserId,
    intakeId,
    fileId,
    foreignFileId,
  };
}

async function attachEvidence(client: PoolClient, value: Fixture): Promise<string> {
  const evidenceId = randomUUID();
  await client.query(
    `INSERT INTO "core_people_intake_evidence" (
       "id", "tenant_id", "organization_id", "intake_id", "file_id",
       "document_type", "evidence_role", "attached_by_user_id"
     ) VALUES ($1, $2, $3, $4, $5, 'birth_certificate', 'primary', $6)`,
    [
      evidenceId,
      value.tenantId,
      value.organizationId,
      value.intakeId,
      value.fileId,
      value.creatorUserId,
    ],
  );
  return evidenceId;
}

async function createImport(
  client: PoolClient,
  value: Fixture,
  evidenceId: string,
): Promise<string> {
  const importId = randomUUID();
  await client.query(
    `INSERT INTO "core_certificate_imports" (
       "id", "tenant_id", "organization_id", "evidence_id"
     ) VALUES ($1, $2, $3, $4)`,
    [importId, value.tenantId, value.organizationId, evidenceId],
  );
  return importId;
}

const extractedPayload = JSON.stringify({
  schemaVersion: 1,
  people: [{ clientKey: 'child', firstName: 'Sara', lastName: 'Khan' }],
  relationships: [],
});

describe.skipIf(!databaseUrl)('Certificate import evidence PostgreSQL integrity', () => {
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

  it('accepts same-Organization evidence and rejects a foreign Organization file', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      await expect(attachEvidence(client, value)).resolves.toEqual(expect.any(String));

      await expect(
        client.query(
          `INSERT INTO "core_people_intake_evidence" (
             "id", "tenant_id", "organization_id", "intake_id", "file_id",
             "document_type", "evidence_role", "attached_by_user_id"
           ) VALUES ($1, $2, $3, $4, $5, 'birth_certificate', 'primary', $6)`,
          [
            randomUUID(),
            value.tenantId,
            value.organizationId,
            value.intakeId,
            value.foreignFileId,
            value.creatorUserId,
          ],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('rejects evidence attachment after submission', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      await client.query(
        `UPDATE "core_people_intakes"
         SET "status" = 'submitted', "submitted_at" = CURRENT_TIMESTAMP, "version" = 2
         WHERE "id" = $1`,
        [value.intakeId],
      );

      await expect(attachEvidence(client, value)).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('makes attached evidence immutable after submission', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const evidenceId = await attachEvidence(client, value);
      await client.query(
        `UPDATE "core_people_intakes"
         SET "status" = 'submitted', "submitted_at" = CURRENT_TIMESTAMP, "version" = 2
         WHERE "id" = $1`,
        [value.intakeId],
      );

      await expect(
        client.query(
          `UPDATE "core_people_intake_evidence"
           SET "evidence_role" = 'secondary' WHERE "id" = $1`,
          [evidenceId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('supports pending, extracted, accepted, and applied transitions', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const evidenceId = await attachEvidence(client, value);
      const importId = await createImport(client, value, evidenceId);

      await client.query(
        `UPDATE "core_certificate_imports"
         SET "status" = 'extracted', "extraction_payload" = $2::jsonb,
             "extractor_code" = 'manual', "extraction_version" = '1',
             "confidence_bps" = 9000, "extracted_by_user_id" = $3,
             "extracted_at" = CURRENT_TIMESTAMP, "version" = 2
         WHERE "id" = $1`,
        [importId, extractedPayload, value.extractorUserId],
      );
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "status" = 'accepted', "reviewed_by_user_id" = $2,
             "reviewed_at" = CURRENT_TIMESTAMP, "review_decision" = 'accepted',
             "version" = 3
         WHERE "id" = $1`,
        [importId, value.reviewerUserId],
      );
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "applied_by_user_id" = $2, "applied_at" = CURRENT_TIMESTAMP, "version" = 4
         WHERE "id" = $1`,
        [importId, value.creatorUserId],
      );

      const result = await client.query<{
        status: string;
        version: number;
        applied_by_user_id: string;
      }>(
        `SELECT "status", "version", "applied_by_user_id"
         FROM "core_certificate_imports" WHERE "id" = $1`,
        [importId],
      );
      expect(result.rows).toEqual([
        { status: 'accepted', version: 4, applied_by_user_id: value.creatorUserId },
      ]);
    });
  });

  it('rejects self-review at the database boundary', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const evidenceId = await attachEvidence(client, value);
      const importId = await createImport(client, value, evidenceId);
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "status" = 'extracted', "extraction_payload" = $2::jsonb,
             "extractor_code" = 'manual', "extraction_version" = '1',
             "confidence_bps" = 9000, "extracted_by_user_id" = $3,
             "extracted_at" = CURRENT_TIMESTAMP, "version" = 2
         WHERE "id" = $1`,
        [importId, extractedPayload, value.extractorUserId],
      );

      await expect(
        client.query(
          `UPDATE "core_certificate_imports"
           SET "status" = 'accepted', "reviewed_by_user_id" = $2,
               "reviewed_at" = CURRENT_TIMESTAMP, "review_decision" = 'accepted',
               "version" = 3
           WHERE "id" = $1`,
          [importId, value.extractorUserId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('rejects invalid state jumps and skipped optimistic versions', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const evidenceId = await attachEvidence(client, value);
      const importId = await createImport(client, value, evidenceId);

      await expect(
        client.query(
          `UPDATE "core_certificate_imports"
           SET "status" = 'extracted', "extraction_payload" = $2::jsonb,
               "extractor_code" = 'manual', "extraction_version" = '1',
               "confidence_bps" = 9000, "extracted_by_user_id" = $3,
               "extracted_at" = CURRENT_TIMESTAMP, "version" = 3
           WHERE "id" = $1`,
          [importId, extractedPayload, value.extractorUserId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('keeps extraction and review evidence immutable and prevents reapplication', async () => {
    await transaction(async (client) => {
      const value = await fixture(client);
      const evidenceId = await attachEvidence(client, value);
      const importId = await createImport(client, value, evidenceId);
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "status" = 'extracted', "extraction_payload" = $2::jsonb,
             "extractor_code" = 'manual', "extraction_version" = '1',
             "confidence_bps" = 9000, "extracted_by_user_id" = $3,
             "extracted_at" = CURRENT_TIMESTAMP, "version" = 2
         WHERE "id" = $1`,
        [importId, extractedPayload, value.extractorUserId],
      );
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "status" = 'accepted', "reviewed_by_user_id" = $2,
             "reviewed_at" = CURRENT_TIMESTAMP, "review_decision" = 'accepted',
             "version" = 3
         WHERE "id" = $1`,
        [importId, value.reviewerUserId],
      );
      await client.query(
        `UPDATE "core_certificate_imports"
         SET "applied_by_user_id" = $2, "applied_at" = CURRENT_TIMESTAMP, "version" = 4
         WHERE "id" = $1`,
        [importId, value.creatorUserId],
      );

      await expect(
        client.query(
          `UPDATE "core_certificate_imports"
           SET "review_notes" = 'changed later', "version" = 5 WHERE "id" = $1`,
          [importId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });
});
