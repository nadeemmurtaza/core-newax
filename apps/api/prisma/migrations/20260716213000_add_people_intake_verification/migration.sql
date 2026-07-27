CREATE TABLE "core_people_intakes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "title" VARCHAR(128) NOT NULL,
  "source_type" VARCHAR(64) NOT NULL,
  "source_reference" VARCHAR(255),
  "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
  "payload" JSONB NOT NULL,
  "person_count" INTEGER NOT NULL,
  "relationship_count" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "reviewed_by_user_id" UUID,
  "review_decision" VARCHAR(16),
  "review_notes" VARCHAR(2000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "core_people_intakes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_people_intakes_title_check" CHECK (btrim("title") <> ''),
  CONSTRAINT "core_people_intakes_source_type_check" CHECK (btrim("source_type") <> ''),
  CONSTRAINT "core_people_intakes_source_reference_check"
    CHECK ("source_reference" IS NULL OR btrim("source_reference") <> ''),
  CONSTRAINT "core_people_intakes_status_check"
    CHECK ("status" IN ('draft', 'submitted', 'approved', 'rejected')),
  CONSTRAINT "core_people_intakes_payload_check" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "core_people_intakes_people_count_check" CHECK ("person_count" BETWEEN 1 AND 50),
  CONSTRAINT "core_people_intakes_relationship_count_check"
    CHECK ("relationship_count" BETWEEN 0 AND 100),
  CONSTRAINT "core_people_intakes_version_check" CHECK ("version" >= 1),
  CONSTRAINT "core_people_intakes_reviewer_check"
    CHECK ("reviewed_by_user_id" IS NULL OR "reviewed_by_user_id" <> "created_by_user_id"),
  CONSTRAINT "core_people_intakes_review_notes_check"
    CHECK ("review_notes" IS NULL OR btrim("review_notes") <> ''),
  CONSTRAINT "core_people_intakes_state_check" CHECK (
    ("status" = 'draft'
      AND "submitted_at" IS NULL
      AND "reviewed_at" IS NULL
      AND "reviewed_by_user_id" IS NULL
      AND "review_decision" IS NULL
      AND "review_notes" IS NULL)
    OR
    ("status" = 'submitted'
      AND "submitted_at" IS NOT NULL
      AND "reviewed_at" IS NULL
      AND "reviewed_by_user_id" IS NULL
      AND "review_decision" IS NULL
      AND "review_notes" IS NULL)
    OR
    ("status" = 'approved'
      AND "submitted_at" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND "reviewed_by_user_id" IS NOT NULL
      AND "review_decision" = 'approved')
    OR
    ("status" = 'rejected'
      AND "submitted_at" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND "reviewed_by_user_id" IS NOT NULL
      AND "review_decision" = 'rejected'
      AND "review_notes" IS NOT NULL
      AND btrim("review_notes") <> '')
  )
);

CREATE INDEX "core_people_intakes_scope_queue_idx"
  ON "core_people_intakes"("tenant_id", "organization_id", "status", "submitted_at", "id");
CREATE INDEX "core_people_intakes_creator_idx"
  ON "core_people_intakes"("created_by_user_id", "status");
CREATE INDEX "core_people_intakes_reviewer_idx"
  ON "core_people_intakes"("reviewed_by_user_id", "reviewed_at");

ALTER TABLE "core_people_intakes"
  ADD CONSTRAINT "core_people_intakes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "core_people_intakes"
  ADD CONSTRAINT "core_people_intakes_organization_scope_fkey"
  FOREIGN KEY ("tenant_id", "organization_id")
  REFERENCES "core_organizations"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "core_people_intakes"
  ADD CONSTRAINT "core_people_intakes_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "core_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "core_people_intakes"
  ADD CONSTRAINT "core_people_intakes_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "core_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "core_enforce_people_intake_transition"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
    OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
  THEN
    RAISE EXCEPTION 'People Intake ownership is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Reviewed People Intake records are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'submitted' AND NEW."status" NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Submitted People Intake records may only be approved or rejected'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'draft' AND NEW."status" NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Draft People Intake records must be submitted before review'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" <> 'draft' AND (
    NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."source_type" IS DISTINCT FROM OLD."source_type"
    OR NEW."source_reference" IS DISTINCT FROM OLD."source_reference"
    OR NEW."payload" IS DISTINCT FROM OLD."payload"
    OR NEW."person_count" IS DISTINCT FROM OLD."person_count"
    OR NEW."relationship_count" IS DISTINCT FROM OLD."relationship_count"
  ) THEN
    RAISE EXCEPTION 'Submitted People Intake content is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'People Intake updates must increment version exactly once'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "core_people_intakes_transition_trigger"
BEFORE UPDATE ON "core_people_intakes"
FOR EACH ROW EXECUTE FUNCTION "core_enforce_people_intake_transition"();
