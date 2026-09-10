# n8n storage service layer

Reusable sub-workflows so the platform's other workflows never implement storage
logic themselves. All **10** are imported **inactive** with stable ids.

Full reference: `docs/STORAGE_SERVICE_LAYER.md`.

## Import (idempotent — updates in place by id)

```bash
docker cp n8n/workflows/. n8n:/tmp/sw/
docker exec n8n n8n import:workflow --separate --input=/tmp/sw
docker exec n8n rm -rf /tmp/sw
```

## Credentials used

| Credential | n8n id | Must point at |
|---|---|---|
| `Postgres account` | `l0gPR9XCXO2YXsc6` | the `n8n` database (host `postgres`) — already used by n8n |
| `S3 account` | `UOBSnxPxyEhgyZQH` | `http://rustfs:9000`, region `us-east-1`, **Force Path Style = on** |

The RustFS endpoint + root key are verified working from the host. Only the
n8n-side `S3 account` record needs a UI check (**n8n → Credentials → Test**).

## Workflows

| Workflow | id | Trigger | Does |
|---|---|---|---|
| `STORAGE_REGISTER_ASSET` | `KOxEt2mThIw34cUt` | sub-wf | Insert `storage.assets` + `asset.created` (1 txn) → `asset_id`. |
| `STORAGE_SOFT_DELETE` | `i1nfH17GxFiadcgj` | sub-wf | `mark_asset_deleted()` + optional RustFS object delete. |
| `STORAGE_ENQUEUE_PROCESSING` | `88j66T6FND79RDVr` | sub-wf | `enqueue_processing()` → `processing_job_id`. |
| `STORAGE_EXPIRE_TEMP` | `OEFZqShJLrxi8oR2` | schedule 15 min | Temp GC. **Activate after test.** |
| `STORAGE_UPLOAD` | `PF75nXNtMIUpPszc` | sub-wf | S3 upload (binary `data`) → shape for REGISTER_ASSET. |
| `STORAGE_DOWNLOAD` | `CfY9EAOBs7ev3bHN` | sub-wf | S3 download → binary `data`. |
| `STORAGE_HEAD` | `dgkOcol63jJQXgxv` | sub-wf | Exact-key list, limit 1 (no native HEAD op). |
| `STORAGE_COPY` | `iAGSg4h2Ov9uvB8T` | sub-wf | S3 copy `/src/key` → `/dst/key`. |
| `STORAGE_LIST` | `pFruLXj0QwDApPUx` | sub-wf | S3 list by prefix. |
| `STORAGE_GENERATE_URL` | `IMUaE956JxsGv7x3` | sub-wf | SigV4 presign (Code node — see caveat in the reference doc). |

Call the sub-wf ones with the **Execute Sub-workflow** node. Inputs: see
`docs/STORAGE_SERVICE_LAYER.md`.

## After wiring

1. n8n → Credentials → "S3 account" → set endpoint / region / Force Path Style → **Test**.
2. Run `STORAGE_REGISTER_ASSET`, then `STORAGE_UPLOAD`, from a scratch workflow
   with a throwaway tenant uuid. Check `storage.v_storage_overview` /
   `storage.asset_events`.
3. Test `STORAGE_EXPIRE_TEMP` against a seeded expired temp row, then **activate** it.

Full step-by-step: `docs/STORAGE_SERVICE_LAYER.md` → "Manual verification".
