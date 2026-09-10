# Database hardening (Phase 2)

State of the `storage` schema after migration `0008`.

## Applied

### Integrity guards (triggers)

| Trigger | Table | Rule |
|---|---|---|
| `assets_guard_immutable` | `assets` | `asset_id`, `tenant_id`, `created_at`, `storage_provider` can never change. `bucket` / `object_key` freeze once `storage_status` leaves `pending`/`uploading`. |
| `asset_versions_guard_immutable` | `asset_versions` | A version row is a point-in-time snapshot: only `is_current` and `deleted_at` may change after insert. |

These sit alongside the existing lifecycle triggers (`validate_asset_status_transition`,
`validate_asset_version_lifecycle`, `prevent_asset_row_delete`,
`prevent_asset_event_mutation`, `validate_asset_processing_transition`, the
object-key validators).

### Function safety

Every `storage.*` function (21) has `search_path` pinned to `pg_catalog, storage`
via `ALTER FUNCTION ... SET search_path`. Removes search-path-injection risk if a
function is ever marked `SECURITY DEFINER` or called from an untrusted session.

### Constraints added

| Constraint | Table | Effect |
|---|---|---|
| `assets_file_extension_shape` | `assets` | lowercase, no dot, `[a-z0-9.]`, ≤ 20 chars |
| `assets_mime_type_shape` | `assets` | `type/subtype`, lowercase, RFC token chars |
| `asset_versions_mime_type_shape` | `asset_versions` | same |
| `asset_processing_jobs_time_order` | `asset_processing_jobs` | `started_at ≥ created_at`, `finished_at ≥ started_at` |

All target columns are nullable; existing rows were unaffected.

### Index

`asset_processing_jobs_version_idx` on `(asset_version_id) WHERE asset_version_id IS NOT NULL`
— supports the composite FK to `asset_versions` (the other FKs were already
covered by leading-column indexes).

### Least-privilege role scaffold

| Role | Grant | Session limits |
|---|---|---|
| `storage_reader` (NOLOGIN) | `USAGE` on schema, `SELECT` on all tables/views | `statement_timeout=60s` |
| `storage_writer` (NOLOGIN) | `USAGE`, `SELECT/INSERT/UPDATE` on all tables, `EXECUTE` on all functions. **No `DELETE`, no DDL.** | `statement_timeout=30s`, `idle_in_transaction_session_timeout=60s` |

- `REVOKE ALL ON SCHEMA storage FROM PUBLIC` + `REVOKE ALL ON ALL TABLES/FUNCTIONS ... FROM PUBLIC`.
- `ALTER DEFAULT PRIVILEGES FOR ROLE n8n IN SCHEMA storage` — future tables/functions
  inherit the same grants automatically.
- Both roles are granted to `n8n` so **nothing changes for the current app**.

## Verification

- `db/migrate.sh verify` → `8 ok, 0 drift, 0 missing`
- `db/tests/smoke.sql` → passes; covers 8 negative cases incl. the new
  immutability and mime-shape guards
- `db/schema.sql` — canonical schema snapshot, committed as a diff aid

## Deferred to Phase 10 (production security hardening)

- **Row-Level Security.** `n8n` is a superuser and owns the schema, so RLS is not
  enforceable through the current connection. Phase 10:
  1. create a login role `storage_app` — `NOSUPERUSER NOBYPASSRLS`, member of
     `storage_writer` only;
  2. point a dedicated n8n Postgres credential at it;
  3. `ALTER TABLE storage.<t> ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;`
  4. policy per table: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`,
     set via `SET LOCAL app.tenant_id` at the start of each workflow transaction.
- Scoped RustFS credential (separate from the root key).
- `pg_stat_statements` / slow-query logging at the server level.
