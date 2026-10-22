-- Removed links are history. They must not prevent a later active link for the
-- same Organization, canonical address, and address type.

-- Fail rather than selecting or deleting an active duplicate if database drift
-- bypassed the existing full-history uniqueness index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "core_organization_addresses"
    WHERE "status" = 'active'
    GROUP BY "organization_id", "address_id", "address_type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active organization address links exist for the same organization, address, and type.';
  END IF;
END $$;

-- Install the active-link backstop before removing the broader historical
-- uniqueness index, so migration failure cannot leave duplicate active links
-- unprotected.
CREATE UNIQUE INDEX "core_organization_addresses_one_active_link_per_type_key"
  ON "core_organization_addresses" ("organization_id", "address_id", "address_type")
  WHERE "status" = 'active';

-- Prisma does not currently model partial unique indexes. The migration-owned
-- index above preserves removed rows while preventing duplicate active links.
DROP INDEX "core_organization_addresses_organization_id_address_id_addr_key";
