-- CreateTable
CREATE TABLE "core_tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "core_tenants_pkey" PRIMARY KEY ("id")
);

-- Add tenant ownership columns without making existing rows invalid mid-migration.
ALTER TABLE "core_organizations" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "core_organization_relationships" ADD COLUMN "tenant_id" UUID;

-- Give every existing top-level organization a separate deterministic tenant ID.
INSERT INTO "core_tenants" ("id", "name", "status", "created_at", "updated_at")
SELECT
    (
      substr(md5(o."id"::text || ':newax-tenant'), 1, 8) || '-' ||
      substr(md5(o."id"::text || ':newax-tenant'), 9, 4) || '-' ||
      substr(md5(o."id"::text || ':newax-tenant'), 13, 4) || '-' ||
      substr(md5(o."id"::text || ':newax-tenant'), 17, 4) || '-' ||
      substr(md5(o."id"::text || ':newax-tenant'), 21, 12)
    )::uuid,
    o."display_name",
    CASE WHEN o."status" = 'archived' THEN 'archived' ELSE 'active' END,
    o."created_at",
    o."updated_at"
FROM "core_organizations" o
WHERE o."parent_organization_id" IS NULL;

-- Assign each organization to the tenant of its hierarchy root.
WITH RECURSIVE organization_tree AS (
    SELECT
        o."id" AS organization_id,
        (
          substr(md5(o."id"::text || ':newax-tenant'), 1, 8) || '-' ||
          substr(md5(o."id"::text || ':newax-tenant'), 9, 4) || '-' ||
          substr(md5(o."id"::text || ':newax-tenant'), 13, 4) || '-' ||
          substr(md5(o."id"::text || ':newax-tenant'), 17, 4) || '-' ||
          substr(md5(o."id"::text || ':newax-tenant'), 21, 12)
        )::uuid AS tenant_id,
        ARRAY[o."id"]::uuid[] AS visited
    FROM "core_organizations" o
    WHERE o."parent_organization_id" IS NULL

    UNION ALL

    SELECT child."id", parent.tenant_id, parent.visited || child."id"
    FROM "core_organizations" child
    JOIN organization_tree parent
      ON child."parent_organization_id" = parent.organization_id
    WHERE NOT child."id" = ANY(parent.visited)
)
UPDATE "core_organizations" organization
SET "tenant_id" = tree.tenant_id
FROM organization_tree tree
WHERE organization."id" = tree.organization_id;

-- Stop rather than silently inventing ownership for a cycle or orphaned hierarchy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "core_organizations" WHERE "tenant_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign every existing organization to a tenant. Repair orphaned or cyclic organization hierarchy first.';
  END IF;
END $$;

-- Existing organization relationships inherit the source tenant, but cross-tenant links are rejected.
UPDATE "core_organization_relationships" relationship
SET "tenant_id" = source."tenant_id"
FROM "core_organizations" source
WHERE source."id" = relationship."source_organization_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "core_organization_relationships" relationship
    JOIN "core_organizations" target
      ON target."id" = relationship."target_organization_id"
    WHERE relationship."tenant_id" IS DISTINCT FROM target."tenant_id"
  ) THEN
    RAISE EXCEPTION 'Existing organization relationships cross tenant boundaries.';
  END IF;
END $$;

ALTER TABLE "core_organizations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "core_organization_relationships" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Replace global organization hierarchy and relationship keys with tenant-enforced keys.
ALTER TABLE "core_organizations" DROP CONSTRAINT "core_organizations_parent_organization_id_fkey";
ALTER TABLE "core_organization_relationships" DROP CONSTRAINT "core_organization_relationships_source_organization_id_fkey";
ALTER TABLE "core_organization_relationships" DROP CONSTRAINT "core_organization_relationships_target_organization_id_fkey";

DROP INDEX "core_organizations_parent_organization_id_idx";
DROP INDEX "core_organizations_organization_type_status_idx";
DROP INDEX "core_organizations_display_name_idx";
DROP INDEX "core_organization_relationships_source_organization_id_rela_idx";
DROP INDEX "core_organization_relationships_target_organization_id_rela_idx";

CREATE INDEX "core_tenants_status_idx" ON "core_tenants"("status");
CREATE INDEX "core_tenants_name_idx" ON "core_tenants"("name");
CREATE UNIQUE INDEX "core_organizations_tenant_id_id_key" ON "core_organizations"("tenant_id", "id");
CREATE INDEX "core_organizations_tenant_id_parent_organization_id_idx" ON "core_organizations"("tenant_id", "parent_organization_id");
CREATE INDEX "core_organizations_tenant_id_organization_type_status_idx" ON "core_organizations"("tenant_id", "organization_type", "status");
CREATE INDEX "core_organizations_tenant_id_display_name_idx" ON "core_organizations"("tenant_id", "display_name");
CREATE INDEX "core_organization_relationships_tenant_id_source_organizati_idx" ON "core_organization_relationships"("tenant_id", "source_organization_id", "relationship_type", "status");
CREATE INDEX "core_organization_relationships_tenant_id_target_organizati_idx" ON "core_organization_relationships"("tenant_id", "target_organization_id", "relationship_type", "status");

ALTER TABLE "core_organizations"
  ADD CONSTRAINT "core_organizations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_organizations"
  ADD CONSTRAINT "core_organizations_tenant_id_parent_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "parent_organization_id")
  REFERENCES "core_organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_organization_relationships"
  ADD CONSTRAINT "core_organization_relationships_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_organization_relationships"
  ADD CONSTRAINT "core_organization_relationships_tenant_id_source_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "source_organization_id")
  REFERENCES "core_organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_organization_relationships"
  ADD CONSTRAINT "core_organization_relationships_tenant_id_target_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "target_organization_id")
  REFERENCES "core_organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
