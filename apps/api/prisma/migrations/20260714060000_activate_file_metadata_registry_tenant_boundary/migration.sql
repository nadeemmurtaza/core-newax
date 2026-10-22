-- Add the customer isolation key without invalidating existing File metadata mid-migration.
ALTER TABLE "core_files" ADD COLUMN "tenant_id" UUID;

-- Existing File metadata inherits Tenant ownership from its Organization.
UPDATE "core_files" file
SET "tenant_id" = organization."tenant_id"
FROM "core_organizations" organization
WHERE organization."id" = file."organization_id";

-- Stop rather than inventing ownership for malformed historical records.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "core_files" WHERE "tenant_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign every existing file to a tenant. Repair orphaned organizations first.';
  END IF;
END $$;

ALTER TABLE "core_files" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "core_files" DROP CONSTRAINT "core_files_organization_id_fkey";

DROP INDEX "core_files_organization_id_status_created_at_idx";

CREATE UNIQUE INDEX "core_files_tenant_id_id_key"
  ON "core_files"("tenant_id", "id");
CREATE INDEX "core_files_tenant_id_organization_id_status_created_at_idx"
  ON "core_files"("tenant_id", "organization_id", "status", "created_at");

ALTER TABLE "core_files"
  ADD CONSTRAINT "core_files_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_files"
  ADD CONSTRAINT "core_files_tenant_id_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id")
  REFERENCES "core_organizations"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
