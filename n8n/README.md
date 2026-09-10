# n8n storage service layer

Reusable sub-workflows so the platform's other workflows never implement storage
logic themselves. They are imported **inactive** — wire credentials, test once,
then activate.

## Import

```bash
docker cp n8n/workflows/. n8n:/tmp/sw/
docker exec n8n n8n import:workflow --separate --input=/tmp/sw
docker exec n8n rm -rf /tmp/sw
```

(Re-importing updates the workflows in place by id.)

## Credentials used

| Credential | n8n id | Must point at |
|---|---|---|
| `Postgres account` | `l0gPR9XCXO2YXsc6` | the `n8n` database (host `postgres`) |
| `S3 account` | `UOBSnxPxyEhgyZQH` | `http://rustfs:9000`, **path-style**, region `us-east-1`, force path style = on |

Confirm both in **n8n → Credentials** before activating anything.

## Workflows

| Workflow | Trigger | Input (JSON) | Does |
|---|---|---|---|
| `STORAGE_REGISTER_ASSET` | Execute Workflow | `tenant_id, bucket, object_key` (+ `organization_id, mime_type, file_size_bytes, checksum_sha256, original_filename, display_name, file_extension, source_type, source_id, storage_status, expires_at, metadata, actor_id`) | Inserts `storage.assets` + `asset.created` event in one transaction; returns `asset_id, bucket, object_key`. |
| `STORAGE_SOFT_DELETE` | Execute Workflow | `asset_id, tenant_id` (+ `bucket, object_key` to also delete bytes; `source, actor_id, reason`) | `storage.mark_asset_deleted(...)`; if `bucket`+`object_key` given and the row changed, deletes the RustFS object. |
| `STORAGE_ENQUEUE_PROCESSING` | Execute Workflow | `asset_id, tenant_id, pipeline` (+ `asset_version_id, priority, metadata`) | `storage.enqueue_processing(...)`; returns `processing_job_id` (idempotent per live pipeline). |
| `STORAGE_EXPIRE_TEMP` | Schedule (15 min) | — | `find_expired_temp_assets(500)` → delete each RustFS object → `mark_asset_deleted(...)`. Activate to enable temp GC. |

Call the Execute-Workflow ones from any workflow with the **Execute Sub-workflow**
node, passing the input JSON.

## Not built — thin passthrough wrappers

These are a single **S3 node** each; add them if you want a uniform interface:

| Wrapper | S3 node op |
|---|---|
| `STORAGE_UPLOAD` | File → Upload (then call `STORAGE_REGISTER_ASSET`) |
| `STORAGE_DOWNLOAD` | File → Download |
| `STORAGE_HEAD` | File → Get (metadata) |
| `STORAGE_COPY` | File → Copy |
| `STORAGE_LIST` | File → Get Many (prefix) |

### Presigned URLs

The generic **S3 node has no presign operation**. To issue presigned URLs from
n8n: create an **AWS** credential (not the generic `s3` type) with the RustFS
endpoint override, then use an **HTTP Request** node with *Predefined Credential
Type → AWS* — it SigV4-signs the request. Or generate presigned URLs in the
service that already holds the key and pass them into n8n.

## After wiring

1. Open each workflow, run it once with a real payload (a throwaway tenant row).
2. Check `storage.asset_events` / `storage.v_storage_overview`.
3. Activate `STORAGE_EXPIRE_TEMP` (and any others you trigger by schedule).
