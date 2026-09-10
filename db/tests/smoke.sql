-- Smoke test for the storage schema. Runs entirely inside a transaction
-- that is rolled back, so it never mutates real data.
--   docker exec -i n8n-postgres psql -U n8n -d n8n -v ON_ERROR_STOP=1 -X -f - < db/tests/smoke.sql
BEGIN;
SET LOCAL client_min_messages = WARNING;

DO $$
DECLARE
    t  uuid := gen_random_uuid();
    a  uuid := gen_random_uuid();
    a2 uuid := gen_random_uuid();
    v  uuid;
    j  uuid;
    k  text;
    bad_count int := 0;
BEGIN
    -- build_object_key produces a compliant key
    k := storage.build_object_key('documents', t, 'organization', 'Org 0042!', a, 'original.pdf');
    ASSERT k = 'documents/' || t || '/organization/org-0042/' || a || '/original.pdf',
        format('unexpected key: %s', k);

    -- good asset insert
    INSERT INTO storage.assets (asset_id, tenant_id, bucket, object_key, file_size_bytes, storage_status,
                                mime_type, file_extension)
    VALUES (a, t, 'newax-documents', k, 123, 'active', 'application/pdf', 'pdf');

    -- object key without the asset_id is rejected
    BEGIN
        INSERT INTO storage.assets (tenant_id, bucket, object_key)
        VALUES (t, 'newax-documents', 'documents/' || t || '/loose/file.pdf');
        RAISE EXCEPTION 'expected object_key rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%must contain the asset_id%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    -- uppercase / structural rejection
    BEGIN
        PERFORM storage.assert_object_key_shape('Documents/Bad KEY');
        RAISE EXCEPTION 'expected shape rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%lowercase%' OR SQLERRM LIKE '%at least 3%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    -- temp asset requires expires_at
    BEGIN
        INSERT INTO storage.assets (asset_id, tenant_id, bucket, object_key)
        VALUES (gen_random_uuid(), t, 'newax-temp', 'temp/job/j1/x/input.bin');
        RAISE EXCEPTION 'expected temp expiry rejection did not happen';
    EXCEPTION WHEN check_violation THEN
        bad_count := bad_count + 1;
    END;

    -- 0008: bad mime_type shape is rejected
    BEGIN
        INSERT INTO storage.assets (asset_id, tenant_id, bucket, object_key, mime_type)
        VALUES (a2, t, 'newax-documents',
                storage.build_object_key('documents', t, 'x', 'y', a2, 'original.pdf'), 'PDF document');
        RAISE EXCEPTION 'expected mime_type rejection did not happen';
    EXCEPTION WHEN check_violation THEN
        bad_count := bad_count + 1;
    END;

    -- 0008: identity column is immutable
    BEGIN
        UPDATE storage.assets SET tenant_id = gen_random_uuid() WHERE asset_id = a;
        RAISE EXCEPTION 'expected immutable-column rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%immutable%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    -- 0008: bucket/object_key frozen once the asset is active
    BEGIN
        UPDATE storage.assets SET object_key = object_key || '-moved' WHERE asset_id = a;
        RAISE EXCEPTION 'expected bucket/object_key freeze rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%pending or uploading%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    -- version + processing pipeline
    INSERT INTO storage.asset_versions (asset_id, tenant_id, bucket, object_key, is_current, checksum_sha256)
    VALUES (a, t, 'newax-documents', k, true, repeat('a', 64))
    RETURNING asset_version_id INTO v;

    -- 0008: asset version snapshot is immutable except is_current/deleted_at
    BEGIN
        UPDATE storage.asset_versions SET checksum_sha256 = repeat('b', 64) WHERE asset_version_id = v;
        RAISE EXCEPTION 'expected asset_version immutability rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%immutable%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    j := storage.enqueue_processing(a, t, 'document', v);
    ASSERT storage.enqueue_processing(a, t, 'document', v) = j, 'enqueue not idempotent';

    PERFORM storage.advance_processing(j, 'validating');
    PERFORM storage.advance_processing(j, 'scanning');
    PERFORM storage.advance_processing(j, 'extracting');
    PERFORM storage.advance_processing(j, 'chunking');
    PERFORM storage.advance_processing(j, 'embedding');
    PERFORM storage.advance_processing(j, 'indexing');

    -- illegal skip is rejected
    BEGIN
        PERFORM storage.advance_processing(j, 'queued');
        RAISE EXCEPTION 'expected processing transition rejection did not happen';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%invalid processing transition%' THEN bad_count := bad_count + 1;
        ELSE RAISE; END IF;
    END;

    PERFORM storage.complete_processing(j, 'ready');
    ASSERT (SELECT status FROM storage.asset_processing_jobs WHERE processing_job_id = j) = 'ready';
    ASSERT (SELECT count(*) FROM storage.asset_events
            WHERE asset_id = a AND event_type = 'asset.processed') = 1, 'no asset.processed event';

    -- a chunk with an embedding
    INSERT INTO storage.asset_chunks (asset_id, asset_version_id, tenant_id, chunk_index, content, embedding, embedding_model)
    VALUES (a, v, t, 0, 'hello world', array_fill(0.01, ARRAY[1536])::vector, 'text-embedding-3-small');

    -- soft-delete path (archives the current version first)
    ASSERT storage.mark_asset_deleted(a, t, 'smoke-test') = true;
    ASSERT (SELECT storage_status FROM storage.assets WHERE asset_id = a) = 'deleted';
    ASSERT storage.mark_asset_deleted(a, t, 'smoke-test') = false, 'second delete should be a no-op';

    ASSERT bad_count = 8, format('expected 8 negative cases, got %s', bad_count);
    RAISE NOTICE 'SMOKE OK: key validation, temp expiry, mime/immutability guards, pipeline state machine, chunks, soft-delete all pass';
END $$;

ROLLBACK;
