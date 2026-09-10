-- 0002_object_key_standard  (Phase 4 + Phase 5)
--
-- Enforces a predictable object-key layout so that, once hundreds of
-- workflows are creating objects, the buckets stay navigable and every
-- object is addressable by its asset_id.
--
-- Canonical layout:
--   {domain}/{tenant_id}/{entity_type}/{entity_id}/{asset_id}/{variant}
--   e.g.  documents/8f21.../organization/org_0042/7d9c.../original.pdf
--
-- Enforced rules (storage.assert_object_key_shape):
--   * lowercase; only [a-z0-9._/-]
--   * no leading/trailing '/', no '//', no '.'/'..' path segments
--   * >= 3 path segments, <= 1024 chars
-- Additional rule for storage.assets:
--   * the asset_id must appear as its own path segment, UNLESS
--       - bucket = 'newax-temp' (temp objects are job-scoped), or
--       - metadata->>'key_layout' = 'legacy' (explicit opt-out for imports)
--
-- Existing rows are never re-validated: the triggers fire only on INSERT
-- or on UPDATE OF object_key.

-- ---------------------------------------------------------------------------
-- Structural validation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.assert_object_key_shape(p_key text) RETURNS void
    LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    seg text;
BEGIN
    IF p_key IS NULL OR length(btrim(p_key)) = 0 THEN
        RAISE EXCEPTION 'object_key must not be empty';
    END IF;
    IF length(p_key) > 1024 THEN
        RAISE EXCEPTION 'object_key exceeds 1024 characters';
    END IF;
    IF p_key <> btrim(p_key) THEN
        RAISE EXCEPTION 'object_key must not have leading or trailing whitespace: %', p_key;
    END IF;
    IF p_key ~ '^/' OR p_key ~ '/$' THEN
        RAISE EXCEPTION 'object_key must not start or end with "/": %', p_key;
    END IF;
    IF p_key ~ '//' THEN
        RAISE EXCEPTION 'object_key must not contain an empty path segment ("//"): %', p_key;
    END IF;
    IF p_key !~ '^[a-z0-9._/-]+$' THEN
        RAISE EXCEPTION 'object_key must be lowercase and contain only [a-z0-9._/-]: %', p_key;
    END IF;
    IF array_length(string_to_array(p_key, '/'), 1) < 3 THEN
        RAISE EXCEPTION 'object_key must have at least 3 path segments ({domain}/.../{variant}): %', p_key;
    END IF;
    FOREACH seg IN ARRAY string_to_array(p_key, '/') LOOP
        IF seg IN ('.', '..') THEN
            RAISE EXCEPTION 'object_key must not contain relative path segments: %', p_key;
        END IF;
    END LOOP;
END;
$$;
COMMENT ON FUNCTION storage.assert_object_key_shape(text) IS
  'Raises if an object key violates the NEWAX structural key rules (Phase 4).';

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.validate_asset_object_key() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    PERFORM storage.assert_object_key_shape(NEW.object_key);

    IF NEW.bucket <> 'newax-temp'
       AND COALESCE(NEW.metadata ->> 'key_layout', 'standard') <> 'legacy'
       AND NOT (NEW.asset_id::text = ANY (string_to_array(NEW.object_key, '/')))
    THEN
        RAISE EXCEPTION
            'object_key must contain the asset_id (%) as a path segment; got %. '
            'Use storage.build_object_key(...) or set metadata.key_layout = "legacy" to opt out.',
            NEW.asset_id, NEW.object_key;
    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.validate_asset_object_key() IS
  'Enforces structural + asset-addressable object-key rules on storage.assets.';

CREATE OR REPLACE FUNCTION storage.validate_asset_version_object_key() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    PERFORM storage.assert_object_key_shape(NEW.object_key);
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION storage.validate_asset_version_object_key() IS
  'Enforces structural object-key rules on storage.asset_versions.';

DROP TRIGGER IF EXISTS assets_validate_object_key ON storage.assets;
CREATE TRIGGER assets_validate_object_key
    BEFORE INSERT OR UPDATE OF object_key ON storage.assets
    FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_object_key();

DROP TRIGGER IF EXISTS asset_versions_validate_object_key ON storage.asset_versions;
CREATE TRIGGER asset_versions_validate_object_key
    BEFORE INSERT OR UPDATE OF object_key ON storage.asset_versions
    FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_version_object_key();

-- ---------------------------------------------------------------------------
-- Key construction helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.slugify(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE AS $$
    SELECT btrim(
             regexp_replace(
               regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9._-]+', '-', 'g'),
               '(^-+|-+$)', '', 'g'),
             '-');
$$;
COMMENT ON FUNCTION storage.slugify(text) IS 'Lowercases and reduces a string to [a-z0-9._-] for use in object keys.';

CREATE OR REPLACE FUNCTION storage.bucket_for_domain(p_domain text) RETURNS text
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE lower(p_domain)
        WHEN 'images'    THEN 'newax-images'
        WHEN 'image'     THEN 'newax-images'
        WHEN 'videos'    THEN 'newax-videos'
        WHEN 'video'     THEN 'newax-videos'
        WHEN 'documents' THEN 'newax-documents'
        WHEN 'document'  THEN 'newax-documents'
        WHEN 'temp'      THEN 'newax-temp'
        WHEN 'backups'   THEN 'newax-backups'
        WHEN 'backup'    THEN 'newax-backups'
    END;
$$;
COMMENT ON FUNCTION storage.bucket_for_domain(text) IS 'Maps a logical domain name to its permanent RustFS bucket.';

CREATE OR REPLACE FUNCTION storage.build_object_key(
        p_domain      text,
        p_tenant_id   uuid,
        p_entity_type text,
        p_entity_id   text,
        p_asset_id    uuid,
        p_variant     text)
    RETURNS text
    LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_key text;
BEGIN
    v_key := concat_ws('/',
        storage.slugify(p_domain),
        p_tenant_id::text,
        storage.slugify(p_entity_type),
        storage.slugify(p_entity_id),
        p_asset_id::text,
        storage.slugify(p_variant));
    PERFORM storage.assert_object_key_shape(v_key);
    RETURN v_key;
END;
$$;
COMMENT ON FUNCTION storage.build_object_key(text, uuid, text, text, uuid, text) IS
  'Builds a canonical NEWAX object key: {domain}/{tenant_id}/{entity_type}/{entity_id}/{asset_id}/{variant}.';
