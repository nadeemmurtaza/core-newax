# NEWAX permanent storage architecture

```
                        NEWAX PLATFORM
                              │
                              ▼
                       ┌──────────────┐
                       │     n8n      │  storage-service workflows
                       │ Orchestrator │  (n8n/workflows/*)
                       └──────┬───────┘
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        ┌────────────────┐        ┌────────────────┐
        │  PostgreSQL    │        │    RustFS      │
        │ storage schema │        │ Object Storage │
        │  (source of    │        │  (source of    │
        │   truth: ID)   │        │  truth: bytes) │
        └───────┬────────┘        └───────┬────────┘
                └──────────┬──────────────┘
                           ▼
                    asset_id / asset_version_id
```

## PostgreSQL `storage` schema

| Object | Purpose | Migration |
|---|---|---|
| `assets` | Canonical asset registry: identity, tenancy, bucket/key, checksum, status, `expires_at`, metadata | 0001 / 0003 |
| `asset_versions` | Per-asset version history, `is_current`, native `version_id` | 0001 |
| `asset_events` | Immutable lifecycle event log (10 event types) | 0001 |
| `asset_processing_jobs` | Phase-7 pipeline: `queued→validating→scanning→extracting→chunking→embedding→indexing→ready` (`failed`/`cancelled` terminal) | 0004 |
| `asset_chunks` | Phase-10 RAG: text chunks + `vector(1536)` embeddings, HNSW index, keyed by asset version | 0005 |
| `schema_migrations` | Applied-migration ledger (`db/migrate.sh verify` re-checks recorded checksums against disk, read-only) | migrate.sh |
| `v_*` (12 views) | Phase-12 observability: bucket usage, growth, duplicates, temp expiry, processing backlog, event activity, one-row overview | 0006 |

### Key functions

| Function | Use |
|---|---|
| `build_object_key(domain, tenant, entity_type, entity_id, asset_id, variant)` | Canonical key builder |
| `bucket_for_domain(domain)` | domain → bucket |
| `assert_object_key_shape(key)` | Structural key validation |
| `find_expired_temp_assets(limit)` | Deletion batch for the temp-cleanup job |
| `mark_asset_deleted(asset_id, tenant_id, source, actor_id, reason)` | Soft-delete + archive versions + emit `asset.deleted` |
| `enqueue_processing(asset_id, tenant_id, pipeline, version_id, priority, metadata)` | Queue a pipeline run (idempotent per live pipeline) |
| `advance_processing(job_id, status, detail, progress)` | Step the state machine |
| `complete_processing(job_id, status, error)` | Terminate; emit `asset.processed` on `ready` |

## Lifecycle invariants (enforced by triggers)

* `storage.assets` — no physical `DELETE`; soft-delete only. Status transitions
  validated. Can't soft-delete while a current version exists.
* `storage.asset_versions` — exactly one `is_current` per asset; a deleted
  version can't be current; can't be current under a deleted asset.
* `storage.asset_events` — immutable (no `UPDATE`/`DELETE`).
* `storage.asset_processing_jobs` — forward-only state machine; retry accounting
  on `failed → queued` (bounded by `max_attempts`).
* `newax-temp` rows must carry `expires_at`.

## Buckets

| Bucket | Permanent | Versioning | Use |
|---|---|---|---|
| `newax-images` | yes | **Enabled** | generated / uploaded images |
| `newax-videos` | yes | **Enabled** | video assets |
| `newax-documents` | yes | **Enabled** | PDFs, DOCX, sheets, source docs |
| `newax-temp` | no | disabled | transient processing objects (auto-expire) |
| `newax-backups` | yes | **Enabled** | DB dumps & recovery artifacts |

Do **not** create buckets per tenant/customer/campaign/workflow. Use key prefixes.

## RAG integration

RAG / knowledge records reference `(tenant_id, asset_id, asset_version_id,
chunk_id)`. Renaming a file touches only `original_filename`. Retrieval:

```sql
SELECT chunk_id, content, object_key, original_filename
FROM storage.v_asset_chunk_search
WHERE tenant_id = $1
ORDER BY embedding <=> $2::vector      -- $2 = query embedding
LIMIT 8;
```

## Backup / DR

`scripts/backup-postgres.sh`: `pg_dump` (custom format) + `storage`-schema plain
dump → `newax-backups` → **optional** offsite S3 (`BACKUP_OFFSITE_*`).

`newax-backups` lives on the same VPS / same disk image as the primary. That is
**not** disaster recovery. Configuring an offsite target is the remaining step —
see `docs/STATUS.md`.
