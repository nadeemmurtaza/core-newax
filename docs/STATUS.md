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
- **Migrations** — `0001`–`0008` applied, `db/migrate.sh verify` → `8 ok, 0 drift,
  0 missing`; `db/tests/smoke.sql` passes (8 negative cases).

Still open: the four items under "What needs a decision from you" below.

## Delivery framework (12-phase view)

| # | Phase | Status |
|---|---|---|
| 1 | Storage foundation | ✅ complete |
| 2 | **Database hardening** | ✅ **complete** — `0008`: immutability guards, `search_path` pinned on all 21 functions, format CHECKs, FK index, least-privilege role scaffold (`storage_reader`/`storage_writer`), `db/schema.sql` snapshot, extended smoke test. RLS deferred to Phase 10 (needs a non-superuser credential — see `docs/DATABASE_HARDENING.md`). |
| 3 | **Storage service layer** | ✅ **built** — all **10** `STORAGE_*` sub-workflows imported with stable ids (idempotent re-import): register / soft-delete / enqueue-processing / expire-temp / upload / download / head / copy / list / generate-url. Structurally verified against the installed S3 node schema; underlying SQL covered by the smoke test. **Not yet run live** (no CLI exec against a running instance; `S3 account` credential is a UI check) and none activated — that's Phase 11. See `docs/STORAGE_SERVICE_LAYER.md`. |
| 4 | Asset lifecycle | 🟡 DB machinery complete; not wired end-to-end |
| 5 | Processing pipeline | 🟡 tables + state machine + helpers; no worker workflow |
| 6 | Events / jobs | 🟡 event log + job queue; no routing/consumers |
| 7 | RAG / knowledge integration | 🟡 schema + retrieval view; no ingestion/embeddings |
| 8 | Backup / disaster recovery | 🟡 script ready; no offsite, not scheduled, no drill |
| 9 | Observability | 🟡 12 views; no dashboard/alerts |
| 10 | Security / production hardening | 🔴 root RustFS key everywhere; RLS pending |
| 11 | n8n integration | 🟡 imported inactive; credentials unverified in UI |
| 12 | Production validation | 🔴 not started |

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
| 9 – Storage service layer | ✅ built, not wired | All **10** `STORAGE_*` sub-workflows imported (stable ids, idempotent). Wrappers upload/download/head/copy/list built; `STORAGE_GENERATE_URL` presign built (Code-node SigV4, caveat documented). Still needs: `S3 account` credential UI check, a live test run, activation of `STORAGE_EXPIRE_TEMP` — see `docs/STORAGE_SERVICE_LAYER.md`. |
| 10 – AI / RAG integration | ✅ schema done | `0005` — `storage.asset_chunks` `vector(1536)` + HNSW + `v_asset_chunk_search`. Embedding **model/provider is your call** (default sized for 1536-dim). |
| 11 – Backup architecture | 🟡 local done, offsite pending | `scripts/backup-postgres.sh` dumps + stages to `newax-backups`. **Offsite target + credentials are yours to provide** (`BACKUP_OFFSITE_*` in `scripts/backup.env`). Not yet scheduled (add host cron or an n8n schedule). |
| 12 – Storage observability | ✅ views done | `0006` — 12 `storage.v_*` views incl. `v_storage_overview`. Dashboard UI / alerting not built (consume the views from Grafana/Metabase/n8n). |

## Stages

| Stage | Status |
|---|---|
| A – schema (`assets`, `asset_versions`, `asset_events`) | ✅ + hardened (`0002`–`0008`) |
| B – n8n storage service | ✅ 10 workflows built + imported; needs credential UI check, live test, activation |
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
3. **n8n RustFS credential + go-live** — all 10 `STORAGE_*` workflows are built
   and imported. What remains (Phase 11): open **n8n → Credentials → "S3 account"**
   (`id UOBSnxPxyEhgyZQH`), set endpoint `http://rustfs:9000` / region `us-east-1`
   / Force Path Style = on, **Test**. Then run the manual verification in
   `docs/STORAGE_SERVICE_LAYER.md` and activate `STORAGE_EXPIRE_TEMP`.
4. **Dedicated storage credential** (Phase 9 hardening) — today everything uses
   the RustFS root key. Create a scoped service key for n8n when RustFS policy
   support is in place.

## Applied migrations

`0001` baseline (adopted) · `0002` object-key standard · `0003` temp lifecycle ·
`0004` processing pipeline · `0005` RAG chunks · `0006` observability views ·
`0007` data hygiene (fixture row tagged) · `0008` database hardening.

Smoke test: `db/tests/smoke.sql` — passes (key validation, temp expiry, mime /
immutability guards, pipeline state machine, chunk insert, soft-delete; 8 negative
cases). Schema snapshot: `db/schema.sql`. Hardening detail: `docs/DATABASE_HARDENING.md`.
