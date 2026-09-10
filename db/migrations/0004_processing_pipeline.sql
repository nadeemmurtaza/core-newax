-- 0004_processing_pipeline  (Phase 7)
--
-- Assets in an AI platform are not just "files" - they move through a
-- processing pipeline:
--   queued -> validating -> scanning -> extracting -> chunking
--          -> embedding  -> indexing  -> ready
-- with failed / cancelled as terminal side states (failed may be re-queued
-- while attempts remain).
--
-- storage.asset_processing_jobs tracks one pipeline run for one asset
-- version. The forward-only state machine is enforced by trigger.

CREATE TABLE IF NOT EXISTS storage.asset_processing_jobs (
    processing_job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id          uuid NOT NULL,
    asset_version_id  uuid,
    tenant_id         uuid NOT NULL,
    pipeline          text NOT NULL,
    status            text NOT NULL DEFAULT 'queued',
    stage_detail      text,
    progress          numeric(5,2) NOT NULL DEFAULT 0,
    attempts          integer NOT NULL DEFAULT 0,
    max_attempts      integer NOT NULL DEFAULT 3,
    priority          integer NOT NULL DEFAULT 100,
    error             text,
    error_detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
    queued_at         timestamptz NOT NULL DEFAULT now(),
    started_at        timestamptz,
    heartbeat_at      timestamptz,
    finished_at       timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT asset_processing_jobs_pkey PRIMARY KEY (processing_job_id),
    CONSTRAINT asset_processing_jobs_asset_tenant_fkey FOREIGN KEY (asset_id, tenant_id)
        REFERENCES storage.assets (asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_processing_jobs_version_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id)
        REFERENCES storage.asset_versions (asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_processing_jobs_pipeline_check CHECK (pipeline = ANY (ARRAY['document','image','video','audio','generic'])),
    CONSTRAINT asset_processing_jobs_status_check CHECK (status = ANY (ARRAY[
        'queued','validating','scanning','extracting','chunking','embedding','indexing','ready','failed','cancelled'])),
    CONSTRAINT asset_processing_jobs_progress_check CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT asset_processing_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts > 0),
    CONSTRAINT asset_processing_jobs_finished_consistency CHECK (
        (status IN ('ready','failed','cancelled')) = (finished_at IS NOT NULL))
);
COMMENT ON TABLE storage.asset_processing_jobs IS
  'One processing-pipeline run for one asset version (Phase 7). Forward-only state machine enforced by trigger.';
COMMENT ON COLUMN storage.asset_processing_jobs.pipeline IS 'Processing pipeline: document | image | video | audio | generic.';
COMMENT ON COLUMN storage.asset_processing_jobs.status IS 'queued -> validating -> scanning -> extracting -> chunking -> embedding -> indexing -> ready; failed/cancelled terminal.';
COMMENT ON COLUMN storage.asset_processing_jobs.progress IS 'Best-effort completion percentage 0-100.';

CREATE INDEX IF NOT EXISTS asset_processing_jobs_queue_idx
    ON storage.asset_processing_jobs (priority DESC, queued_at)
    WHERE status NOT IN ('ready','failed','cancelled');
CREATE INDEX IF NOT EXISTS asset_processing_jobs_asset_idx
    ON storage.asset_processing_jobs (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_processing_jobs_tenant_idx
    ON storage.asset_processing_jobs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_processing_jobs_status_idx
    ON storage.asset_processing_jobs (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS asset_processing_jobs_one_live_per_pipeline
    ON storage.asset_processing_jobs (asset_id, pipeline)
    WHERE status NOT IN ('ready','failed','cancelled');

-- ---------------------------------------------------------------------------
-- Forward-only state machine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.validate_asset_processing_transition() RETURNS trigger
    LANGUAGE plpgsql AS $$
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
COMMENT ON FUNCTION storage.validate_asset_processing_transition() IS
  'Enforces the forward-only asset processing state machine and retry accounting.';

DROP TRIGGER IF EXISTS asset_processing_jobs_transition ON storage.asset_processing_jobs;
CREATE TRIGGER asset_processing_jobs_transition
    BEFORE INSERT OR UPDATE ON storage.asset_processing_jobs
    FOR EACH ROW EXECUTE FUNCTION storage.validate_asset_processing_transition();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage.enqueue_processing(
        p_asset_id         uuid,
        p_tenant_id        uuid,
        p_pipeline         text,
        p_asset_version_id uuid DEFAULT NULL,
        p_priority         integer DEFAULT 100,
        p_metadata         jsonb DEFAULT '{}'::jsonb)
    RETURNS uuid
    LANGUAGE plpgsql AS $$
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
COMMENT ON FUNCTION storage.enqueue_processing(uuid, uuid, text, uuid, integer, jsonb) IS
  'Queues a processing job for an asset, or returns the id of the existing live job for that pipeline.';

CREATE OR REPLACE FUNCTION storage.advance_processing(
        p_job_id  uuid,
        p_status  text,
        p_detail  text DEFAULT NULL,
        p_progress numeric DEFAULT NULL)
    RETURNS storage.asset_processing_jobs
    LANGUAGE plpgsql AS $$
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
COMMENT ON FUNCTION storage.advance_processing(uuid, text, text, numeric) IS
  'Moves a processing job to the next state (validated by the transition trigger).';

CREATE OR REPLACE FUNCTION storage.complete_processing(
        p_job_id uuid,
        p_status text DEFAULT 'ready',
        p_error  text DEFAULT NULL)
    RETURNS void
    LANGUAGE plpgsql AS $$
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
COMMENT ON FUNCTION storage.complete_processing(uuid, text, text) IS
  'Terminates a processing job; on ready, records an asset.processed event.';
