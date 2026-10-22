-- CreateTable
CREATE TABLE "core_user_external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_subject" VARCHAR(256) NOT NULL,
    "provider_username" VARCHAR(256),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_user_external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_user_external_identities_provider_provider_subject_key" ON "core_user_external_identities"("provider", "provider_subject");

-- CreateIndex
CREATE INDEX "core_user_external_identities_user_id_provider_idx" ON "core_user_external_identities"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "core_user_external_identities" ADD CONSTRAINT "core_user_external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
