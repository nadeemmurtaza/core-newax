# ADR 0035: Activate a Storage Module for the RustFS-Backed Storage Component

- Status: Proposed
- Date: 2026-09-11
- Owners: NEWAX Engineering (proposed by the `rustfs-admin` project)

## 1. Context

ADR-0032 activated `@newax/files` as a Tenant-safe metadata registry for binary
content and was explicit that it is metadata-only: it does not upload, download,
version, or delete anything, and closed with *"Storage registration remains an
internal service contract until a trusted storage component exists."*

That component now exists outside this repository, in the `rustfs-admin`
project: a PostgreSQL `storage` schema (`assets`, `asset_versions`,
`asset_events`, `asset_processing_jobs`, `asset_chunks`) plus ten n8n
`STORAGE_*` sub-workflows that perform the actual byte-level work against
RustFS (register / upload / download / head / copy / list / soft-delete /
enqueue-processing / expire-temp / generate-url), live-verified end-to-end
against a running RustFS instance. Its `assets` table already carries
`tenant_id` and a nullable `organization_id` with no local foreign key —
placeholders left for this repository's identifiers, anticipating this
integration.

Both `core_files` (ADR-0032) and `storage.assets` independently key on
`(storage_provider, storage_key)` / `(bucket, object_key)` for the same
underlying RustFS object. Without a defined contract, this becomes two
uncoordinated file registries pointing at the same bytes.

## 2. Decision

Activate a `@newax/storage` platform-service module, peer to `files`, that
owns the `storage.*` tables and the binary-transfer/versioning/lifecycle
operations ADR-0032 deliberately deferred. `files` remains the Tenant-safe,
permission-gated *discovery* record every other module is allowed to see;
`storage` remains the richer *operational* record (versions, soft-delete,
processing pipeline, RAG chunks) that stays internal to storage-aware callers.

The slice proposes:

1. `storage.assets` gains `core_file_id` (already added on the `rustfs-admin`
   side, migration `0009_core_file_link`, nullable, no FK yet).
2. `@newax/files` gains one new internal operation, `files.register`, callable
   by a trusted internal caller (the n8n `STORAGE_REGISTER` workflow) — not a
   new public HTTP endpoint. It performs exactly the `files.register`
   operation ADR-0032 already designed, just invoked from a service caller
   instead of an interactive Organization context.
3. `@newax/files` gains a corresponding `files.markInactive`-style operation
   so `STORAGE_SOFT_DELETE` can flag the linked `core_files` row — ADR-0032
   explicitly excluded delete/lifecycle operations from the first release;
   this proposes the minimum needed for the two systems to stay consistent,
   not a general File lifecycle API.
4. `storage` is added to `registry/module-registry.json` with
   `module_status: planned` — concept tracked, not yet implemented or
   deployed, per the registry's own definition of that status.

No `core-newax` database migration is required for this slice: `core_files`
already has every column `storage.assets.core_file_id` needs to reference.

## 3. Integration contract

- `storage.assets` is the source of truth for object identity, versions, and
  lifecycle. `core_files` is the source of truth for what other Tenant/
  Organization-scoped NEWAX modules are allowed to discover about a stored
  object.
- The link is one `core_files` row per `storage.assets` row, written once at
  registration time and never mutated afterward (mirrors the immutability
  rule already enforced on `storage.assets.storage_provider` by its own
  `guard_asset_immutable_columns` trigger).
- `storage` calls into `files`, never the reverse. `files` does not gain a
  dependency on `storage` or on RustFS.
- Provider, storage key, checksum, and creator identity stay exactly as
  internal as ADR-0032 already specified — this proposal does not loosen that.

## 4. Physical database placement

`storage.*` currently lives inside a separate Postgres instance (the `n8n`
database, schema `storage` — colocated with n8n's own engine tables
opportunistically, not by design). This ADR does not propose moving it yet.
A follow-up ADR will propose colocating `storage` as a sibling schema in this
repository's own Postgres instance, which would let `storage.assets.core_file_id
→ core_files.id` become a real foreign key instead of an API-validated soft
link. Until then, referential integrity between the two tables is enforced at
the service boundary (`files.register`'s return value), not the database.

## 5. Security and privacy

- `files.register` and `files.markInactive` require the same trusted-context
  Tenant/Organization/actor validation ADR-0032 already specified for
  interactive registration — a service caller does not bypass it, it supplies
  a system actor instead of a User actor.
- No RustFS credentials, endpoints, or bucket names cross into `core-newax`.
  The n8n workflows hold those; `core-newax` only ever sees
  `storage_provider = 'rustfs'` and an opaque `storage_key`, exactly as
  ADR-0032 already scoped.
- `storage`'s own tenant isolation, immutability guards, and soft-delete
  semantics are unchanged by this proposal — see `rustfs-admin`'s
  `docs/DATABASE_HARDENING.md`.

## 6. Consequences

### Positive

- Closes the gap ADR-0032 explicitly left open, using a component that
  already exists and is live-verified rather than building storage
  orchestration inside `core-newax`.
- Every object `rustfs-admin` writes becomes discoverable through the same
  `core_files` boundary other modules already use, with no duplicate
  metadata store.
- Keeps `files`'s existing boundary (metadata-only, no provider adapters)
  intact — `storage` absorbs the binary-transfer complexity instead.

### Negative

- Introduces a cross-repository runtime dependency: `STORAGE_REGISTER` /
  `STORAGE_SOFT_DELETE` now call into `core-newax`'s API and must handle its
  unavailability (this ADR does not yet specify retry/outbox behavior — see
  deferred decisions).
- `core_file_id` has no database-level FK until physical colocation, so a
  `core_files` row could theoretically be deleted out from under a
  `storage.assets` reference; `core_files` has no delete path today, which
  limits but does not eliminate this risk.

## 7. Deferred decisions

- HTTP exposure of `files.register`/`files.markInactive` (service-to-service
  only for now — auth mechanism between `rustfs-admin`'s n8n workflows and
  this repo's API is not yet specified).
- The follow-up ADR proposing physical colocation of the `storage` schema
  into this repository's Postgres instance and a real foreign key.
- Final `storage.*` permission names and the full `@newax/storage` module
  surface beyond the `files` integration described here (upload/download/
  copy/list/generate-url already exist as n8n workflows; this ADR does not
  redesign them, only wires registration/deletion into the Central Registry).
- Outbox/retry behavior if `core-newax`'s API is unavailable when
  `STORAGE_REGISTER` runs.

## 8. Related decisions

- ADR-0007: Define LMS Centralized Database and Data Ownership Rules.
- ADR-0008: Use the Central Identity and Organization Registry.
- ADR-0011: Define Technology Stack and Implementation Baseline.
- ADR-0032: Build the File Metadata Registry Foundation.
- ADR-0034: Build the External References Governance Foundation.

## 9. Approval

This decision proposes activating a `storage` module and the minimum
`files` extension needed to integrate it with the Central Registry. It does
not authorize merging any implementation — it establishes the contract for a
review to evaluate before `@newax/storage` or the `files.register`/
`files.markInactive` operations are built.
