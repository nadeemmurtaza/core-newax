-- CreateTable
CREATE TABLE "core_service_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "core_service_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "core_service_accounts_tenant_id_status_idx" ON "core_service_accounts"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "core_service_accounts" ADD CONSTRAINT "core_service_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: a CoreUser represents a human (person_id) OR a machine/integration
-- identity (service_account_id) -- never both, never neither. See ADR 0035.
ALTER TABLE "core_users" ALTER COLUMN "person_id" DROP NOT NULL;
ALTER TABLE "core_users" ADD COLUMN "service_account_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "core_users_service_account_id_key" ON "core_users"("service_account_id");

-- AddForeignKey
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_service_account_id_fkey" FOREIGN KEY ("service_account_id") REFERENCES "core_service_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_person_xor_service_account_chk"
    CHECK ((("person_id" IS NOT NULL)::int + ("service_account_id" IS NOT NULL)::int) = 1);

-- AlterTable: a CoreMembership belongs to a human (person_id) OR a
-- machine/integration identity (service_account_id) -- never both, never
-- neither. See ADR 0035.
ALTER TABLE "core_memberships" ALTER COLUMN "person_id" DROP NOT NULL;
ALTER TABLE "core_memberships" ADD COLUMN "service_account_id" UUID;

-- CreateIndex
CREATE INDEX "core_memberships_service_account_id_status_idx" ON "core_memberships"("service_account_id", "status");

-- AddForeignKey
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_service_account_id_fkey" FOREIGN KEY ("service_account_id") REFERENCES "core_service_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_person_xor_service_account_chk"
    CHECK ((("person_id" IS NOT NULL)::int + ("service_account_id" IS NOT NULL)::int) = 1);
