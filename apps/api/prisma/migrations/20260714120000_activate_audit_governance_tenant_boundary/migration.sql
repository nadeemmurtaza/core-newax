-- Audit entries may be global, Tenant-scoped, or Organization-scoped. Existing
-- Organization entries inherit their owning Tenant before composite enforcement.
ALTER TABLE "core_audit_logs"
ADD COLUMN "tenant_id" UUID;

UPDATE "core_audit_logs" AS "audit"
SET "tenant_id" = "organization"."tenant_id"
FROM "core_organizations" AS "organization"
WHERE "audit"."organization_id" = "organization"."id";

ALTER TABLE "core_audit_logs"
DROP CONSTRAINT "core_audit_logs_organization_id_fkey";

DROP INDEX "core_audit_logs_organization_id_created_at_idx";

ALTER TABLE "core_audit_logs"
ADD CONSTRAINT "core_audit_logs_organization_requires_tenant_check"
CHECK ("organization_id" IS NULL OR "tenant_id" IS NOT NULL);

CREATE INDEX "core_audit_logs_tenant_id_organization_id_created_at_id_idx"
ON "core_audit_logs"("tenant_id", "organization_id", "created_at", "id");

CREATE INDEX "core_audit_logs_tenant_id_created_at_idx"
ON "core_audit_logs"("tenant_id", "created_at");

ALTER TABLE "core_audit_logs"
ADD CONSTRAINT "core_audit_logs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_audit_logs"
ADD CONSTRAINT "core_audit_logs_tenant_id_organization_id_fkey"
FOREIGN KEY ("tenant_id", "organization_id")
REFERENCES "core_organizations"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
