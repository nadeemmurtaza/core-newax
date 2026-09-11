-- 0009_core_file_link  (Phase 1 of core-newax federation)
--
-- Links each asset to its tenant-safe discovery record in core-newax's
-- central registry (table `core_files`, activated by core-newax ADR-0032).
-- storage.assets stays the operational record (versions, soft-delete,
-- processing, RAG chunks); core_files stays the permission-gated record
-- other NEWAX modules are allowed to see. The two are joined 1:1 here.
--
-- core_file_id is populated out-of-band by the STORAGE_REGISTER workflow
-- after it calls core-newax's files.register API — it is not set at INSERT
-- time, so no NOT NULL / trigger requirement is added. There is deliberately
-- no FK: core_files lives in a different physical database today (see
-- docs/STATUS.md and the federation plan). Add a real FK once storage's
-- schema is colocated with core-newax's database (Phase 2).

ALTER TABLE storage.assets
    ADD COLUMN IF NOT EXISTS core_file_id uuid;

COMMENT ON COLUMN storage.assets.core_file_id IS
  'core-newax core_files.id for this asset''s tenant-safe discovery record (ADR-0032). Set by STORAGE_REGISTER after a successful files.register call; NULL until then and for assets registered before this integration existed. No local FK: core_files lives in a separate database until Phase 2 colocation.';

CREATE INDEX IF NOT EXISTS assets_core_file_id_idx
    ON storage.assets (core_file_id)
    WHERE core_file_id IS NOT NULL;
