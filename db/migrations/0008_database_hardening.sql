-- 0008_database_hardening  (Phase 2)
--
-- Closes out Phase 2. Non-breaking: the n8n role is superuser + schema owner,
-- so every REVOKE/role change below is forward-looking scaffolding, and the
-- new triggers only fire on operations that were already invalid in intent.
--
--   1. Immutability guards on assets / asset_versions
--   2. search_path pinned on every storage.* function
--   3. Format CHECKs (file_extension, mime_type)
--   4. Time-ordering CHECK on asset_processing_jobs
--   5. Missing FK-supporting index
--   6. Least-privilege role scaffold (storage_reader / storage_writer)
--
-- Row-Level Security is intentionally deferred to Phase 10, where a dedicated
-- non-superuser application credential makes it enforceable. See
-- docs/DATABASE_HARDENING.md.

-- ---------------------------------------------------------------------------
-- 1. Immutability guards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.guard_asset_immutable_columns() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.asset_id       IS DISTINCT FROM OLD.asset_id
    OR NEW.tenant_id      IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_at     IS DISTINCT FROM OLD.created_at
    OR NEW.storage_provider IS DISTINCT FROM OLD.storage_provider THEN
        RAISE EXCEPTION
            'storage.assets: asset_id, tenant_id, created_at and storage_provider are immutable';
    END IF;

    IF (NEW.bucket IS DISTINCT FROM OLD.bucket
        OR NEW.object_key IS DISTINCT FROM OLD.object_key)
       AND OLD.storage_status NOT IN ('pending', 'uploading') THEN
        RAISE EXCEPTION
            'storage.assets: bucket/object_key can only change while status is pending or uploading (was %)',
            OLD.storage_status;
    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.guard_asset_immutable_columns() IS
  'Blocks changes to asset identity columns and to bucket/object_key once the object is in use.';

DROP TRIGGER IF EXISTS assets_guard_immutable ON storage.assets;
CREATE TRIGGER assets_guard_immutable
    BEFORE UPDATE ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.guard_asset_immutable_columns();

CREATE OR REPLACE FUNCTION storage.guard_asset_version_immutable() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    -- asset_versions rows are point-in-time snapshots. Only is_current and
    -- deleted_at may change after creation.
    IF NEW.asset_version_id IS DISTINCT FROM OLD.asset_version_id
    OR NEW.asset_id         IS DISTINCT FROM OLD.asset_id
    OR NEW.tenant_id        IS DISTINCT FROM OLD.tenant_id
    OR NEW.bucket           IS DISTINCT FROM OLD.bucket
    OR NEW.object_key       IS DISTINCT FROM OLD.object_key
    OR NEW.version_id       IS DISTINCT FROM OLD.version_id
    OR NEW.checksum_sha256  IS DISTINCT FROM OLD.checksum_sha256
    OR NEW.file_size_bytes  IS DISTINCT FROM OLD.file_size_bytes
    OR NEW.mime_type        IS DISTINCT FROM OLD.mime_type
    OR NEW.created_at       IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'storage.asset_versions rows are immutable except is_current and deleted_at';
    END IF;
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.guard_asset_version_immutable() IS
  'Allows only is_current / deleted_at to change on an existing asset version.';

DROP TRIGGER IF EXISTS asset_versions_guard_immutable ON storage.asset_versions;
CREATE TRIGGER asset_versions_guard_immutable
    BEFORE UPDATE ON storage.asset_versions
    FOR EACH ROW EXECUTE FUNCTION storage.guard_asset_version_immutable();

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on every storage.* function (search-path-injection safe)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'storage'
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, storage', r.sig);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Format CHECKs  (all target columns are nullable; existing rows unaffected)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'storage.assets'::regclass AND conname = 'assets_file_extension_shape') THEN
        ALTER TABLE storage.assets ADD CONSTRAINT assets_file_extension_shape
            CHECK (file_extension IS NULL OR file_extension ~ '^[a-z0-9]([a-z0-9.]{0,18}[a-z0-9])?$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'storage.assets'::regclass AND conname = 'assets_mime_type_shape') THEN
        ALTER TABLE storage.assets ADD CONSTRAINT assets_mime_type_shape
            CHECK (mime_type IS NULL OR mime_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'storage.asset_versions'::regclass AND conname = 'asset_versions_mime_type_shape') THEN
        ALTER TABLE storage.asset_versions ADD CONSTRAINT asset_versions_mime_type_shape
            CHECK (mime_type IS NULL OR mime_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$');
    END IF;

    -- 4. Processing-job timestamp ordering
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'storage.asset_processing_jobs'::regclass AND conname = 'asset_processing_jobs_time_order') THEN
        ALTER TABLE storage.asset_processing_jobs ADD CONSTRAINT asset_processing_jobs_time_order
            CHECK (
                (started_at  IS NULL OR started_at  >= created_at) AND
                (finished_at IS NULL OR finished_at >= COALESCE(started_at, created_at))
            );
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. FK-supporting index (asset_processing_jobs -> asset_versions composite FK)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS asset_processing_jobs_version_idx
    ON storage.asset_processing_jobs (asset_version_id)
    WHERE asset_version_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Least-privilege role scaffold
--    NOLOGIN group roles. Granted to n8n now so nothing changes today; a
--    dedicated login credential can be added in Phase 10 and made a member of
--    exactly one of these.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storage_reader') THEN
        CREATE ROLE storage_reader NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storage_writer') THEN
        CREATE ROLE storage_writer NOLOGIN;
    END IF;
END $$;

COMMENT ON ROLE storage_reader IS 'Read-only access to the storage schema (dashboards, observability).';
COMMENT ON ROLE storage_writer IS 'Application read/write to the storage schema. No DELETE (soft-delete only). No DDL.';

REVOKE ALL ON SCHEMA storage FROM PUBLIC;
GRANT  USAGE ON SCHEMA storage TO storage_reader, storage_writer;

REVOKE ALL ON ALL TABLES    IN SCHEMA storage FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA storage FROM PUBLIC;

GRANT SELECT                 ON ALL TABLES    IN SCHEMA storage TO storage_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES    IN SCHEMA storage TO storage_writer;
GRANT EXECUTE                ON ALL FUNCTIONS IN SCHEMA storage TO storage_writer;

-- future objects created by n8n in this schema inherit the same grants
ALTER DEFAULT PRIVILEGES FOR ROLE n8n IN SCHEMA storage
    GRANT SELECT ON TABLES TO storage_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE n8n IN SCHEMA storage
    GRANT SELECT, INSERT, UPDATE ON TABLES TO storage_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE n8n IN SCHEMA storage
    GRANT EXECUTE ON FUNCTIONS TO storage_writer;

-- session guardrails (apply when a login role SET ROLEs / is a member that inherits at login)
ALTER ROLE storage_reader SET statement_timeout = '60s';
ALTER ROLE storage_writer SET statement_timeout = '30s';
ALTER ROLE storage_writer SET idle_in_transaction_session_timeout = '60s';

-- keep the current app working unchanged
GRANT storage_reader, storage_writer TO n8n;
