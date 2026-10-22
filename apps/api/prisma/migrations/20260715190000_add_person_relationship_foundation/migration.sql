-- Person relationships preserve one record per human while allowing tenant-scoped,
-- verified family, guardianship, dependency, and other person-to-person links.
CREATE TABLE "core_person_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_person_id" UUID NOT NULL,
    "target_person_id" UUID NOT NULL,
    "relationship_type" VARCHAR(64) NOT NULL,
    "relationship_role" VARCHAR(64) NOT NULL DEFAULT 'unspecified',
    "relationship_basis" VARCHAR(64) NOT NULL DEFAULT 'unspecified',
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "valid_from" DATE,
    "valid_until" DATE,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_user_id" UUID,
    "verification_source" VARCHAR(128),
    "source_reference" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_person_relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "core_person_relationships_distinct_people_check"
      CHECK ("source_person_id" <> "target_person_id"),
    CONSTRAINT "core_person_relationships_validity_check"
      CHECK ("valid_until" IS NULL OR "valid_from" IS NULL OR "valid_until" >= "valid_from"),
    CONSTRAINT "core_person_relationships_verification_check"
      CHECK (
        ("is_verified" = false AND "verified_at" IS NULL AND "verified_by_user_id" IS NULL)
        OR
        (
          "is_verified" = true
          AND "verified_at" IS NOT NULL
          AND "verification_source" IS NOT NULL
          AND btrim("verification_source") <> ''
        )
      ),
    CONSTRAINT "core_person_relationships_type_not_blank_check"
      CHECK (btrim("relationship_type") <> ''),
    CONSTRAINT "core_person_relationships_role_not_blank_check"
      CHECK (btrim("relationship_role") <> ''),
    CONSTRAINT "core_person_relationships_basis_not_blank_check"
      CHECK (btrim("relationship_basis") <> '')
);

CREATE INDEX "core_person_relationships_source_idx"
ON "core_person_relationships"("tenant_id", "source_person_id", "relationship_type", "status");

CREATE INDEX "core_person_relationships_target_idx"
ON "core_person_relationships"("tenant_id", "target_person_id", "relationship_type", "status");

CREATE INDEX "core_person_relationships_verified_by_user_id_idx"
ON "core_person_relationships"("verified_by_user_id");

-- One active statement of the same relationship meaning is allowed per Tenant.
-- A scheduled valid_until does not make an otherwise active relationship a different fact.
CREATE UNIQUE INDEX "core_person_relationships_active_identity_key"
ON "core_person_relationships"(
  "tenant_id",
  "source_person_id",
  "target_person_id",
  "relationship_type",
  "relationship_role",
  "relationship_basis"
)
WHERE "status" = 'active';

ALTER TABLE "core_person_relationships"
ADD CONSTRAINT "core_person_relationships_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_person_relationships"
ADD CONSTRAINT "core_person_relationships_source_person_id_fkey"
FOREIGN KEY ("source_person_id") REFERENCES "core_people"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_person_relationships"
ADD CONSTRAINT "core_person_relationships_target_person_id_fkey"
FOREIGN KEY ("target_person_id") REFERENCES "core_people"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_person_relationships"
ADD CONSTRAINT "core_person_relationships_verified_by_user_id_fkey"
FOREIGN KEY ("verified_by_user_id") REFERENCES "core_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "core_reject_person_parent_cycle"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."relationship_type" <> 'parent_of' OR NEW."status" <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Serialize parentage changes per Tenant so concurrent writes cannot independently
  -- validate incompatible branches of the same family tree.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenant_id"::text, 0));

  IF EXISTS (
    WITH RECURSIVE descendants("person_id") AS (
      SELECT relationship."target_person_id"
      FROM "core_person_relationships" AS relationship
      WHERE relationship."tenant_id" = NEW."tenant_id"
        AND relationship."id" <> NEW."id"
        AND relationship."source_person_id" = NEW."target_person_id"
        AND relationship."relationship_type" = 'parent_of'
        AND relationship."status" = 'active'
        AND (relationship."valid_until" IS NULL OR relationship."valid_until" >= CURRENT_DATE)

      UNION

      SELECT relationship."target_person_id"
      FROM "core_person_relationships" AS relationship
      INNER JOIN descendants
        ON relationship."source_person_id" = descendants."person_id"
      WHERE relationship."tenant_id" = NEW."tenant_id"
        AND relationship."id" <> NEW."id"
        AND relationship."relationship_type" = 'parent_of'
        AND relationship."status" = 'active'
        AND (relationship."valid_until" IS NULL OR relationship."valid_until" >= CURRENT_DATE)
    )
    SELECT 1
    FROM descendants
    WHERE descendants."person_id" = NEW."source_person_id"
  ) THEN
    RAISE EXCEPTION 'Active parent relationship would create a family-tree cycle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "core_person_relationships_parent_cycle_trigger"
BEFORE INSERT OR UPDATE OF
  "tenant_id",
  "source_person_id",
  "target_person_id",
  "relationship_type",
  "status",
  "valid_until"
ON "core_person_relationships"
FOR EACH ROW
EXECUTE FUNCTION "core_reject_person_parent_cycle"();
