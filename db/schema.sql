--
-- PostgreSQL database dump
--

\restrict 6fsJ4fB2w5c43Jadgk3hWKbwaIhLbizfi9ujBOgx0WeIdcPmMHQ2ArZh67l0xm1

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg12+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: SCHEMA storage; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA storage IS 'NEWAX asset storage registry and lifecycle metadata. RustFS stores the actual object bytes.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_processing_jobs; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.asset_processing_jobs (
    processing_job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    asset_version_id uuid,
    tenant_id uuid NOT NULL,
    pipeline text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    stage_detail text,
    progress numeric(5,2) DEFAULT 0 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    error text,
    error_detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    heartbeat_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_processing_jobs_attempts_check CHECK (((attempts >= 0) AND (max_attempts > 0))),
    CONSTRAINT asset_processing_jobs_finished_consistency CHECK (((status = ANY (ARRAY['ready'::text, 'failed'::text, 'cancelled'::text])) = (finished_at IS NOT NULL))),
    CONSTRAINT asset_processing_jobs_pipeline_check CHECK ((pipeline = ANY (ARRAY['document'::text, 'image'::text, 'video'::text, 'audio'::text, 'generic'::text]))),
    CONSTRAINT asset_processing_jobs_progress_check CHECK (((progress >= (0)::numeric) AND (progress <= (100)::numeric))),
    CONSTRAINT asset_processing_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'validating'::text, 'scanning'::text, 'extracting'::text, 'chunking'::text, 'embedding'::text, 'indexing'::text, 'ready'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT asset_processing_jobs_time_order CHECK ((((started_at IS NULL) OR (started_at >= created_at)) AND ((finished_at IS NULL) OR (finished_at >= COALESCE(started_at, created_at)))))
);


--
-- Name: TABLE asset_processing_jobs; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.asset_processing_jobs IS 'One processing-pipeline run for one asset version (Phase 7). Forward-only state machine enforced by trigger.';


--
-- Name: COLUMN asset_processing_jobs.pipeline; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_processing_jobs.pipeline IS 'Processing pipeline: document | image | video | audio | generic.';


--
-- Name: COLUMN asset_processing_jobs.status; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_processing_jobs.status IS 'queued -> validating -> scanning -> extracting -> chunking -> embedding -> indexing -> ready; failed/cancelled terminal.';


--
-- Name: COLUMN asset_processing_jobs.progress; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_processing_jobs.progress IS 'Best-effort completion percentage 0-100.';


--
-- Name: advance_processing(uuid, text, text, numeric); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.advance_processing(p_job_id uuid, p_status text, p_detail text DEFAULT NULL::text, p_progress numeric DEFAULT NULL::numeric) RETURNS storage.asset_processing_jobs
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
DECLARE
    v_row storage.asset_processing_jobs;
BEGIN
    UPDATE storage.asset_processing_jobs
    SET status       = p_status,
        stage_detail = COALESCE(p_detail, stage_detail),
        progress     = COALESCE(p_progress, progress),
        heartbeat_at = now()
    WHERE processing_job_id = p_job_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'advance_processing: job % not found', p_job_id;
    END IF;
    RETURN v_row;
END;
$$;


--
-- Name: FUNCTION advance_processing(p_job_id uuid, p_status text, p_detail text, p_progress numeric); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.advance_processing(p_job_id uuid, p_status text, p_detail text, p_progress numeric) IS 'Moves a processing job to the next state (validated by the transition trigger).';


--
-- Name: assert_object_key_shape(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.assert_object_key_shape(p_key text) RETURNS void
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog', 'storage'
    AS $_$
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
$_$;


--
-- Name: FUNCTION assert_object_key_shape(p_key text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.assert_object_key_shape(p_key text) IS 'Raises if an object key violates the NEWAX structural key rules (Phase 4).';


--
-- Name: bucket_for_domain(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.bucket_for_domain(p_domain text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION bucket_for_domain(p_domain text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.bucket_for_domain(p_domain text) IS 'Maps a logical domain name to its permanent RustFS bucket.';


--
-- Name: build_object_key(text, uuid, text, text, uuid, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.build_object_key(p_domain text, p_tenant_id uuid, p_entity_type text, p_entity_id text, p_asset_id uuid, p_variant text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION build_object_key(p_domain text, p_tenant_id uuid, p_entity_type text, p_entity_id text, p_asset_id uuid, p_variant text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.build_object_key(p_domain text, p_tenant_id uuid, p_entity_type text, p_entity_id text, p_asset_id uuid, p_variant text) IS 'Builds a canonical NEWAX object key: {domain}/{tenant_id}/{entity_type}/{entity_id}/{asset_id}/{variant}.';


--
-- Name: complete_processing(uuid, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.complete_processing(p_job_id uuid, p_status text DEFAULT 'ready'::text, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
DECLARE
    v_job storage.asset_processing_jobs;
BEGIN
    IF p_status NOT IN ('ready','failed','cancelled') THEN
        RAISE EXCEPTION 'complete_processing: p_status must be ready|failed|cancelled, got %', p_status;
    END IF;

    UPDATE storage.asset_processing_jobs
    SET status       = p_status,
        error        = CASE WHEN p_status = 'ready' THEN NULL ELSE p_error END,
        error_detail = CASE WHEN p_status = 'ready' THEN '{}'::jsonb
                            ELSE jsonb_build_object('message', p_error) END,
        heartbeat_at = now()
    WHERE processing_job_id = p_job_id
    RETURNING * INTO v_job;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'complete_processing: job % not found', p_job_id;
    END IF;

    IF p_status = 'ready' THEN
        INSERT INTO storage.asset_events
            (asset_id, asset_version_id, tenant_id, event_type, event_source, payload)
        VALUES
            (v_job.asset_id, v_job.asset_version_id, v_job.tenant_id, 'asset.processed', 'processor',
             jsonb_build_object('pipeline', v_job.pipeline, 'processing_job_id', v_job.processing_job_id));
    END IF;
END;
$$;


--
-- Name: FUNCTION complete_processing(p_job_id uuid, p_status text, p_error text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.complete_processing(p_job_id uuid, p_status text, p_error text) IS 'Terminates a processing job; on ready, records an asset.processed event.';


--
-- Name: enqueue_processing(uuid, uuid, text, uuid, integer, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enqueue_processing(p_asset_id uuid, p_tenant_id uuid, p_pipeline text, p_asset_version_id uuid DEFAULT NULL::uuid, p_priority integer DEFAULT 100, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
DECLARE
    v_existing uuid;
    v_new      uuid;
BEGIN
    SELECT processing_job_id INTO v_existing
    FROM storage.asset_processing_jobs
    WHERE asset_id = p_asset_id AND pipeline = p_pipeline
      AND status NOT IN ('ready','failed','cancelled')
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    INSERT INTO storage.asset_processing_jobs
        (asset_id, asset_version_id, tenant_id, pipeline, priority, metadata)
    VALUES
        (p_asset_id, p_asset_version_id, p_tenant_id, p_pipeline, p_priority, coalesce(p_metadata, '{}'::jsonb))
    RETURNING processing_job_id INTO v_new;

    RETURN v_new;
END;
$$;


--
-- Name: FUNCTION enqueue_processing(p_asset_id uuid, p_tenant_id uuid, p_pipeline text, p_asset_version_id uuid, p_priority integer, p_metadata jsonb); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.enqueue_processing(p_asset_id uuid, p_tenant_id uuid, p_pipeline text, p_asset_version_id uuid, p_priority integer, p_metadata jsonb) IS 'Queues a processing job for an asset, or returns the id of the existing live job for that pipeline.';


--
-- Name: find_expired_temp_assets(integer); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.find_expired_temp_assets(p_limit integer DEFAULT 500) RETURNS TABLE(asset_id uuid, tenant_id uuid, bucket text, object_key text, expires_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION find_expired_temp_assets(p_limit integer); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.find_expired_temp_assets(p_limit integer) IS 'Returns the batch of expired newax-temp assets awaiting object deletion.';


--
-- Name: guard_asset_immutable_columns(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.guard_asset_immutable_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION guard_asset_immutable_columns(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.guard_asset_immutable_columns() IS 'Blocks changes to asset identity columns and to bucket/object_key once the object is in use.';


--
-- Name: guard_asset_version_immutable(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.guard_asset_version_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION guard_asset_version_immutable(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.guard_asset_version_immutable() IS 'Allows only is_current / deleted_at to change on an existing asset version.';


--
-- Name: mark_asset_deleted(uuid, uuid, text, uuid, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.mark_asset_deleted(p_asset_id uuid, p_tenant_id uuid, p_source text DEFAULT 'lifecycle'::text, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION mark_asset_deleted(p_asset_id uuid, p_tenant_id uuid, p_source text, p_actor_id uuid, p_reason text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.mark_asset_deleted(p_asset_id uuid, p_tenant_id uuid, p_source text, p_actor_id uuid, p_reason text) IS 'Soft-deletes an asset (archiving live versions) and records an asset.deleted event.';


--
-- Name: prevent_asset_delete_with_current_version(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prevent_asset_delete_with_current_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION prevent_asset_delete_with_current_version(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.prevent_asset_delete_with_current_version() IS 'Prevents soft-deleting an asset while a current active version exists.';


--
-- Name: prevent_asset_event_mutation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prevent_asset_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
BEGIN
    RAISE EXCEPTION
        'storage.asset_events is immutable: UPDATE and DELETE are not permitted';
END;
$$;


--
-- Name: FUNCTION prevent_asset_event_mutation(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.prevent_asset_event_mutation() IS 'Prevents modification or deletion of immutable storage lifecycle events.';


--
-- Name: prevent_asset_row_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prevent_asset_row_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
BEGIN
    RAISE EXCEPTION
        'storage.assets uses soft deletion: physical DELETE is not permitted';
END;
$$;


--
-- Name: FUNCTION prevent_asset_row_delete(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.prevent_asset_row_delete() IS 'Prevents physical deletion of asset registry rows; assets must use soft deletion.';


--
-- Name: set_new_asset_version_current(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.set_new_asset_version_current() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION set_new_asset_version_current(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.set_new_asset_version_current() IS 'Automatically archives the previous current asset version when a new version becomes current.';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION set_updated_at(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.set_updated_at() IS 'Automatically updates updated_at whenever a storage registry record changes.';


--
-- Name: slugify(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.slugify(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog', 'storage'
    AS $_$
    SELECT btrim(
             regexp_replace(
               regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9._-]+', '-', 'g'),
               '(^-+|-+$)', '', 'g'),
             '-');
$_$;


--
-- Name: FUNCTION slugify(p_text text); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.slugify(p_text text) IS 'Lowercases and reduces a string to [a-z0-9._-] for use in object keys.';


--
-- Name: validate_asset_object_key(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.validate_asset_object_key() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
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


--
-- Name: FUNCTION validate_asset_object_key(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.validate_asset_object_key() IS 'Enforces structural + asset-addressable object-key rules on storage.assets.';


--
-- Name: validate_asset_processing_transition(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.validate_asset_processing_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
DECLARE
    ok boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status NOT IN ('queued','validating') THEN
            RAISE EXCEPTION 'processing job must start in queued (or validating), got %', NEW.status;
        END IF;
        IF NEW.status <> 'queued' AND NEW.started_at IS NULL THEN
            NEW.started_at := now();
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status = OLD.status THEN
        NEW.updated_at := now();
        RETURN NEW;
    END IF;

    ok := CASE OLD.status
        WHEN 'queued'     THEN NEW.status IN ('validating','scanning','failed','cancelled')
        WHEN 'validating' THEN NEW.status IN ('scanning','failed','cancelled')
        WHEN 'scanning'   THEN NEW.status IN ('extracting','failed','cancelled')
        WHEN 'extracting' THEN NEW.status IN ('chunking','failed','cancelled')
        WHEN 'chunking'   THEN NEW.status IN ('embedding','failed','cancelled')
        WHEN 'embedding'  THEN NEW.status IN ('indexing','failed','cancelled')
        WHEN 'indexing'   THEN NEW.status IN ('ready','failed','cancelled')
        WHEN 'failed'     THEN NEW.status IN ('queued','cancelled')
        ELSE false   -- ready, cancelled are terminal
    END;

    IF NOT ok THEN
        RAISE EXCEPTION 'invalid processing transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF OLD.status = 'failed' AND NEW.status = 'queued' THEN
        IF OLD.attempts >= OLD.max_attempts THEN
            RAISE EXCEPTION 'processing job exhausted retries (% of %)', OLD.attempts, OLD.max_attempts;
        END IF;
        NEW.attempts     := OLD.attempts + 1;
        NEW.finished_at  := NULL;
        NEW.error        := NULL;
        NEW.error_detail := '{}'::jsonb;
    END IF;

    IF OLD.status = 'queued' AND NEW.started_at IS NULL THEN
        NEW.started_at := now();
    END IF;

    IF NEW.status IN ('ready','failed','cancelled') THEN
        NEW.finished_at := COALESCE(NEW.finished_at, now());
        IF NEW.status = 'ready' THEN
            NEW.progress := 100;
        END IF;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION validate_asset_processing_transition(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.validate_asset_processing_transition() IS 'Enforces the forward-only asset processing state machine and retry accounting.';


--
-- Name: validate_asset_status_transition(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.validate_asset_status_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
BEGIN

    IF OLD.storage_status = NEW.storage_status THEN

        IF NEW.storage_status <> 'deleted'
           AND NEW.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'deleted_at must be NULL when storage_status is %',
                NEW.storage_status;
        END IF;

        IF NEW.storage_status = 'deleted'
           AND NEW.deleted_at IS NULL THEN
            RAISE EXCEPTION
                'deleted_at is required when storage_status is deleted';
        END IF;

        RETURN NEW;
    END IF;


    IF NOT (
        (OLD.storage_status = 'pending'
            AND NEW.storage_status IN ('uploading', 'failed', 'deleted')) OR

        (OLD.storage_status = 'uploading'
            AND NEW.storage_status IN ('active', 'failed', 'quarantined', 'deleted')) OR

        (OLD.storage_status = 'active'
            AND NEW.storage_status IN ('processing', 'quarantined', 'deleted')) OR

        (OLD.storage_status = 'processing'
            AND NEW.storage_status IN ('active', 'failed', 'quarantined', 'deleted')) OR

        (OLD.storage_status = 'failed'
            AND NEW.storage_status IN ('uploading', 'deleted')) OR

        (OLD.storage_status = 'quarantined'
            AND NEW.storage_status IN ('processing', 'deleted')) OR

        (OLD.storage_status = 'deleted'
            AND NEW.storage_status IN ('active'))
    ) THEN

        RAISE EXCEPTION
            'Invalid storage status transition: % -> %',
            OLD.storage_status,
            NEW.storage_status;

    END IF;


    -- Restoration: deleted → active
    IF OLD.storage_status = 'deleted'
       AND NEW.storage_status = 'active' THEN
        NEW.deleted_at = NULL;
    END IF;


    -- Deletion: automatically timestamp
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


--
-- Name: FUNCTION validate_asset_status_transition(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.validate_asset_status_transition() IS 'Enforces valid storage asset lifecycle state transitions.';


--
-- Name: validate_asset_version_lifecycle(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.validate_asset_version_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
DECLARE
    v_asset_status TEXT;
    v_asset_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT
        storage_status,
        deleted_at
    INTO
        v_asset_status,
        v_asset_deleted_at
    FROM storage.assets
    WHERE asset_id = NEW.asset_id
      AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Parent asset not found for asset version: %',
            NEW.asset_version_id;
    END IF;

    IF NEW.is_current = TRUE
       AND NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A deleted asset version cannot be current';
    END IF;

    IF NEW.is_current = TRUE
       AND (
           v_asset_status = 'deleted'
           OR v_asset_deleted_at IS NOT NULL
       ) THEN
        RAISE EXCEPTION
            'A version cannot be current while its parent asset is deleted';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION validate_asset_version_lifecycle(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.validate_asset_version_lifecycle() IS 'Prevents invalid current/deleted asset-version lifecycle combinations.';


--
-- Name: validate_asset_version_object_key(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.validate_asset_version_object_key() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'storage'
    AS $$
BEGIN
    PERFORM storage.assert_object_key_shape(NEW.object_key);
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION validate_asset_version_object_key(); Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON FUNCTION storage.validate_asset_version_object_key() IS 'Enforces structural object-key rules on storage.asset_versions.';


--
-- Name: asset_chunks; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.asset_chunks (
    chunk_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    asset_version_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    content_hash character(64),
    token_count integer,
    embedding public.vector(1536),
    embedding_model text,
    lang text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_chunks_content_hash_format CHECK (((content_hash IS NULL) OR (content_hash ~ '^[0-9a-fA-F]{64}$'::text))),
    CONSTRAINT asset_chunks_content_not_empty CHECK ((length(btrim(content)) > 0)),
    CONSTRAINT asset_chunks_embedded_needs_model CHECK (((embedding IS NULL) OR (embedding_model IS NOT NULL))),
    CONSTRAINT asset_chunks_index_nonnegative CHECK ((chunk_index >= 0)),
    CONSTRAINT asset_chunks_token_count_nonnegative CHECK (((token_count IS NULL) OR (token_count >= 0)))
);


--
-- Name: TABLE asset_chunks; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.asset_chunks IS 'Text chunks + embeddings for RAG. Keyed by asset version; references asset identity, never filename (Phase 10).';


--
-- Name: COLUMN asset_chunks.asset_version_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_chunks.asset_version_id IS 'The exact asset version this chunk was extracted from.';


--
-- Name: COLUMN asset_chunks.content_hash; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_chunks.content_hash IS 'SHA-256 of content, for chunk-level dedupe across versions.';


--
-- Name: COLUMN asset_chunks.embedding; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_chunks.embedding IS 'pgvector embedding; dimension 1536 by default. See migration header to change.';


--
-- Name: asset_events; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.asset_events (
    asset_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    asset_version_id uuid,
    tenant_id uuid NOT NULL,
    organization_id uuid,
    event_type text NOT NULL,
    event_source text,
    actor_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_events_event_source_nonempty_check CHECK (((event_source IS NULL) OR (length(TRIM(BOTH FROM event_source)) > 0))),
    CONSTRAINT asset_events_event_type_check CHECK ((event_type = ANY (ARRAY['asset.created'::text, 'asset.upload.started'::text, 'asset.upload.completed'::text, 'asset.upload.failed'::text, 'asset.downloaded'::text, 'asset.processed'::text, 'asset.version.created'::text, 'asset.deleted'::text, 'asset.restored'::text, 'asset.quarantined'::text]))),
    CONSTRAINT asset_events_event_type_nonempty_check CHECK ((length(TRIM(BOTH FROM event_type)) > 0))
);


--
-- Name: TABLE asset_events; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.asset_events IS 'Immutable lifecycle event history for NEWAX assets and asset versions.';


--
-- Name: COLUMN asset_events.event_type; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_events.event_type IS 'Storage lifecycle event such as asset.created, asset.upload.started, asset.upload.completed, asset.processed, asset.deleted, asset.restored, or asset.quarantined.';


--
-- Name: COLUMN asset_events.event_source; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_events.event_source IS 'System or workflow that generated the event, such as n8n, api, ingestion, processor, or admin.';


--
-- Name: COLUMN asset_events.actor_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_events.actor_id IS 'Optional user or service identity responsible for the event.';


--
-- Name: COLUMN asset_events.payload; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_events.payload IS 'Event-specific structured metadata.';


--
-- Name: asset_versions; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.asset_versions (
    asset_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    bucket text NOT NULL,
    object_key text NOT NULL,
    version_id text,
    checksum_sha256 character(64),
    file_size_bytes bigint,
    mime_type text,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    CONSTRAINT asset_versions_bucket_check CHECK ((bucket = ANY (ARRAY['newax-images'::text, 'newax-videos'::text, 'newax-documents'::text, 'newax-temp'::text, 'newax-backups'::text]))),
    CONSTRAINT asset_versions_checksum_sha256_format CHECK (((checksum_sha256 IS NULL) OR (checksum_sha256 ~ '^[0-9a-fA-F]{64}$'::text))),
    CONSTRAINT asset_versions_current_not_deleted CHECK ((NOT ((is_current = true) AND (deleted_at IS NOT NULL)))),
    CONSTRAINT asset_versions_deleted_timestamp_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT asset_versions_file_size_nonnegative CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT asset_versions_mime_type_shape CHECK (((mime_type IS NULL) OR (mime_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'::text))),
    CONSTRAINT asset_versions_object_key_not_empty CHECK ((length(TRIM(BOTH FROM object_key)) > 0)),
    CONSTRAINT asset_versions_version_object_consistency CHECK (((version_id IS NULL) OR (length(TRIM(BOTH FROM version_id)) > 0)))
);


--
-- Name: TABLE asset_versions; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.asset_versions IS 'Version history for NEWAX assets. Each version identifies a specific RustFS object state.';


--
-- Name: COLUMN asset_versions.asset_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_versions.asset_id IS 'Logical NEWAX asset to which this version belongs.';


--
-- Name: COLUMN asset_versions.version_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_versions.version_id IS 'Native object-store version identifier when RustFS/object versioning is used.';


--
-- Name: COLUMN asset_versions.is_current; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_versions.is_current IS 'Indicates the currently active version of the logical asset.';


--
-- Name: COLUMN asset_versions.tenant_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.asset_versions.tenant_id IS 'Tenant owning this asset version; must match the parent asset tenant.';


--
-- Name: CONSTRAINT asset_versions_current_not_deleted ON asset_versions; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON CONSTRAINT asset_versions_current_not_deleted ON storage.asset_versions IS 'Prevents a deleted asset version from remaining the current version.';


--
-- Name: CONSTRAINT asset_versions_version_object_consistency ON asset_versions; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON CONSTRAINT asset_versions_version_object_consistency ON storage.asset_versions IS 'Ensures an explicitly supplied object-storage version ID is not empty.';


--
-- Name: assets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.assets (
    asset_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid,
    bucket text NOT NULL,
    object_key text NOT NULL,
    original_filename text,
    display_name text,
    mime_type text,
    file_extension text,
    file_size_bytes bigint,
    checksum_sha256 character(64),
    storage_provider text DEFAULT 'rustfs'::text NOT NULL,
    storage_status text DEFAULT 'active'::text NOT NULL,
    source_type text,
    source_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    expires_at timestamp with time zone,
    core_file_id uuid,
    CONSTRAINT assets_bucket_check CHECK ((bucket = ANY (ARRAY['newax-images'::text, 'newax-videos'::text, 'newax-documents'::text, 'newax-temp'::text, 'newax-backups'::text]))),
    CONSTRAINT assets_checksum_sha256_format CHECK (((checksum_sha256 IS NULL) OR (checksum_sha256 ~ '^[0-9a-fA-F]{64}$'::text))),
    CONSTRAINT assets_created_updated_order_check CHECK ((updated_at >= created_at)),
    CONSTRAINT assets_deleted_timestamp_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT assets_expiry_after_created CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT assets_file_extension_shape CHECK (((file_extension IS NULL) OR (file_extension ~ '^[a-z0-9]([a-z0-9.]{0,18}[a-z0-9])?$'::text))),
    CONSTRAINT assets_file_size_nonnegative CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT assets_mime_type_shape CHECK (((mime_type IS NULL) OR (mime_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'::text))),
    CONSTRAINT assets_object_key_not_empty CHECK ((length(TRIM(BOTH FROM object_key)) > 0)),
    CONSTRAINT assets_status_deleted_at_consistency_check CHECK ((((storage_status = 'deleted'::text) AND (deleted_at IS NOT NULL)) OR ((storage_status <> 'deleted'::text) AND (deleted_at IS NULL)))),
    CONSTRAINT assets_storage_provider_check CHECK ((storage_provider = 'rustfs'::text)),
    CONSTRAINT assets_storage_status_check CHECK ((storage_status = ANY (ARRAY['pending'::text, 'uploading'::text, 'active'::text, 'processing'::text, 'failed'::text, 'quarantined'::text, 'deleted'::text]))),
    CONSTRAINT assets_temp_requires_expiry CHECK (((bucket <> 'newax-temp'::text) OR (expires_at IS NOT NULL)))
);


--
-- Name: TABLE assets; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.assets IS 'NEWAX canonical asset registry. PostgreSQL stores asset identity and metadata; RustFS stores object bytes.';


--
-- Name: COLUMN assets.asset_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.asset_id IS 'Stable permanent identity of the asset. Domain workflows should reference this ID rather than raw object keys.';


--
-- Name: COLUMN assets.bucket; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.bucket IS 'RustFS bucket containing the object.';


--
-- Name: COLUMN assets.object_key; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.object_key IS 'Canonical RustFS object key. Not the permanent application-level identity.';


--
-- Name: COLUMN assets.metadata; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.metadata IS 'Extensible asset metadata that does not justify a dedicated relational column.';


--
-- Name: COLUMN assets.deleted_at; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.deleted_at IS 'Soft deletion timestamp. Object deletion from RustFS is handled by the storage lifecycle workflow.';


--
-- Name: COLUMN assets.expires_at; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.expires_at IS 'Business-level expiry. Required for newax-temp objects; NULL for permanent buckets unless a retention policy applies.';


--
-- Name: COLUMN assets.core_file_id; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.assets.core_file_id IS 'core-newax core_files.id for this asset''s tenant-safe discovery record (ADR-0032). Set by STORAGE_REGISTER after a successful files.register call; NULL until then and for assets registered before this integration existed. No local FK: core_files lives in a separate database until Phase 2 colocation.';


--
-- Name: schema_migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.schema_migrations (
    version text NOT NULL,
    description text,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_by text DEFAULT CURRENT_USER NOT NULL,
    duration_ms integer
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON TABLE storage.schema_migrations IS 'Applied NEWAX storage schema migrations (managed by db/migrate.sh).';


--
-- Name: v_asset_chunk_search; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_asset_chunk_search AS
 SELECT c.chunk_id,
    c.tenant_id,
    c.asset_id,
    c.asset_version_id,
    c.chunk_index,
    c.content,
    c.token_count,
    c.embedding,
    c.embedding_model,
    a.bucket,
    a.object_key,
    a.original_filename,
    a.display_name,
    a.mime_type,
    av.is_current AS from_current_version
   FROM ((storage.asset_chunks c
     JOIN storage.assets a ON (((a.asset_id = c.asset_id) AND (a.tenant_id = c.tenant_id))))
     JOIN storage.asset_versions av ON ((av.asset_version_id = c.asset_version_id)))
  WHERE (a.deleted_at IS NULL);


--
-- Name: VIEW v_asset_chunk_search; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_asset_chunk_search IS 'Chunks joined to live asset metadata for RAG retrieval. Filter by tenant_id and order by embedding <=> query.';


--
-- Name: v_bucket_usage; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_bucket_usage AS
 SELECT bucket,
    count(*) FILTER (WHERE (deleted_at IS NULL)) AS live_objects,
    COALESCE(sum(file_size_bytes) FILTER (WHERE (deleted_at IS NULL)), (0)::numeric) AS live_bytes,
    pg_size_pretty(COALESCE(sum(file_size_bytes) FILTER (WHERE (deleted_at IS NULL)), (0)::numeric)) AS live_size,
    count(*) FILTER (WHERE (deleted_at IS NOT NULL)) AS deleted_objects,
    count(*) FILTER (WHERE (storage_status = 'quarantined'::text)) AS quarantined_objects
   FROM storage.assets
  GROUP BY bucket
  ORDER BY bucket;


--
-- Name: VIEW v_bucket_usage; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_bucket_usage IS 'Object count and byte totals per bucket (Phase 12).';


--
-- Name: v_daily_growth; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_daily_growth AS
 SELECT day,
    objects_added,
    bytes_added,
    pg_size_pretty(bytes_added) AS size_added,
    sum(objects_added) OVER (ORDER BY day) AS cumulative_objects,
    pg_size_pretty(sum(bytes_added) OVER (ORDER BY day)) AS cumulative_size
   FROM ( SELECT (date_trunc('day'::text, assets.created_at))::date AS day,
            count(*) AS objects_added,
            COALESCE(sum(assets.file_size_bytes), (0)::numeric) AS bytes_added
           FROM storage.assets
          GROUP BY ((date_trunc('day'::text, assets.created_at))::date)) s
  ORDER BY day;


--
-- Name: VIEW v_daily_growth; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_daily_growth IS 'Objects and bytes added per day with running totals.';


--
-- Name: v_duplicate_objects; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_duplicate_objects AS
 SELECT checksum_sha256,
    count(*) AS copies,
    COALESCE(sum(file_size_bytes), (0)::numeric) AS total_bytes,
    (COALESCE(sum(file_size_bytes), (0)::numeric) - (COALESCE(max(file_size_bytes), (0)::bigint))::numeric) AS wasted_bytes,
    pg_size_pretty((COALESCE(sum(file_size_bytes), (0)::numeric) - (COALESCE(max(file_size_bytes), (0)::bigint))::numeric)) AS wasted_size,
    array_agg(asset_id ORDER BY created_at) AS asset_ids
   FROM storage.assets
  WHERE ((checksum_sha256 IS NOT NULL) AND (deleted_at IS NULL))
  GROUP BY checksum_sha256
 HAVING (count(*) > 1)
  ORDER BY (COALESCE(sum(file_size_bytes), (0)::numeric) - (COALESCE(max(file_size_bytes), (0)::bigint))::numeric) DESC;


--
-- Name: VIEW v_duplicate_objects; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_duplicate_objects IS 'Checksums with more than one live copy and the wasted bytes.';


--
-- Name: v_event_activity_24h; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_event_activity_24h AS
 SELECT date_trunc('hour'::text, created_at) AS hour,
    event_type,
    count(*) AS events
   FROM storage.asset_events
  WHERE (created_at >= (now() - '24:00:00'::interval))
  GROUP BY (date_trunc('hour'::text, created_at)), event_type
  ORDER BY (date_trunc('hour'::text, created_at)) DESC, event_type;


--
-- Name: VIEW v_event_activity_24h; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_event_activity_24h IS 'Hourly asset event counts for the last 24 hours.';


--
-- Name: v_event_activity_daily; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_event_activity_daily AS
 SELECT (date_trunc('day'::text, created_at))::date AS day,
    event_type,
    count(*) AS events
   FROM storage.asset_events
  GROUP BY ((date_trunc('day'::text, created_at))::date), event_type
  ORDER BY ((date_trunc('day'::text, created_at))::date) DESC, event_type;


--
-- Name: VIEW v_event_activity_daily; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_event_activity_daily IS 'Daily asset event counts by type.';


--
-- Name: v_largest_objects; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_largest_objects AS
 SELECT asset_id,
    tenant_id,
    bucket,
    object_key,
    mime_type,
    file_size_bytes,
    pg_size_pretty(file_size_bytes) AS size,
    created_at
   FROM storage.assets
  WHERE ((deleted_at IS NULL) AND (file_size_bytes IS NOT NULL))
  ORDER BY file_size_bytes DESC
 LIMIT 100;


--
-- Name: VIEW v_largest_objects; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_largest_objects IS 'Top 100 live objects by size.';


--
-- Name: v_monthly_growth; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_monthly_growth AS
 SELECT to_char(date_trunc('month'::text, created_at), 'YYYY-MM'::text) AS month,
    count(*) AS objects_added,
    pg_size_pretty(COALESCE(sum(file_size_bytes), (0)::numeric)) AS size_added
   FROM storage.assets
  GROUP BY (to_char(date_trunc('month'::text, created_at), 'YYYY-MM'::text))
  ORDER BY (to_char(date_trunc('month'::text, created_at), 'YYYY-MM'::text));


--
-- Name: VIEW v_monthly_growth; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_monthly_growth IS 'Objects and bytes added per calendar month.';


--
-- Name: v_processing_backlog; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_processing_backlog AS
 SELECT pipeline,
    status,
    count(*) AS jobs,
    min(queued_at) AS oldest_queued_at,
    max(heartbeat_at) AS last_heartbeat_at
   FROM storage.asset_processing_jobs
  GROUP BY pipeline, status
  ORDER BY pipeline, status;


--
-- Name: VIEW v_processing_backlog; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_processing_backlog IS 'Processing jobs grouped by pipeline and status.';


--
-- Name: v_status_summary; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_status_summary AS
 SELECT storage_status,
    count(*) AS objects,
    COALESCE(sum(file_size_bytes), (0)::numeric) AS bytes,
    pg_size_pretty(COALESCE(sum(file_size_bytes), (0)::numeric)) AS size
   FROM storage.assets
  GROUP BY storage_status
  ORDER BY (count(*)) DESC;


--
-- Name: VIEW v_status_summary; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_status_summary IS 'Object counts and bytes grouped by storage_status.';


--
-- Name: v_storage_overview; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_storage_overview AS
 SELECT ( SELECT count(*) AS count
           FROM storage.assets
          WHERE (assets.deleted_at IS NULL)) AS live_objects,
    ( SELECT pg_size_pretty(COALESCE(sum(assets.file_size_bytes), (0)::numeric)) AS pg_size_pretty
           FROM storage.assets
          WHERE (assets.deleted_at IS NULL)) AS live_size,
    ( SELECT count(DISTINCT assets.tenant_id) AS count
           FROM storage.assets) AS tenants,
    ( SELECT count(DISTINCT assets.organization_id) AS count
           FROM storage.assets
          WHERE (assets.organization_id IS NOT NULL)) AS organizations,
    ( SELECT count(*) AS count
           FROM storage.assets
          WHERE ((assets.bucket = 'newax-temp'::text) AND (assets.deleted_at IS NULL))) AS temp_objects,
    ( SELECT count(*) AS count
           FROM storage.assets
          WHERE ((assets.bucket = 'newax-temp'::text) AND (assets.deleted_at IS NULL) AND (assets.expires_at <= now()))) AS temp_expired,
    ( SELECT count(*) AS count
           FROM storage.v_duplicate_objects) AS duplicate_checksums,
    ( SELECT count(*) AS count
           FROM storage.assets
          WHERE (assets.storage_status = 'quarantined'::text)) AS quarantined,
    ( SELECT count(*) AS count
           FROM storage.asset_processing_jobs
          WHERE (asset_processing_jobs.status <> ALL (ARRAY['ready'::text, 'failed'::text, 'cancelled'::text]))) AS processing_in_flight,
    ( SELECT count(*) AS count
           FROM storage.asset_processing_jobs
          WHERE (asset_processing_jobs.status = 'failed'::text)) AS processing_failed,
    ( SELECT count(*) AS count
           FROM storage.asset_chunks) AS rag_chunks;


--
-- Name: VIEW v_storage_overview; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_storage_overview IS 'Single-row platform storage KPIs for the admin dashboard.';


--
-- Name: v_temp_pending_expiry; Type: VIEW; Schema: storage; Owner: -
--

CREATE VIEW storage.v_temp_pending_expiry AS
 SELECT asset_id,
    tenant_id,
    object_key,
    storage_status,
    created_at,
    expires_at,
    (expires_at <= now()) AS is_expired,
    EXTRACT(epoch FROM (expires_at - now())) AS seconds_remaining
   FROM storage.assets
  WHERE ((bucket = 'newax-temp'::text) AND (deleted_at IS NULL))
  ORDER BY expires_at;


--
-- Name: VIEW v_temp_pending_expiry; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON VIEW storage.v_temp_pending_expiry IS 'newax-temp objects with expiry and time remaining.';


--
-- Name: asset_chunks asset_chunks_index_uq; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_chunks
    ADD CONSTRAINT asset_chunks_index_uq UNIQUE (asset_version_id, chunk_index);


--
-- Name: asset_chunks asset_chunks_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_chunks
    ADD CONSTRAINT asset_chunks_pkey PRIMARY KEY (chunk_id);


--
-- Name: asset_events asset_events_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_events
    ADD CONSTRAINT asset_events_pkey PRIMARY KEY (asset_event_id);


--
-- Name: asset_processing_jobs asset_processing_jobs_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_processing_jobs
    ADD CONSTRAINT asset_processing_jobs_pkey PRIMARY KEY (processing_job_id);


--
-- Name: asset_versions asset_versions_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_versions
    ADD CONSTRAINT asset_versions_pkey PRIMARY KEY (asset_version_id);


--
-- Name: assets assets_asset_tenant_uq; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.assets
    ADD CONSTRAINT assets_asset_tenant_uq UNIQUE (asset_id, tenant_id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (asset_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: asset_chunks_asset_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_chunks_asset_idx ON storage.asset_chunks USING btree (asset_id);


--
-- Name: asset_chunks_content_hash_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_chunks_content_hash_idx ON storage.asset_chunks USING btree (content_hash) WHERE (content_hash IS NOT NULL);


--
-- Name: asset_chunks_embedding_hnsw; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_chunks_embedding_hnsw ON storage.asset_chunks USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: asset_chunks_metadata_gin_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_chunks_metadata_gin_idx ON storage.asset_chunks USING gin (metadata);


--
-- Name: asset_chunks_tenant_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_chunks_tenant_idx ON storage.asset_chunks USING btree (tenant_id);


--
-- Name: asset_events_asset_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_asset_idx ON storage.asset_events USING btree (asset_id, created_at DESC);


--
-- Name: asset_events_created_at_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_created_at_idx ON storage.asset_events USING btree (created_at DESC);


--
-- Name: asset_events_payload_gin_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_payload_gin_idx ON storage.asset_events USING gin (payload);


--
-- Name: asset_events_tenant_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_tenant_idx ON storage.asset_events USING btree (tenant_id, created_at DESC);


--
-- Name: asset_events_type_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_type_idx ON storage.asset_events USING btree (event_type, created_at DESC);


--
-- Name: asset_events_version_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_events_version_idx ON storage.asset_events USING btree (asset_version_id, created_at DESC) WHERE (asset_version_id IS NOT NULL);


--
-- Name: asset_processing_jobs_asset_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_processing_jobs_asset_idx ON storage.asset_processing_jobs USING btree (asset_id, created_at DESC);


--
-- Name: asset_processing_jobs_one_live_per_pipeline; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX asset_processing_jobs_one_live_per_pipeline ON storage.asset_processing_jobs USING btree (asset_id, pipeline) WHERE (status <> ALL (ARRAY['ready'::text, 'failed'::text, 'cancelled'::text]));


--
-- Name: asset_processing_jobs_queue_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_processing_jobs_queue_idx ON storage.asset_processing_jobs USING btree (priority DESC, queued_at) WHERE (status <> ALL (ARRAY['ready'::text, 'failed'::text, 'cancelled'::text]));


--
-- Name: asset_processing_jobs_status_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_processing_jobs_status_idx ON storage.asset_processing_jobs USING btree (status, updated_at DESC);


--
-- Name: asset_processing_jobs_tenant_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_processing_jobs_tenant_idx ON storage.asset_processing_jobs USING btree (tenant_id, created_at DESC);


--
-- Name: asset_processing_jobs_version_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_processing_jobs_version_idx ON storage.asset_processing_jobs USING btree (asset_version_id) WHERE (asset_version_id IS NOT NULL);


--
-- Name: asset_versions_asset_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_versions_asset_idx ON storage.asset_versions USING btree (asset_id);


--
-- Name: asset_versions_checksum_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_versions_checksum_idx ON storage.asset_versions USING btree (checksum_sha256) WHERE (checksum_sha256 IS NOT NULL);


--
-- Name: asset_versions_created_at_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_versions_created_at_idx ON storage.asset_versions USING btree (created_at DESC);


--
-- Name: asset_versions_current_uq; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX asset_versions_current_uq ON storage.asset_versions USING btree (asset_id) WHERE ((is_current = true) AND (deleted_at IS NULL));


--
-- Name: asset_versions_identity_uq; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX asset_versions_identity_uq ON storage.asset_versions USING btree (asset_version_id, asset_id, tenant_id);


--
-- Name: asset_versions_null_version_uq; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX asset_versions_null_version_uq ON storage.asset_versions USING btree (asset_id, bucket, object_key) WHERE ((version_id IS NULL) AND (deleted_at IS NULL));


--
-- Name: asset_versions_tenant_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX asset_versions_tenant_idx ON storage.asset_versions USING btree (tenant_id);


--
-- Name: asset_versions_version_uq; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX asset_versions_version_uq ON storage.asset_versions USING btree (asset_id, version_id) WHERE ((version_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: assets_bucket_object_key_uq; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX assets_bucket_object_key_uq ON storage.assets USING btree (bucket, object_key) WHERE (deleted_at IS NULL);


--
-- Name: assets_checksum_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_checksum_idx ON storage.assets USING btree (checksum_sha256) WHERE (checksum_sha256 IS NOT NULL);


--
-- Name: assets_core_file_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_core_file_id_idx ON storage.assets USING btree (core_file_id) WHERE (core_file_id IS NOT NULL);


--
-- Name: assets_created_at_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_created_at_idx ON storage.assets USING btree (created_at DESC);


--
-- Name: assets_metadata_gin_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_metadata_gin_idx ON storage.assets USING gin (metadata);


--
-- Name: assets_organization_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_organization_idx ON storage.assets USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: assets_source_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_source_idx ON storage.assets USING btree (source_type, source_id) WHERE ((source_type IS NOT NULL) AND (source_id IS NOT NULL));


--
-- Name: assets_status_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_status_idx ON storage.assets USING btree (storage_status);


--
-- Name: assets_temp_expiry_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_temp_expiry_idx ON storage.assets USING btree (expires_at) WHERE ((bucket = 'newax-temp'::text) AND (deleted_at IS NULL));


--
-- Name: assets_tenant_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX assets_tenant_idx ON storage.assets USING btree (tenant_id);


--
-- Name: asset_events asset_events_immutable; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_events_immutable BEFORE DELETE OR UPDATE ON storage.asset_events FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_event_mutation();


--
-- Name: asset_processing_jobs asset_processing_jobs_transition; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_processing_jobs_transition BEFORE INSERT OR UPDATE ON storage.asset_processing_jobs FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_processing_transition();


--
-- Name: asset_versions asset_versions_guard_immutable; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_versions_guard_immutable BEFORE UPDATE ON storage.asset_versions FOR EACH ROW EXECUTE FUNCTION storage.guard_asset_version_immutable();


--
-- Name: asset_versions asset_versions_set_current; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_versions_set_current BEFORE INSERT ON storage.asset_versions FOR EACH ROW EXECUTE FUNCTION storage.set_new_asset_version_current();


--
-- Name: asset_versions asset_versions_validate_lifecycle; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_versions_validate_lifecycle BEFORE INSERT OR UPDATE OF is_current, deleted_at ON storage.asset_versions FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_version_lifecycle();


--
-- Name: asset_versions asset_versions_validate_object_key; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER asset_versions_validate_object_key BEFORE INSERT OR UPDATE OF object_key ON storage.asset_versions FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_version_object_key();


--
-- Name: assets assets_guard_immutable; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_guard_immutable BEFORE UPDATE ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.guard_asset_immutable_columns();


--
-- Name: assets assets_prevent_delete_with_current_version; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_prevent_delete_with_current_version BEFORE UPDATE OF storage_status, deleted_at ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_delete_with_current_version();


--
-- Name: assets assets_prevent_row_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_prevent_row_delete BEFORE DELETE ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.prevent_asset_row_delete();


--
-- Name: assets assets_set_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.set_updated_at();


--
-- Name: assets assets_validate_object_key; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_validate_object_key BEFORE INSERT OR UPDATE OF object_key ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_object_key();


--
-- Name: assets assets_validate_status_transition; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER assets_validate_status_transition BEFORE UPDATE OF storage_status ON storage.assets FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_status_transition();


--
-- Name: asset_chunks asset_chunks_version_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_chunks
    ADD CONSTRAINT asset_chunks_version_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id) REFERENCES storage.asset_versions(asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT;


--
-- Name: asset_events asset_events_asset_tenant_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_events
    ADD CONSTRAINT asset_events_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id) REFERENCES storage.assets(asset_id, tenant_id) ON DELETE RESTRICT;


--
-- Name: asset_events asset_events_version_asset_tenant_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_events
    ADD CONSTRAINT asset_events_version_asset_tenant_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id) REFERENCES storage.asset_versions(asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT;


--
-- Name: asset_processing_jobs asset_processing_jobs_asset_tenant_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_processing_jobs
    ADD CONSTRAINT asset_processing_jobs_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id) REFERENCES storage.assets(asset_id, tenant_id) ON DELETE RESTRICT;


--
-- Name: asset_processing_jobs asset_processing_jobs_version_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_processing_jobs
    ADD CONSTRAINT asset_processing_jobs_version_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id) REFERENCES storage.asset_versions(asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT;


--
-- Name: asset_versions asset_versions_asset_tenant_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.asset_versions
    ADD CONSTRAINT asset_versions_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id) REFERENCES storage.assets(asset_id, tenant_id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 6fsJ4fB2w5c43Jadgk3hWKbwaIhLbizfi9ujBOgx0WeIdcPmMHQ2ArZh67l0xm1

