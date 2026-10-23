-- CreateTable
CREATE TABLE "core_brands" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "core_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_service_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(96) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "parent_category_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_services" (
    "id" UUID NOT NULL,
    "code" VARCHAR(96) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "outcome_description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "parent_application" VARCHAR(96) NOT NULL,
    "destination_key" VARCHAR(96) NOT NULL,
    "icon_key" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "lifecycle_status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_brand_service_configurations" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "activation_state" VARCHAR(32) NOT NULL DEFAULT 'not_configured',
    "setup_state" VARCHAR(32) NOT NULL DEFAULT 'not_required',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_brand_service_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "core_brands_organization_id_status_idx" ON "core_brands"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "core_brands_organization_id_slug_key" ON "core_brands"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "core_service_categories_code_key" ON "core_service_categories"("code");

-- CreateIndex
CREATE INDEX "core_service_categories_status_sort_order_idx" ON "core_service_categories"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "core_services_code_key" ON "core_services"("code");

-- CreateIndex
CREATE INDEX "core_services_category_id_lifecycle_status_sort_order_idx" ON "core_services"("category_id", "lifecycle_status", "sort_order");

-- CreateIndex
CREATE INDEX "core_brand_service_configurations_brand_id_activation_state_idx" ON "core_brand_service_configurations"("brand_id", "activation_state");

-- CreateIndex
CREATE UNIQUE INDEX "core_brand_service_configurations_brand_id_service_id_key" ON "core_brand_service_configurations"("brand_id", "service_id");

-- AddForeignKey
ALTER TABLE "core_brands" ADD CONSTRAINT "core_brands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_service_categories" ADD CONSTRAINT "core_service_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "core_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_services" ADD CONSTRAINT "core_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core_service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_brand_service_configurations" ADD CONSTRAINT "core_brand_service_configurations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "core_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_brand_service_configurations" ADD CONSTRAINT "core_brand_service_configurations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

