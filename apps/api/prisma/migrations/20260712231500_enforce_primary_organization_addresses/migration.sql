-- Fail rather than silently choosing an active primary address when legacy data is ambiguous.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "core_organization_addresses"
    WHERE "is_primary" = TRUE
      AND "status" = 'active'
    GROUP BY "organization_id", "address_type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active primary organization addresses exist for the same organization and address type.';
  END IF;
END $$;

-- Prisma does not currently model partial unique indexes. This database constraint
-- is therefore migration-owned and prevents concurrent writes from creating more
-- than one active primary address for an organization and address type.
CREATE UNIQUE INDEX "core_organization_addresses_one_primary_per_type_key"
  ON "core_organization_addresses" ("organization_id", "address_type")
  WHERE "is_primary" = TRUE
    AND "status" = 'active';
