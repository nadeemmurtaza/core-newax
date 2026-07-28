-- Add the customer isolation key without invalidating existing Object rows mid-migration.
ALTER TABLE "core_objects" ADD COLUMN "tenant_id" UUID;

-- Existing Objects inherit Tenant ownership from their owning Organization.
UPDATE "core_objects" object
SET "tenant_id" = organization."tenant_id"
FROM "core_organizations" organization
WHERE organization."id" = object."owning_organization_id";

-- Stop rather than inventing ownership for malformed historical records.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "core_objects" WHERE "tenant_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign every existing object to a tenant. Repair orphaned owning organizations first.';
  END IF;
END $$;

-- Existing parent-child relationships must already remain inside one Tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "core_objects" child
    JOIN "core_objects" parent ON parent."id" = child."parent_object_id"
    WHERE child."tenant_id" IS DISTINCT FROM parent."tenant_id"
  ) THEN
    RAISE EXCEPTION 'Existing object hierarchy crosses tenant boundaries.';
  END IF;
END $$;

ALTER TABLE "core_objects" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "core_objects" DROP CONSTRAINT "core_objects_owning_organization_id_fkey";
ALTER TABLE "core_objects" DROP CONSTRAINT "core_objects_parent_object_id_fkey";

DROP INDEX "core_objects_object_type_id_status_idx";
DROP INDEX "core_objects_parent_object_id_idx";

CREATE UNIQUE INDEX "core_objects_tenant_id_id_key"
  ON "core_objects"("tenant_id", "id");
CREATE INDEX "core_objects_tenant_owner_type_status_idx"
  ON "core_objects"("tenant_id", "owning_organization_id", "object_type_id", "status");
CREATE INDEX "core_objects_tenant_parent_idx"
  ON "core_objects"("tenant_id", "parent_object_id");

ALTER TABLE "core_objects"
  ADD CONSTRAINT "core_objects_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_objects"
  ADD CONSTRAINT "core_objects_tenant_owner_fkey"
  FOREIGN KEY ("tenant_id", "owning_organization_id")
  REFERENCES "core_organizations"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_objects"
  ADD CONSTRAINT "core_objects_tenant_parent_fkey"
  FOREIGN KEY ("tenant_id", "parent_object_id")
  REFERENCES "core_objects"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
