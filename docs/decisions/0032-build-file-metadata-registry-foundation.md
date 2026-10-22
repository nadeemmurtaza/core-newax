# ADR 0032: Build the File Metadata Registry Foundation

## Status

Accepted

## Date

2026-07-14

## Context

NEWAX Core already contains `core_files`, but table existence does not establish a safe reusable module.

A File record must identify binary content stored elsewhere without turning storage-provider credentials, object keys, or public URLs into a general-purpose API. It must also distinguish binary Files from business Documents, which have their own lifecycle, classification, and relationships.

The existing File table belonged to an Organization but did not carry the direct Tenant key used by the current customer-isolation architecture. Application checks alone could not prove at the database boundary that a File's Organization belonged to the same Tenant.

## Decision

NEWAX will activate a reusable `@newax/files` metadata-only foundation module with two initial operations:

- Register metadata for a durably stored object in the trusted current Organization through `files.register`.
- List active File metadata for the trusted current Organization through `files.view`.

Each File receives an immutable `tenant_id` in addition to `organization_id`.

The registration caller must already have stored the bytes and computed their exact size and SHA-256 checksum. This module records that result; it does not upload, download, inspect, or expose the object.

Storage provider, storage key, checksum, and creator identity remain internal repository metadata. Service records and events exclude them.

## Boundaries

The module owns `core_files`.

This decision does not activate:

- Binary upload or download.
- Provider-specific storage adapters or provider selection.
- Signed URLs or public access.
- Malware scanning, quarantine, content inspection, or thumbnails.
- Update, replacement, versioning, deletion, retention, restore, or purge workflows.
- Business Documents or Document-to-File relationships.
- HTTP endpoints.

Those capabilities require separately approved storage, lifecycle, privacy, and authority rules.

## Data migration

Existing File metadata inherits `tenant_id` from its Organization.

The migration stops when any File has no valid Organization from which ownership can be derived. After backfill, `tenant_id` becomes required and a composite foreign key proves that `tenant_id` and `organization_id` belong together.

No File, Organization, Tenant, or User record is deleted. Existing provider-and-storage-key uniqueness remains unchanged.

## Security and privacy

- Tenant and Organization identity comes from trusted context, never File input.
- Registration requires explicit `files.register`; listing requires `files.view`.
- The repository revalidates active Tenant, Organization, User, and Person state.
- Provider locators remain internal and never enter returned records, events, or structured logs.
- Storage keys are limited to 2,048 UTF-8 bytes so the composite provider-and-key value remains safely indexable by PostgreSQL.
- Filenames are treated as display metadata and cannot contain path separators.
- Checksums must use an explicit SHA-256 format.
- Pagination cursors must belong to the current Tenant and Organization.
- PostgreSQL enforces Tenant and Organization ownership independently of application checks.

## Code necessity and simplicity

- The existing Prisma File table is activated rather than replaced.
- PostgreSQL foreign keys provide isolation instead of relying on duplicated application-only checks.
- Prisma transactions and the existing NestJS composition pattern are reused.
- JavaScript and TypeScript built-ins provide normalization and validation.
- No new runtime or development dependency is introduced.
- Upload, download, URL, scanning, deletion, versioning, Document, and HTTP code is excluded because its governing contract does not yet exist.

## Consequences

Positive:

- Domain modules gain one Tenant-safe identifier for stored binary content.
- Storage locators remain separated from ordinary consumers.
- Duplicate physical locators are rejected under concurrency.
- Future storage and Document modules can build on an explicit metadata boundary.

Cost:

- Files now carry a direct Tenant key as well as an Organization key.
- Existing File rows require a controlled backfill.
- The module cannot yet transfer bytes or provide access to them.
- Storage registration remains an internal service contract until a trusted storage component exists.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0005: Use Event-Driven Module Communication.
- ADR 0008: Use the Central Identity and Organization Registry.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0027: Separate Tenant Ownership from Organizations.

## Approval

This decision is accepted as the baseline for Tenant-safe, provider-neutral File metadata registration and current-Organization listing in NEWAX Core.
