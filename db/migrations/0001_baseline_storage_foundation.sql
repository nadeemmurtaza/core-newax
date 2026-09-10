-- 0001_baseline_storage_foundation
--
-- Stage A of the NEWAX permanent storage architecture:
--   storage.assets          - canonical asset registry (identity + metadata)
--   storage.asset_versions  - per-asset version history
--   storage.asset_events    - immutable lifecycle event log
--
-- This mirrors the schema that was first applied by hand. On an environment
-- where that schema already exists, db/migrate.sh adopts this migration
-- without executing it. The statements below are written to be safe to run
-- on a fresh database.

CREATE SCHEMA IF NOT EXISTS storage;
COMMENT ON SCHEMA storage IS
  'NEWAX asset storage registry and lifecycle metadata. RustFS stores the actual object bytes.';

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.set_updated_at() IS
  'Automatically updates updated_at whenever a storage registry record changes.';

CREATE OR REPLACE FUNCTION storage.prevent_asset_row_delete() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'storage.assets uses soft deletion: physical DELETE is not permitted';
END;
$$;
COMMENT ON FUNCTION storage.prevent_asset_row_delete() IS
  'Prevents physical deletion of asset registry rows; assets must use soft deletion.';

CREATE OR REPLACE FUNCTION storage.prevent_asset_event_mutation() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'storage.asset_events is immutable: UPDATE and DELETE are not permitted';
END;
$$;
COMMENT ON FUNCTION storage.prevent_asset_event_mutation() IS
  'Prevents modification or deletion of immutable storage lifecycle events.';

CREATE OR REPLACE FUNCTION storage.prevent_asset_delete_with_current_version() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.storage_status = 'deleted'
       OR NEW.deleted_at IS NOT NULL THEN

        IF EXISTS (
            SELECT 1
            FROM storage.asset_versions av
            WHERE av.asset_id = NEW.asset_id
              AND av.tenant_id = NEW.tenant_id
              AND av.is_current = TRUE
              AND av.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION
                'Asset cannot be deleted while it has a current active version';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.prevent_asset_delete_with_current_version() IS
  'Prevents soft-deleting an asset while a current active version exists.';

CREATE OR REPLACE FUNCTION storage.set_new_asset_version_current() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE storage.asset_versions
        SET is_current = FALSE
        WHERE asset_id = NEW.asset_id
          AND asset_version_id <> NEW.asset_version_id
          AND is_current = TRUE;
    END IF;
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.set_new_asset_version_current() IS
  'Automatically archives the previous current asset version when a new version becomes current.';

CREATE OR REPLACE FUNCTION storage.validate_asset_status_transition() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.storage_status = NEW.storage_status THEN
        IF NEW.storage_status <> 'deleted' AND NEW.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'deleted_at must be NULL when storage_status is %', NEW.storage_status;
        END IF;
        IF NEW.storage_status = 'deleted' AND NEW.deleted_at IS NULL THEN
            RAISE EXCEPTION 'deleted_at is required when storage_status is deleted';
        END IF;
        RETURN NEW;
    END IF;

    IF NOT (
        (OLD.storage_status = 'pending'     AND NEW.storage_status IN ('uploading', 'failed', 'deleted')) OR
        (OLD.storage_status = 'uploading'   AND NEW.storage_status IN ('active', 'failed', 'quarantined', 'deleted')) OR
        (OLD.storage_status = 'active'      AND NEW.storage_status IN ('processing', 'quarantined', 'deleted')) OR
        (OLD.storage_status = 'processing'  AND NEW.storage_status IN ('active', 'failed', 'quarantined', 'deleted')) OR
        (OLD.storage_status = 'failed'      AND NEW.storage_status IN ('uploading', 'deleted')) OR
        (OLD.storage_status = 'quarantined' AND NEW.storage_status IN ('processing', 'deleted')) OR
        (OLD.storage_status = 'deleted'     AND NEW.storage_status IN ('active'))
    ) THEN
        RAISE EXCEPTION 'Invalid storage status transition: % -> %', OLD.storage_status, NEW.storage_status;
    END IF;

    IF OLD.storage_status = 'deleted' AND NEW.storage_status = 'active' THEN
        NEW.deleted_at = NULL;
    END IF;

    IF NEW.storage_status = 'deleted' THEN
        IF NEW.deleted_at IS NULL THEN
            NEW.deleted_at = NOW();
        END IF;
    ELSE
        NEW.deleted_at = NULL;
    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.validate_asset_status_transition() IS
  'Enforces valid storage asset lifecycle state transitions.';

CREATE OR REPLACE FUNCTION storage.validate_asset_version_lifecycle() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_asset_status     TEXT;
    v_asset_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT storage_status, deleted_at
    INTO   v_asset_status, v_asset_deleted_at
    FROM   storage.assets
    WHERE  asset_id = NEW.asset_id AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent asset not found for asset version: %', NEW.asset_version_id;
    END IF;

    IF NEW.is_current = TRUE AND NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'A deleted asset version cannot be current';
    END IF;

    IF NEW.is_current = TRUE
       AND (v_asset_status = 'deleted' OR v_asset_deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'A version cannot be current while its parent asset is deleted';
    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.validate_asset_version_lifecycle() IS
  'Prevents invalid current/deleted asset-version lifecycle combinations.';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS storage.assets (
    asset_id          uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id         uuid NOT NULL,
    organization_id   uuid,
    bucket            text NOT NULL,
    object_key        text NOT NULL,
    original_filename text,
    display_name      text,
    mime_type         text,
    file_extension    text,
    file_size_bytes   bigint,
    checksum_sha256   character(64),
    storage_provider  text DEFAULT 'rustfs'::text NOT NULL,
    storage_status    text DEFAULT 'active'::text NOT NULL,
    source_type       text,
    source_id         uuid,
    metadata          jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at        timestamptz DEFAULT now() NOT NULL,
    updated_at        timestamptz DEFAULT now() NOT NULL,
    deleted_at        timestamptz,
    CONSTRAINT assets_pkey PRIMARY KEY (asset_id),
    CONSTRAINT assets_asset_tenant_uq UNIQUE (asset_id, tenant_id),
    CONSTRAINT assets_bucket_check CHECK (bucket = ANY (ARRAY['newax-images','newax-videos','newax-documents','newax-temp','newax-backups'])),
    CONSTRAINT assets_checksum_sha256_format CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT assets_created_updated_order_check CHECK (updated_at >= created_at),
    CONSTRAINT assets_deleted_timestamp_check CHECK (deleted_at IS NULL OR deleted_at >= created_at),
    CONSTRAINT assets_file_size_nonnegative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    CONSTRAINT assets_object_key_not_empty CHECK (length(btrim(object_key)) > 0),
    CONSTRAINT assets_status_deleted_at_consistency_check CHECK (
        (storage_status =  'deleted' AND deleted_at IS NOT NULL) OR
        (storage_status <> 'deleted' AND deleted_at IS NULL)),
    CONSTRAINT assets_storage_provider_check CHECK (storage_provider = 'rustfs'),
    CONSTRAINT assets_storage_status_check CHECK (storage_status = ANY (ARRAY['pending','uploading','active','processing','failed','quarantined','deleted']))
);
COMMENT ON TABLE  storage.assets IS 'NEWAX canonical asset registry. PostgreSQL stores asset identity and metadata; RustFS stores object bytes.';
COMMENT ON COLUMN storage.assets.asset_id IS 'Stable permanent identity of the asset. Domain workflows should reference this ID rather than raw object keys.';
COMMENT ON COLUMN storage.assets.bucket IS 'RustFS bucket containing the object.';
COMMENT ON COLUMN storage.assets.object_key IS 'Canonical RustFS object key. Not the permanent application-level identity.';
COMMENT ON COLUMN storage.assets.metadata IS 'Extensible asset metadata that does not justify a dedicated relational column.';
COMMENT ON COLUMN storage.assets.deleted_at IS 'Soft deletion timestamp. Object deletion from RustFS is handled by the storage lifecycle workflow.';

CREATE TABLE IF NOT EXISTS storage.asset_versions (
    asset_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id         uuid NOT NULL,
    bucket           text NOT NULL,
    object_key       text NOT NULL,
    version_id       text,
    checksum_sha256  character(64),
    file_size_bytes  bigint,
    mime_type        text,
    is_current       boolean DEFAULT false NOT NULL,
    created_at       timestamptz DEFAULT now() NOT NULL,
    deleted_at       timestamptz,
    tenant_id        uuid NOT NULL,
    CONSTRAINT asset_versions_pkey PRIMARY KEY (asset_version_id),
    CONSTRAINT asset_versions_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id)
        REFERENCES storage.assets (asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_versions_bucket_check CHECK (bucket = ANY (ARRAY['newax-images','newax-videos','newax-documents','newax-temp','newax-backups'])),
    CONSTRAINT asset_versions_checksum_sha256_format CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT asset_versions_current_not_deleted CHECK (NOT (is_current = true AND deleted_at IS NOT NULL)),
    CONSTRAINT asset_versions_deleted_timestamp_check CHECK (deleted_at IS NULL OR deleted_at >= created_at),
    CONSTRAINT asset_versions_file_size_nonnegative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    CONSTRAINT asset_versions_object_key_not_empty CHECK (length(btrim(object_key)) > 0),
    CONSTRAINT asset_versions_version_object_consistency CHECK (version_id IS NULL OR length(btrim(version_id)) > 0)
);
COMMENT ON TABLE  storage.asset_versions IS 'Version history for NEWAX assets. Each version identifies a specific RustFS object state.';
COMMENT ON COLUMN storage.asset_versions.asset_id IS 'Logical NEWAX asset to which this version belongs.';
COMMENT ON COLUMN storage.asset_versions.version_id IS 'Native object-store version identifier when RustFS/object versioning is used.';
COMMENT ON COLUMN storage.asset_versions.is_current IS 'Indicates the currently active version of the logical asset.';
COMMENT ON COLUMN storage.asset_versions.tenant_id IS 'Tenant owning this asset version; must match the parent asset tenant.';

CREATE TABLE IF NOT EXISTS storage.asset_events (
    asset_event_id   uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id         uuid NOT NULL,
    asset_version_id uuid,
    tenant_id        uuid NOT NULL,
    organization_id  uuid,
    event_type       text NOT NULL,
    event_source     text,
    actor_id         uuid,
    payload          jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at       timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT asset_events_pkey PRIMARY KEY (asset_event_id),
    CONSTRAINT asset_events_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id)
        REFERENCES storage.assets (asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_events_version_asset_tenant_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id)
        REFERENCES storage.asset_versions (asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_events_event_source_nonempty_check CHECK (event_source IS NULL OR length(btrim(event_source)) > 0),
    CONSTRAINT asset_events_event_type_nonempty_check CHECK (length(btrim(event_type)) > 0),
    CONSTRAINT asset_events_event_type_check CHECK (event_type = ANY (ARRAY[
        'asset.created','asset.upload.started','asset.upload.completed','asset.upload.failed',
        'asset.downloaded','asset.processed','asset.version.created','asset.deleted',
        'asset.restored','asset.quarantined']))
);
COMMENT ON TABLE  storage.asset_events IS 'Immutable lifecycle event history for NEWAX assets and asset versions.';
COMMENT ON COLUMN storage.asset_events.event_type IS 'Storage lifecycle event such as asset.created, asset.upload.started, asset.upload.completed, asset.processed, asset.deleted, asset.restored, or asset.quarantined.';
COMMENT ON COLUMN storage.asset_events.event_source IS 'System or workflow that generated the event, such as n8n, api, ingestion, processor, or admin.';
COMMENT ON COLUMN storage.asset_events.actor_id IS 'Optional user or service identity responsible for the event.';
COMMENT ON COLUMN storage.asset_events.payload IS 'Event-specific structured metadata.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS assets_bucket_object_key_uq ON storage.assets (bucket, object_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS assets_checksum_idx     ON storage.assets (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS assets_created_at_idx   ON storage.assets (created_at DESC);
CREATE INDEX IF NOT EXISTS assets_metadata_gin_idx ON storage.assets USING gin (metadata);
CREATE INDEX IF NOT EXISTS assets_organization_idx ON storage.assets (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS assets_source_idx       ON storage.assets (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS assets_status_idx       ON storage.assets (storage_status);
CREATE INDEX IF NOT EXISTS assets_tenant_idx       ON storage.assets (tenant_id);

CREATE INDEX IF NOT EXISTS asset_versions_asset_idx      ON storage.asset_versions (asset_id);
CREATE INDEX IF NOT EXISTS asset_versions_checksum_idx   ON storage.asset_versions (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS asset_versions_created_at_idx ON storage.asset_versions (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS asset_versions_current_uq      ON storage.asset_versions (asset_id) WHERE is_current = true AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_versions_identity_uq     ON storage.asset_versions (asset_version_id, asset_id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS asset_versions_null_version_uq ON storage.asset_versions (asset_id, bucket, object_key) WHERE version_id IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS asset_versions_tenant_idx      ON storage.asset_versions (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS asset_versions_version_uq      ON storage.asset_versions (asset_id, version_id) WHERE version_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS asset_events_asset_idx      ON storage.asset_events (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_events_created_at_idx ON storage.asset_events (created_at DESC);
CREATE INDEX IF NOT EXISTS asset_events_payload_gin_idx ON storage.asset_events USING gin (payload);
CREATE INDEX IF NOT EXISTS asset_events_tenant_idx     ON storage.asset_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_events_type_idx       ON storage.asset_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_events_version_idx    ON storage.asset_events (asset_version_id, created_at DESC) WHERE asset_version_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS assets_set_updated_at ON storage.assets;
CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.set_updated_at();

DROP TRIGGER IF EXISTS assets_validate_status_transition ON storage.assets;
CREATE TRIGGER assets_validate_status_transition BEFORE UPDATE OF storage_status ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_status_transition();

DROP TRIGGER IF EXISTS assets_prevent_delete_with_current_version ON storage.assets;
CREATE TRIGGER assets_prevent_delete_with_current_version BEFORE UPDATE OF storage_status, deleted_at ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_delete_with_current_version();

DROP TRIGGER IF EXISTS assets_prevent_row_delete ON storage.assets;
CREATE TRIGGER assets_prevent_row_delete BEFORE DELETE ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_row_delete();

DROP TRIGGER IF EXISTS asset_versions_set_current ON storage.asset_versions;
CREATE TRIGGER asset_versions_set_current BEFORE INSERT ON storage.asset_versions
    FOR EACH ROW EXECUTE FUNCTION storage.set_new_asset_version_current();

DROP TRIGGER IF EXISTS asset_versions_validate_lifecycle ON storage.asset_versions;
CREATE TRIGGER asset_versions_validate_lifecycle BEFORE INSERT OR UPDATE OF is_current, deleted_at ON storage.asset_versions
    FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_version_lifecycle();

DROP TRIGGER IF EXISTS asset_events_immutable ON storage.asset_events;
CREATE TRIGGER asset_events_immutable BEFORE DELETE OR UPDATE ON storage.asset_events
    FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_event_mutation();
