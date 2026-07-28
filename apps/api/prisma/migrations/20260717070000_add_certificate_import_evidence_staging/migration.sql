CREATE TABLE "core_people_intake_evidence" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "intake_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "document_type" VARCHAR(64) NOT NULL,
  "evidence_role" VARCHAR(32) NOT NULL DEFAULT 'primary',
  "attached_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_people_intake_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_people_intake_evidence_document_type_check" CHECK (btrim("document_type") <> ''),
  CONSTRAINT "core_people_intake_evidence_role_check" CHECK (btrim("evidence_role") <> '')
);

CREATE TABLE "core_certificate_imports" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "evidence_id" UUID NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "extraction_payload" JSONB,
  "extractor_code" VARCHAR(64),
  "extraction_version" VARCHAR(64),
  "confidence_bps" INTEGER,
  "extracted_by_user_id" UUID,
  "extracted_at" TIMESTAMPTZ(6),
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_decision" VARCHAR(16),
  "review_notes" VARCHAR(2000),
  "applied_by_user_id" UUID,
  "applied_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_certificate_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_certificate_imports_payload_check"
    CHECK ("extraction_payload" IS NULL OR jsonb_typeof("extraction_payload") = 'object'),
  CONSTRAINT "core_certificate_imports_confidence_check" CHECK ("confidence_bps" IS NULL OR "confidence_bps" BETWEEN 0 AND 10000),
  CONSTRAINT "core_certificate_imports_version_check" CHECK ("version" > 0),
  CONSTRAINT "core_certificate_imports_reviewer_check" CHECK ("reviewed_by_user_id" IS NULL OR "reviewed_by_user_id" <> "extracted_by_user_id"),
  CONSTRAINT "core_certificate_imports_state_check" CHECK (
    (
      "status" = 'pending'
      AND "extraction_payload" IS NULL
      AND "extractor_code" IS NULL
      AND "extraction_version" IS NULL
      AND "confidence_bps" IS NULL
      AND "extracted_by_user_id" IS NULL
      AND "extracted_at" IS NULL
      AND "reviewed_by_user_id" IS NULL
      AND "reviewed_at" IS NULL
      AND "review_decision" IS NULL
      AND "review_notes" IS NULL
      AND "applied_by_user_id" IS NULL
      AND "applied_at" IS NULL
    )
    OR
    (
      "status" = 'extracted'
      AND "extraction_payload" IS NOT NULL
      AND "extractor_code" IS NOT NULL AND btrim("extractor_code") <> ''
      AND "extraction_version" IS NOT NULL AND btrim("extraction_version") <> ''
      AND "confidence_bps" IS NOT NULL
      AND "extracted_by_user_id" IS NOT NULL
      AND "extracted_at" IS NOT NULL
      AND "reviewed_by_user_id" IS NULL
      AND "reviewed_at" IS NULL
      AND "review_decision" IS NULL
      AND "review_notes" IS NULL
      AND "applied_by_user_id" IS NULL
      AND "applied_at" IS NULL
    )
    OR
    (
      "status" IN ('accepted', 'rejected')
      AND "extraction_payload" IS NOT NULL
      AND "extractor_code" IS NOT NULL AND btrim("extractor_code") <> ''
      AND "extraction_version" IS NOT NULL AND btrim("extraction_version") <> ''
      AND "confidence_bps" IS NOT NULL
      AND "extracted_by_user_id" IS NOT NULL
      AND "extracted_at" IS NOT NULL
      AND "reviewed_by_user_id" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND "review_decision" = "status"
      AND ("status" <> 'rejected' OR ("review_notes" IS NOT NULL AND btrim("review_notes") <> ''))
      AND (
        ("applied_by_user_id" IS NULL AND "applied_at" IS NULL)
        OR
        ("status" = 'accepted' AND "applied_by_user_id" IS NOT NULL AND "applied_at" IS NOT NULL)
      )
    )
  )
);

CREATE UNIQUE INDEX "core_people_intake_evidence_scope_id_key"
  ON "core_people_intake_evidence"("tenant_id", "organization_id", "id");
CREATE UNIQUE INDEX "core_people_intake_evidence_intake_file_key"
  ON "core_people_intake_evidence"("tenant_id", "organization_id", "intake_id", "file_id");
CREATE INDEX "core_people_intake_evidence_intake_idx"
  ON "core_people_intake_evidence"("tenant_id", "organization_id", "intake_id", "created_at", "id");
CREATE INDEX "core_people_intake_evidence_file_idx" ON "core_people_intake_evidence"("file_id");

CREATE UNIQUE INDEX "core_certificate_imports_evidence_key"
  ON "core_certificate_imports"("tenant_id", "organization_id", "evidence_id");
CREATE INDEX "core_certificate_imports_queue_idx"
  ON "core_certificate_imports"("tenant_id", "organization_id", "status", "created_at", "id");
CREATE INDEX "core_certificate_imports_extracted_idx"
  ON "core_certificate_imports"("extracted_by_user_id", "extracted_at");
CREATE INDEX "core_certificate_imports_reviewed_idx"
  ON "core_certificate_imports"("reviewed_by_user_id", "reviewed_at");
CREATE INDEX "core_certificate_imports_applied_idx"
  ON "core_certificate_imports"("applied_by_user_id", "applied_at");

CREATE UNIQUE INDEX "core_people_intakes_scope_id_key"
  ON "core_people_intakes"("tenant_id", "organization_id", "id");
CREATE UNIQUE INDEX "core_files_scope_organization_id_key"
  ON "core_files"("tenant_id", "organization_id", "id");

ALTER TABLE "core_people_intake_evidence"
  ADD CONSTRAINT "core_people_intake_evidence_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_people_intake_evidence_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "core_organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_people_intake_evidence_intake_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id", "intake_id") REFERENCES "core_people_intakes"("tenant_id", "organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_people_intake_evidence_file_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id", "file_id") REFERENCES "core_files"("tenant_id", "organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_people_intake_evidence_attached_by_user_id_fkey"
  FOREIGN KEY ("attached_by_user_id") REFERENCES "core_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_certificate_imports"
  ADD CONSTRAINT "core_certificate_imports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_certificate_imports_organization_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "core_organizations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_certificate_imports_evidence_id_fkey"
  FOREIGN KEY ("tenant_id", "organization_id", "evidence_id") REFERENCES "core_people_intake_evidence"("tenant_id", "organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_certificate_imports_extracted_by_user_id_fkey"
  FOREIGN KEY ("extracted_by_user_id") REFERENCES "core_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_certificate_imports_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "core_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "core_certificate_imports_applied_by_user_id_fkey"
  FOREIGN KEY ("applied_by_user_id") REFERENCES "core_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "core_require_draft_people_intake_evidence"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "core_people_intakes" intake
    WHERE intake."tenant_id" = NEW."tenant_id"
      AND intake."organization_id" = NEW."organization_id"
      AND intake."id" = NEW."intake_id"
      AND intake."status" = 'draft'
  ) THEN
    RAISE EXCEPTION 'Evidence may only be attached to an editable draft intake' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "core_people_intake_evidence_draft_trigger"
BEFORE INSERT ON "core_people_intake_evidence"
FOR EACH ROW EXECUTE FUNCTION "core_require_draft_people_intake_evidence"();

CREATE FUNCTION "core_enforce_people_intake_evidence_mutation"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
    OR NEW."intake_id" IS DISTINCT FROM OLD."intake_id"
    OR NEW."file_id" IS DISTINCT FROM OLD."file_id"
    OR NEW."attached_by_user_id" IS DISTINCT FROM OLD."attached_by_user_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  ) THEN
    RAISE EXCEPTION 'People Intake evidence identity and ownership are immutable' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "core_people_intakes" intake
    WHERE intake."tenant_id" = OLD."tenant_id"
      AND intake."organization_id" = OLD."organization_id"
      AND intake."id" = OLD."intake_id"
      AND intake."status" = 'draft'
  ) THEN
    RAISE EXCEPTION 'Submitted People Intake evidence is immutable' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "core_people_intake_evidence_mutation_trigger"
BEFORE UPDATE OR DELETE ON "core_people_intake_evidence"
FOR EACH ROW EXECUTE FUNCTION "core_enforce_people_intake_evidence_mutation"();

CREATE FUNCTION "core_enforce_certificate_import_transition"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
    OR NEW."evidence_id" IS DISTINCT FROM OLD."evidence_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION 'Certificate import identity and ownership are immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Certificate import updates must increment version exactly once' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'pending' AND NEW."status" <> 'extracted' THEN
    RAISE EXCEPTION 'Pending certificate imports may only become extracted' USING ERRCODE = '23514';
  ELSIF OLD."status" = 'extracted' AND NEW."status" NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Extracted certificate imports may only be accepted or rejected' USING ERRCODE = '23514';
  ELSIF OLD."status" = 'rejected' THEN
    RAISE EXCEPTION 'Rejected certificate imports are immutable' USING ERRCODE = '23514';
  ELSIF OLD."status" = 'accepted' THEN
    IF OLD."applied_at" IS NOT NULL THEN
      RAISE EXCEPTION 'Applied certificate imports are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" <> 'accepted'
      OR NEW."applied_by_user_id" IS NULL
      OR NEW."applied_at" IS NULL
    THEN
      RAISE EXCEPTION 'Accepted certificate imports may only be applied once' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD."status" <> 'pending' AND (
    NEW."extraction_payload" IS DISTINCT FROM OLD."extraction_payload"
    OR NEW."extractor_code" IS DISTINCT FROM OLD."extractor_code"
    OR NEW."extraction_version" IS DISTINCT FROM OLD."extraction_version"
    OR NEW."confidence_bps" IS DISTINCT FROM OLD."confidence_bps"
    OR NEW."extracted_by_user_id" IS DISTINCT FROM OLD."extracted_by_user_id"
    OR NEW."extracted_at" IS DISTINCT FROM OLD."extracted_at"
  ) THEN
    RAISE EXCEPTION 'Certificate extraction evidence is immutable after extraction' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" IN ('accepted', 'rejected') AND (
    NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
    OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    OR NEW."review_decision" IS DISTINCT FROM OLD."review_decision"
    OR NEW."review_notes" IS DISTINCT FROM OLD."review_notes"
  ) THEN
    RAISE EXCEPTION 'Certificate import review evidence is immutable after decision' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "core_certificate_imports_transition_trigger"
BEFORE UPDATE ON "core_certificate_imports"
FOR EACH ROW EXECUTE FUNCTION "core_enforce_certificate_import_transition"();
