# Storage build status

Updated 2026-09-11.

## Verified live on this VPS (2026-09-11)

- **Buckets** — all 5 exist (`aws s3 ls` via the RustFS root key).
- **Versioning** — `Enabled` on `newax-images` `newax-videos` `newax-documents`
  `newax-backups`; `Disabled` on `newax-temp` (target state). A double PUT on
  `newax-images` returned two distinct `VersionId`s.
- **`scripts/rustfs.env`** — created (gitignored, mode 600) with the root
  credentials from the `rustfs` container and `RUSTFS_ENDPOINT=http://10.0.5.5:9000`.
- **S3 round-trip** — put / get / list-versions / delete against RustFS all pass.
- **Migrations** — `0001`–`0007` applied, `db/migrate.sh verify` → `7 ok, 0 drift,
  0 missing`; `db/tests/smoke.sql` passes.

Still open: the four items under "What needs a decision from you" below.

## Phase completion

| Phase | Status | Notes |
|---|---|---|
| 1 – Storage contract (5 buckets) | ✅ done | Buckets exist; whitelist enforced as DB CHECK. Versioning confirmed on the 4 permanent buckets, off on `newax-temp`. |
| 2 – Asset registry (`storage.assets`) | ✅ done | Baseline `0001`. |
| 3 – Object versions (`storage.asset_versions`) | ✅ done | Baseline `0001`. |
| 4 – Object-key standard | ✅ done | `0002` — structural + asset-addressable enforcement, `build_object_key()`. See `OBJECT_KEY_STANDARD.md`. |
| 5 – Identity ≠ filename | ✅ done | Structural (`0001`) + reinforced by `0002`. |
| 6 – Asset event table (`storage.asset_events`) | ✅ done | Baseline `0001`; now emitted by `mark_asset_deleted` / `complete_processing` and the register workflow. |
| 7 – Processing pipeline | ✅ done | `0004` — `storage.asset_processing_jobs` + forward-only state machine + helpers. |
| 8 – Temp lifecycle | ✅ done | `0003` — `expires_at`, `find_expired_temp_assets()`, `mark_asset_deleted()`; `STORAGE_EXPIRE_TEMP` workflow (every 15 min). |
| 9 – Storage service layer | 🟡 imported, not wired | 4 workflows imported into n8n, **inactive**. Need credential check + a live test run + activation. Thin wrappers (upload/download/head/copy/list/presign) documented in `n8n/README.md`, not built. |
| 10 – AI / RAG integration | ✅ schema done | `0005` — `storage.asset_chunks` `vector(1536)` + HNSW + `v_asset_chunk_search`. Embedding **model/provider is your call** (default sized for 1536-dim). |
| 11 – Backup architecture | 🟡 local done, offsite pending | `scripts/backup-postgres.sh` dumps + stages to `newax-backups`. **Offsite target + credentials are yours to provide** (`BACKUP_OFFSITE_*` in `scripts/backup.env`). Not yet scheduled (add host cron or an n8n schedule). |
| 12 – Storage observability | ✅ views done | `0006` — 12 `storage.v_*` views incl. `v_storage_overview`. Dashboard UI / alerting not built (consume the views from Grafana/Metabase/n8n). |

## Stages

| Stage | Status |
|---|---|
| A – schema (`assets`, `asset_versions`, `asset_events`) | ✅ + hardened (`0002`–`0007`) |
| B – n8n storage service | 🟡 4 core workflows imported; needs wiring/activation + the passthrough wrappers |
| C – processing → RAG | 🟡 tables + state machine + `enqueue`/`advance`/`complete` ready; the actual extract/chunk/embed workflow is not built (needs embedding-provider decision) |
| D – external backup / DR | 🟡 script ready; offsite target + restore drill outstanding |
| E – metrics / alerts / auto-cleanup | 🟡 views + auto-cleanup workflow ready; alert thresholds + dashboard outstanding |

## What needs a decision from you

1. **Offsite backup target** — pick an S3-compatible provider off this VPS
   (Backblaze B2 / Wasabi / AWS S3 / …), create a bucket + key, put the values in
   `scripts/backup.env`. Then schedule `scripts/backup-postgres.sh` (cron or n8n).
2. **Embedding model** — `storage.asset_chunks.embedding` is `vector(1536)`
   (fits OpenAI `text-embedding-3-small` and many open 1536-dim models). If you'll
   use a different dimension, alter the column + rebuild `asset_chunks_embedding_hnsw`
   (recipe in `0005` header) before any rows exist.
3. **n8n RustFS credential** — the RustFS endpoint + root key are verified working
   (see the section above). What remains is a UI check: open **n8n → Credentials →
   "S3 account"** (`id UOBSnxPxyEhgyZQH`) and confirm endpoint `http://rustfs:9000`,
   Force Path Style = on, region `us-east-1`. Then run each `STORAGE_*` workflow
   once with a throwaway payload and activate them (`STORAGE_EXPIRE_TEMP` at least).
4. **Dedicated storage credential** (Phase 9 hardening) — today everything uses
   the RustFS root key. Create a scoped service key for n8n when RustFS policy
   support is in place.

## Applied migrations

`0001` baseline (adopted) · `0002` object-key standard · `0003` temp lifecycle ·
`0004` processing pipeline · `0005` RAG chunks · `0006` observability views ·
`0007` data hygiene (fixture row tagged).

Smoke test: `db/tests/smoke.sql` — passes (key validation, temp expiry, pipeline
state machine, chunk insert, soft-delete).
