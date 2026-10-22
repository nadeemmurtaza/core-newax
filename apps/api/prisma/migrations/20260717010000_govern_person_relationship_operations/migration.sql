ALTER TABLE "core_person_relationships"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "verification_revoked_at" TIMESTAMPTZ(6),
  ADD COLUMN "verification_revoked_by_user_id" UUID,
  ADD COLUMN "verification_revocation_reason" VARCHAR(1000);

ALTER TABLE "core_person_relationships"
  DROP CONSTRAINT "core_person_relationships_verification_check";

ALTER TABLE "core_person_relationships"
  ADD CONSTRAINT "core_person_relationships_version_check"
    CHECK ("version" > 0),
  ADD CONSTRAINT "core_person_relationships_verification_check"
    CHECK (
      (
        "is_verified" = true
        AND "verified_at" IS NOT NULL
        AND "verification_source" IS NOT NULL
        AND btrim("verification_source") <> ''
        AND "verification_revoked_at" IS NULL
        AND "verification_revoked_by_user_id" IS NULL
        AND "verification_revocation_reason" IS NULL
      )
      OR
      (
        "is_verified" = false
        AND "verified_at" IS NULL
        AND "verified_by_user_id" IS NULL
        AND "verification_source" IS NULL
        AND (
          (
            "verification_revoked_at" IS NULL
            AND "verification_revoked_by_user_id" IS NULL
            AND "verification_revocation_reason" IS NULL
          )
          OR
          (
            "verification_revoked_at" IS NOT NULL
            AND "verification_revoked_by_user_id" IS NOT NULL
            AND "verification_revocation_reason" IS NOT NULL
            AND btrim("verification_revocation_reason") <> ''
          )
        )
      )
    );

ALTER TABLE "core_person_relationships"
  ADD CONSTRAINT "core_person_relationships_verification_revoked_by_user_id_fkey"
  FOREIGN KEY ("verification_revoked_by_user_id") REFERENCES "core_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "core_person_relationships_verification_revoked_by_user_id_idx"
  ON "core_person_relationships"("verification_revoked_by_user_id");
