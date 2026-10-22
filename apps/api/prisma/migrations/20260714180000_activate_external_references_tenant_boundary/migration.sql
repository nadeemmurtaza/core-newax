-- External References remain usable for global governance records, but every Organization-scoped
-- mapping must carry the owning Tenant and prove that Tenant/Organization pair relationally.
ALTER TABLE "core_external_references"
ADD COLUMN "tenant_id" UUID;

UPDATE "core_external_references" AS external_reference
SET "tenant_id" = organization."tenant_id"
FROM "core_organizations" AS organization
WHERE external_reference."organization_id" = organization."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "core_external_references"
    WHERE "organization_id" IS NOT NULL
      AND "tenant_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot activate External References Tenant ownership: an Organization-scoped mapping has no resolvable Tenant';
  END IF;
END
$$;

ALTER TABLE "core_external_references"
DROP CONSTRAINT "core_external_references_organization_id_fkey";

DROP INDEX "core_external_references_organization_id_external_system_ex_key";
DROP INDEX "core_external_references_domain_code_entity_type_entity_id_idx";

ALTER TABLE "core_external_references"
ADD CONSTRAINT "core_external_refs_org_requires_tenant_check"
CHECK ("organization_id" IS NULL OR "tenant_id" IS NOT NULL);

CREATE UNIQUE INDEX "core_external_refs_scope_system_key_key"
ON "core_external_references"("tenant_id", "organization_id", "external_system", "external_key");

CREATE INDEX "core_external_refs_scope_entity_idx"
ON "core_external_references"("tenant_id", "organization_id", "domain_code", "entity_type", "entity_id");

CREATE INDEX "core_external_refs_scope_cursor_idx"
ON "core_external_references"("tenant_id", "organization_id", "id");

ALTER TABLE "core_external_references"
ADD CONSTRAINT "core_external_references_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_external_references"
ADD CONSTRAINT "core_external_references_tenant_id_organization_id_fkey"
FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "core_organizations"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
