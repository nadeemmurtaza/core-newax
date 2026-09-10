-- 0005_rag_chunks  (Phase 10)
--
-- RAG / knowledge records reference the asset by identity, never by
-- filename: (tenant_id, asset_id, asset_version_id, chunk_id). Renaming a
-- file changes storage.assets.original_filename only; asset_id and every
-- chunk below are untouched.
--
-- Embedding dimension: 1536 (OpenAI text-embedding-3-small and many
-- 1536-dim open models). To switch models/dimensions, replace the column:
--   ALTER TABLE storage.asset_chunks DROP COLUMN embedding;
--   ALTER TABLE storage.asset_chunks ADD  COLUMN embedding vector(<n>);
-- then rebuild asset_chunks_embedding_hnsw.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS storage.asset_chunks (
    chunk_id         uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id         uuid NOT NULL,
    asset_version_id uuid NOT NULL,
    tenant_id        uuid NOT NULL,
    chunk_index      integer NOT NULL,
    content          text NOT NULL,
    content_hash     character(64),
    token_count      integer,
    embedding        vector(1536),
    embedding_model  text,
    lang             text,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT asset_chunks_pkey PRIMARY KEY (chunk_id),
    CONSTRAINT asset_chunks_version_fkey FOREIGN KEY (asset_version_id, asset_id, tenant_id)
        REFERENCES storage.asset_versions (asset_version_id, asset_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT asset_chunks_index_uq UNIQUE (asset_version_id, chunk_index),
    CONSTRAINT asset_chunks_index_nonnegative CHECK (chunk_index >= 0),
    CONSTRAINT asset_chunks_token_count_nonnegative CHECK (token_count IS NULL OR token_count >= 0),
    CONSTRAINT asset_chunks_content_not_empty CHECK (length(btrim(content)) > 0),
    CONSTRAINT asset_chunks_content_hash_format CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT asset_chunks_embedded_needs_model CHECK (embedding IS NULL OR embedding_model IS NOT NULL)
);
COMMENT ON TABLE storage.asset_chunks IS
  'Text chunks + embeddings for RAG. Keyed by asset version; references asset identity, never filename (Phase 10).';
COMMENT ON COLUMN storage.asset_chunks.asset_version_id IS 'The exact asset version this chunk was extracted from.';
COMMENT ON COLUMN storage.asset_chunks.embedding IS 'pgvector embedding; dimension 1536 by default. See migration header to change.';
COMMENT ON COLUMN storage.asset_chunks.content_hash IS 'SHA-256 of content, for chunk-level dedupe across versions.';

CREATE INDEX IF NOT EXISTS asset_chunks_asset_idx        ON storage.asset_chunks (asset_id);
CREATE INDEX IF NOT EXISTS asset_chunks_tenant_idx       ON storage.asset_chunks (tenant_id);
CREATE INDEX IF NOT EXISTS asset_chunks_content_hash_idx ON storage.asset_chunks (content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS asset_chunks_metadata_gin_idx ON storage.asset_chunks USING gin (metadata);

-- Approximate-nearest-neighbour index (cosine). Safe to build now (empty table).
CREATE INDEX IF NOT EXISTS asset_chunks_embedding_hnsw
    ON storage.asset_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- storage.v_asset_chunk_search - convenience join for retrieval
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW storage.v_asset_chunk_search AS
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
FROM storage.asset_chunks c
JOIN storage.assets         a  ON a.asset_id  = c.asset_id  AND a.tenant_id = c.tenant_id
JOIN storage.asset_versions av ON av.asset_version_id = c.asset_version_id
WHERE a.deleted_at IS NULL;
COMMENT ON VIEW storage.v_asset_chunk_search IS
  'Chunks joined to live asset metadata for RAG retrieval. Filter by tenant_id and order by embedding <=> query.';
