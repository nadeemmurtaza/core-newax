-- 0006_observability_views  (Phase 12)
--
-- Read-only reporting views over the storage registry. No data change.
-- Intended for an admin dashboard, capacity alerts, and cleanup jobs.

-- Per-bucket usage -----------------------------------------------------------
CREATE OR REPLACE VIEW storage.v_bucket_usage AS
SELECT bucket,
       count(*) FILTER (WHERE deleted_at IS NULL)                          AS live_objects,
       COALESCE(sum(file_size_bytes) FILTER (WHERE deleted_at IS NULL), 0) AS live_bytes,
       pg_size_pretty(COALESCE(sum(file_size_bytes) FILTER (WHERE deleted_at IS NULL), 0)) AS live_size,
       count(*) FILTER (WHERE deleted_at IS NOT NULL)                      AS deleted_objects,
       count(*) FILTER (WHERE storage_status = 'quarantined')              AS quarantined_objects
FROM storage.assets
GROUP BY bucket
ORDER BY bucket;

-- Status breakdown ---------------------------------------------------------
CREATE OR REPLACE VIEW storage.v_status_summary AS
SELECT storage_status,
       count(*)                                        AS objects,
       COALESCE(sum(file_size_bytes), 0)               AS bytes,
       pg_size_pretty(COALESCE(sum(file_size_bytes),0)) AS size
FROM storage.assets
GROUP BY storage_status
ORDER BY objects DESC;

-- Daily growth (live objects created per day, with running total) ----------
CREATE OR REPLACE VIEW storage.v_daily_growth AS
SELECT day,
       objects_added,
       bytes_added,
       pg_size_pretty(bytes_added)                                  AS size_added,
       sum(objects_added) OVER (ORDER BY day)                       AS cumulative_objects,
       pg_size_pretty(sum(bytes_added) OVER (ORDER BY day))         AS cumulative_size
FROM (
    SELECT date_trunc('day', created_at)::date       AS day,
           count(*)                                  AS objects_added,
           COALESCE(sum(file_size_bytes), 0)         AS bytes_added
    FROM storage.assets
    GROUP BY 1
) s
ORDER BY day;

-- Monthly growth ---------------------------------------------------------
CREATE OR REPLACE VIEW storage.v_monthly_growth AS
SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
       count(*)                                            AS objects_added,
       pg_size_pretty(COALESCE(sum(file_size_bytes), 0))   AS size_added
FROM storage.assets
GROUP BY 1
ORDER BY 1;

-- Duplicate objects (same checksum, more than one live copy) --------------
CREATE OR REPLACE VIEW storage.v_duplicate_objects AS
SELECT checksum_sha256,
       count(*)                                              AS copies,
       COALESCE(sum(file_size_bytes), 0)                     AS total_bytes,
       COALESCE(sum(file_size_bytes), 0)
         - COALESCE(max(file_size_bytes), 0)                 AS wasted_bytes,
       pg_size_pretty(COALESCE(sum(file_size_bytes), 0)
         - COALESCE(max(file_size_bytes), 0))                AS wasted_size,
       array_agg(asset_id ORDER BY created_at)               AS asset_ids
FROM storage.assets
WHERE checksum_sha256 IS NOT NULL AND deleted_at IS NULL
GROUP BY checksum_sha256
HAVING count(*) > 1
ORDER BY wasted_bytes DESC;

-- Largest live objects ---------------------------------------------------
CREATE OR REPLACE VIEW storage.v_largest_objects AS
SELECT asset_id, tenant_id, bucket, object_key, mime_type,
       file_size_bytes,
       pg_size_pretty(file_size_bytes) AS size,
       created_at
FROM storage.assets
WHERE deleted_at IS NULL AND file_size_bytes IS NOT NULL
ORDER BY file_size_bytes DESC
LIMIT 100;

-- Temp objects and their expiry ----------------------------------------
CREATE OR REPLACE VIEW storage.v_temp_pending_expiry AS
SELECT asset_id, tenant_id, object_key, storage_status,
       created_at, expires_at,
       (expires_at <= now())                    AS is_expired,
       EXTRACT(EPOCH FROM (expires_at - now())) AS seconds_remaining
FROM storage.assets
WHERE bucket = 'newax-temp' AND deleted_at IS NULL
ORDER BY expires_at;

-- Processing backlog ---------------------------------------------------
CREATE OR REPLACE VIEW storage.v_processing_backlog AS
SELECT pipeline,
       status,
       count(*)         AS jobs,
       min(queued_at)   AS oldest_queued_at,
       max(heartbeat_at) AS last_heartbeat_at
FROM storage.asset_processing_jobs
GROUP BY pipeline, status
ORDER BY pipeline, status;

-- Event activity, last 24h by hour -----------------------------------
CREATE OR REPLACE VIEW storage.v_event_activity_24h AS
SELECT date_trunc('hour', created_at) AS hour,
       event_type,
       count(*) AS events
FROM storage.asset_events
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Event activity, daily by type ------------------------------------
CREATE OR REPLACE VIEW storage.v_event_activity_daily AS
SELECT date_trunc('day', created_at)::date AS day,
       event_type,
       count(*) AS events
FROM storage.asset_events
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Single-row platform overview -------------------------------------
CREATE OR REPLACE VIEW storage.v_storage_overview AS
SELECT
    (SELECT count(*) FROM storage.assets WHERE deleted_at IS NULL)                              AS live_objects,
    (SELECT pg_size_pretty(COALESCE(sum(file_size_bytes), 0))
       FROM storage.assets WHERE deleted_at IS NULL)                                            AS live_size,
    (SELECT count(DISTINCT tenant_id) FROM storage.assets)                                      AS tenants,
    (SELECT count(DISTINCT organization_id) FROM storage.assets WHERE organization_id IS NOT NULL) AS organizations,
    (SELECT count(*) FROM storage.assets WHERE bucket = 'newax-temp' AND deleted_at IS NULL)    AS temp_objects,
    (SELECT count(*) FROM storage.assets
       WHERE bucket = 'newax-temp' AND deleted_at IS NULL AND expires_at <= now())              AS temp_expired,
    (SELECT count(*) FROM storage.v_duplicate_objects)                                          AS duplicate_checksums,
    (SELECT count(*) FROM storage.assets WHERE storage_status = 'quarantined')                  AS quarantined,
    (SELECT count(*) FROM storage.asset_processing_jobs
       WHERE status NOT IN ('ready','failed','cancelled'))                                      AS processing_in_flight,
    (SELECT count(*) FROM storage.asset_processing_jobs WHERE status = 'failed')                AS processing_failed,
    (SELECT count(*) FROM storage.asset_chunks)                                                 AS rag_chunks;

COMMENT ON VIEW storage.v_bucket_usage        IS 'Object count and byte totals per bucket (Phase 12).';
COMMENT ON VIEW storage.v_status_summary      IS 'Object counts and bytes grouped by storage_status.';
COMMENT ON VIEW storage.v_daily_growth        IS 'Objects and bytes added per day with running totals.';
COMMENT ON VIEW storage.v_monthly_growth      IS 'Objects and bytes added per calendar month.';
COMMENT ON VIEW storage.v_duplicate_objects   IS 'Checksums with more than one live copy and the wasted bytes.';
COMMENT ON VIEW storage.v_largest_objects     IS 'Top 100 live objects by size.';
COMMENT ON VIEW storage.v_temp_pending_expiry IS 'newax-temp objects with expiry and time remaining.';
COMMENT ON VIEW storage.v_processing_backlog  IS 'Processing jobs grouped by pipeline and status.';
COMMENT ON VIEW storage.v_event_activity_24h  IS 'Hourly asset event counts for the last 24 hours.';
COMMENT ON VIEW storage.v_event_activity_daily IS 'Daily asset event counts by type.';
COMMENT ON VIEW storage.v_storage_overview    IS 'Single-row platform storage KPIs for the admin dashboard.';
