# NEWAX object-key standard (Phase 4 + 5)

## Canonical layout

```
{domain}/{tenant_id}/{entity_type}/{entity_id}/{asset_id}/{variant}
```

Example:

```
documents/8f21c0e2-.../organization/org-0042/7d9c1b4a-.../original.pdf
images/8f21c0e2-.../carousel/carousel-0091/71ac.../slide-01.webp
videos/8f21c0e2-.../campaign/campaign-0034/1abc.../final.mp4
```

`temp/` objects are job-scoped rather than asset-scoped and are exempt from the
`asset_id`-segment rule:

```
temp/job/{job_id}/{asset_id}/input.bin
```

## Why

* **Predictable** — every object's location is derivable from its registry row.
* **Asset-addressable** — the `asset_id` is always in the path, so the bytes can
  be found from identity alone (Phase 5).
* **No landfill** — one bucket per *domain*, never per tenant/customer/campaign.
  Tenancy and grouping live in the key prefix.
* **Rename-safe** — the human filename lives in `storage.assets.original_filename`
  / `display_name`. The object key never moves when a file is renamed.

## Enforcement (migration `0002`)

`BEFORE INSERT OR UPDATE OF object_key` triggers on `storage.assets` and
`storage.asset_versions` call:

* `storage.assert_object_key_shape(text)` — structural rules:
  * lowercase, only `[a-z0-9._/-]`
  * no leading/trailing `/`, no `//`, no `.`/`..` segments
  * ≥ 3 path segments, ≤ 1024 chars
* on `storage.assets` only: the `asset_id` must appear as its own path segment
  unless `bucket = 'newax-temp'` or `metadata->>'key_layout' = 'legacy'`.

Existing rows are never re-validated (triggers fire only on insert / key change).

## Building keys

```sql
SELECT storage.build_object_key(
  'documents',                              -- domain
  '8f21c0e2-...'::uuid,                      -- tenant_id
  'organization', 'Org 0042',               -- entity_type, entity_id (slugified)
  '7d9c1b4a-...'::uuid,                      -- asset_id
  'original.pdf');                          -- variant
-- documents/8f21c0e2-.../organization/org-0042/7d9c1b4a-.../original.pdf

SELECT storage.bucket_for_domain('documents');   -- newax-documents
```

## Legacy / imported objects

Set `metadata.key_layout = 'legacy'` on the asset row to opt a pre-existing key
out of the `asset_id`-segment rule. Structural rules still apply.
