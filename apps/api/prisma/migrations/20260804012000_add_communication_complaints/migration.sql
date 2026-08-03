-- CreateTable
CREATE TABLE "core_communication_complaints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contact_method_id" UUID,
    "source_product" VARCHAR(64) NOT NULL,
    "source_complaint_id" VARCHAR(255) NOT NULL,
    "complaint_type" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(64),
    "provider_message_id" VARCHAR(255),
    "normalized_recipient" VARCHAR(320) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "suppression_required" BOOLEAN NOT NULL DEFAULT true,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT "core_communication_complaints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "core_communication_complaints_source_product_nonblank" CHECK (btrim("source_product") <> ''),
    CONSTRAINT "core_communication_complaints_source_id_nonblank" CHECK (btrim("source_complaint_id") <> ''),
    CONSTRAINT "core_communication_complaints_recipient_normalized" CHECK (
        "normalized_recipient" = lower(btrim("normalized_recipient"))
        AND position('@' IN "normalized_recipient") > 1
    ),
    CONSTRAINT "core_communication_complaints_type_check" CHECK (
        "complaint_type" IN (
            'recipient_spam',
            'feedback_loop',
            'dmarc_forensic',
            'authentication_failure',
            'other'
        )
    ),
    CONSTRAINT "core_communication_complaints_status_check" CHECK (
        "status" IN ('active', 'acknowledged', 'resolved', 'false_positive')
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "core_communication_complaints_source_key"
ON "core_communication_complaints"("tenant_id", "source_product", "source_complaint_id");

-- CreateIndex
CREATE INDEX "core_communication_complaints_contact_method_idx"
ON "core_communication_complaints"("tenant_id", "contact_method_id", "occurred_at");

-- CreateIndex
CREATE INDEX "core_communication_complaints_recipient_idx"
ON "core_communication_complaints"("tenant_id", "normalized_recipient", "occurred_at");

-- CreateIndex
CREATE INDEX "core_communication_complaints_status_idx"
ON "core_communication_complaints"("tenant_id", "status", "received_at");

-- AddForeignKey
ALTER TABLE "core_communication_complaints"
ADD CONSTRAINT "core_communication_complaints_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_communication_complaints"
ADD CONSTRAINT "core_communication_complaints_contact_method_id_fkey"
FOREIGN KEY ("contact_method_id") REFERENCES "core_contact_methods"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
