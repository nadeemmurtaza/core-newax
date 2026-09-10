-- 0003_temp_lifecycle  (Phase 8)
--
-- newax-temp must never become permanent storage by accident.
-- Every object in newax-temp carries an expires_at; a scheduled workflow
-- (n8n/workflows/STORAGE_EXPIRE_TEMP) calls storage.find_expired_temp_assets()
-- to get the deletion batch, removes the RustFS objects, then calls
-- storage.mark_asset_deleted() for each.

ALTER TABLE storage.assets
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;
COMMENT ON COLUMN storage.assets.expires_at IS
  'Business-level expiry. Required for newax-temp objects; NULL for permanent buckets unless a retention policy applies.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'storage.assets'::regclass AND conname = 'assets_temp_requires_expiry'
    ) THEN
        ALTER TABLE storage.assets
            ADD CONSTRAINT assets_temp_requires_expiry
            CHECK (bucket <> 'newax-temp' OR expires_at IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'storage.assets'::regclass AND conname = 'assets_expiry_after_created'
    ) THEN
        ALTER TABLE storage.assets
            ADD CONSTRAINT assets_expiry_after_created
            CHECK (expires_at IS NULL OR expires_at > created_at);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS assets_temp_expiry_idx
    ON storage.assets (expires_at)
    WHERE bucket = 'newax-temp' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- storage.find_expired_temp_assets(limit) -> deletion batch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.find_expired_temp_assets(p_limit integer DEFAULT 500)
    RETURNS TABLE (asset_id uuid, tenant_id uuid, bucket text, object_key text, expires_at timestamptz)
    LANGUAGE sql STABLE AS $$
    SELECT a.asset_id, a.tenant_id, a.bucket, a.object_key, a.expires_at
    FROM storage.assets a
    WHERE a.bucket = 'newax-temp'
      AND a.storage_status <> 'deleted'
      AND a.deleted_at IS NULL
      AND a.expires_at IS NOT NULL
      AND a.expires_at <= now()
    ORDER BY a.expires_at
    LIMIT greatest(p_limit, 1);
$$;
COMMENT ON FUNCTION storage.find_expired_temp_assets(integer) IS
  'Returns the batch of expired newax-temp assets awaiting object deletion.';

-- ---------------------------------------------------------------------------
-- storage.mark_asset_deleted(...) - soft-delete an asset + emit event
-- Archives any live versions first so the delete guard trigger allows it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.mark_asset_deleted(
        p_asset_id   uuid,
        p_tenant_id  uuid,
        p_source     text DEFAULT 'lifecycle',
        p_actor_id   uuid DEFAULT NULL,
        p_reason     text DEFAULT NULL)
    RETURNS boolean
    LANGUAGE plpgsql AS $$
DECLARE
    v_status text;
BEGIN
    SELECT storage_status INTO v_status
    FROM storage.assets
    WHERE asset_id = p_asset_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'mark_asset_deleted: asset %/% not found', p_asset_id, p_tenant_id;
    END IF;

    IF v_status = 'deleted' THEN
        RETURN false;
    END IF;

    UPDATE storage.asset_versions
    SET is_current = false, deleted_at = now()
    WHERE asset_id = p_asset_id AND tenant_id = p_tenant_id AND deleted_at IS NULL;

    UPDATE storage.assets
    SET storage_status = 'deleted'
    WHERE asset_id = p_asset_id AND tenant_id = p_tenant_id;

    INSERT INTO storage.asset_events (asset_id, tenant_id, event_type, event_source, actor_id, payload)
    VALUES (p_asset_id, p_tenant_id, 'asset.deleted', p_source, p_actor_id,
            jsonb_build_object('reason', coalesce(p_reason, 'expired')));

    RETURN true;
END;
$$;
COMMENT ON FUNCTION storage.mark_asset_deleted(uuid, uuid, text, uuid, text) IS
  'Soft-deletes an asset (archiving live versions) and records an asset.deleted event.';
