# Storage service layer (Phase 3)

Reusable n8n sub-workflows so no other workflow implements storage logic itself.
All are **imported inactive** and pinned to stable ids so `n8n import:workflow`
is idempotent.

```
domain workflow
      │  Execute Sub-workflow
      ▼
┌──────────────────────────────────────────────┐
│  STORAGE_*  (n8n sub-workflows)               │
│                                              │
│  registry ops ──▶ Postgres  "Postgres account"│
│  object ops   ──▶ S3        "S3 account" ─▶ RustFS
└──────────────────────────────────────────────┘
```

## Workflows

| Workflow | id | Nodes | Trigger | Purpose |
|---|---|---|---|---|
| `STORAGE_REGISTER_ASSET` | `KOxEt2mThIw34cUt` | 2 | sub-wf | Insert `storage.assets` + `asset.created` event (1 txn). Returns `asset_id,bucket,object_key`. |
| `STORAGE_SOFT_DELETE` | `i1nfH17GxFiadcgj` | 4 | sub-wf | `mark_asset_deleted()`; deletes the RustFS object too if `bucket`+`object_key` passed and the row changed. |
| `STORAGE_ENQUEUE_PROCESSING` | `88j66T6FND79RDVr` | 2 | sub-wf | `enqueue_processing()`. Returns `processing_job_id` (idempotent per live pipeline). |
| `STORAGE_EXPIRE_TEMP` | `OEFZqShJLrxi8oR2` | 4 | schedule 15 min | `find_expired_temp_assets(500)` → delete object → `mark_asset_deleted()`. **Activate to enable temp GC.** |
| `STORAGE_UPLOAD` | `PF75nXNtMIUpPszc` | 3 | sub-wf | S3 `upload` (binary property `data` by default) → shapes result for `STORAGE_REGISTER_ASSET`. |
| `STORAGE_DOWNLOAD` | `CfY9EAOBs7ev3bHN` | 2 | sub-wf | S3 `download` → binary on property `data`. |
| `STORAGE_HEAD` | `dgkOcol63jJQXgxv` | 2 | sub-wf | S3 `getAll` with exact key, limit 1 (no native HEAD). Empty result ⇒ missing. |
| `STORAGE_COPY` | `iAGSg4h2Ov9uvB8T` | 2 | sub-wf | S3 `copy` `/src-bucket/key` → `/dst-bucket/key`. Bytes only. |
| `STORAGE_LIST` | `pFruLXj0QwDApPUx` | 2 | sub-wf | S3 `getAll` by `prefix` (`return_all`/`limit` inputs). |
| `STORAGE_GENERATE_URL` | `IMUaE956JxsGv7x3` | 2 | sub-wf | SigV4 presigned URL via a Code node. **See caveat below.** |

### Inputs (Execute Sub-workflow item JSON)

- **REGISTER_ASSET**: `tenant_id, bucket, object_key` (+ `organization_id,
  original_filename, display_name, mime_type, file_extension, file_size_bytes,
  checksum_sha256, source_type, source_id, storage_status, expires_at, metadata,
  actor_id`)
- **SOFT_DELETE**: `asset_id, tenant_id` (+ `bucket, object_key` to also drop
  bytes; `source, actor_id, reason`)
- **ENQUEUE_PROCESSING**: `asset_id, tenant_id, pipeline` (+ `asset_version_id,
  priority, metadata`)
- **UPLOAD**: `bucket, object_key, tenant_id`, binary on `data` (or set
  `binary_property`)
- **DOWNLOAD / HEAD**: `bucket, object_key`
- **COPY**: `source_bucket, source_key, dest_bucket, dest_key`
- **LIST**: `bucket` (+ `prefix, limit, return_all`)
- **GENERATE_URL**: `bucket, object_key, method` (+ `expires_seconds, endpoint,
  region, access_key_id, secret_access_key`)

Build keys with `storage.build_object_key(...)` before calling REGISTER/UPLOAD.

## Credentials

| n8n credential | id | Points at |
|---|---|---|
| `Postgres account` | `l0gPR9XCXO2YXsc6` | the `n8n` database — already used by n8n, known good |
| `S3 account` | `UOBSnxPxyEhgyZQH` | **must be**: endpoint `http://rustfs:9000`, region `us-east-1`, Force Path Style = **on**. Verify in **n8n → Credentials**. |

The RustFS root key + endpoint are proven working from the host
(`scripts/rustfs-enable-versioning.sh`, S3 round-trip). Only the n8n-side
credential record is unverified — it's a UI check.

## STORAGE_GENERATE_URL caveat

The generic S3 node has no presign operation, so this workflow signs the URL in a
**Code node**. It needs **one** of:

- the Code-node sandbox exposing global WebCrypto (`crypto.subtle`), or
- `NODE_FUNCTION_ALLOW_BUILTIN=crypto` in the n8n container env.

It also takes the RustFS secret as workflow input, which is a foot-gun.
**Preferred:** generate presigned URLs in the service that already holds the key,
and pass them into n8n. Treat this workflow as a fallback; test it once before
relying on it.

## Manual verification (needs the S3 credential confirmed)

1. **S3 credential** — n8n → Credentials → "S3 account" → set endpoint / region /
   Force Path Style, **Test**.
2. **REGISTER_ASSET** — Execute Sub-workflow from a scratch workflow with
   `{ tenant_id: <uuid>, bucket: "newax-documents", object_key:
   storage.build_object_key(...) }`. Expect `asset_id` back; check
   `storage.asset_events` has `asset.created`.
3. **UPLOAD → REGISTER_ASSET** — pass a small binary; confirm the object in
   RustFS (`STORAGE_HEAD`) and the registry row.
4. **EXPIRE_TEMP** — insert a temp asset with `expires_at = now() - interval '1m'`
   and a real object; run the workflow; confirm object gone + row
   `storage_status = 'deleted'` + `asset.deleted` event. Then **activate** it.
5. **SOFT_DELETE** — on the asset from step 2 with `bucket`+`object_key`; confirm
   object gone, row `deleted`, `asset.deleted` event.

## Deferred to Phase 11 (n8n integration)

- Activating the schedule workflow(s) after the live test.
- Wiring domain workflows to call these via Execute Sub-workflow.
- A dedicated non-root RustFS credential (Phase 10).
