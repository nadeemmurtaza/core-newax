# Files Changelog

## 0.1.0 - 2026-07-14

### Added

- Trusted current-Organization File metadata registration protected by `files.register`.
- Bounded active File metadata listing protected by `files.view`.
- Minimal `file.registered` events without filenames, media types, sizes, storage locators, or checksums.
- PostgreSQL-backed repository composition and integration coverage.

### Database

- Adds immutable `tenant_id` ownership to `core_files`.
- Backfills existing File metadata from its Organization.
- Adds composite Tenant and Organization ownership enforcement.
- Preserves global provider-and-storage-key uniqueness.

### Security

- Tenant and Organization authority comes only from trusted context.
- Storage provider, storage key, checksum, and creator identity remain internal.
- Storage keys are capped at 2,048 UTF-8 bytes to stay within PostgreSQL B-tree index limits.
- Filenames cannot contain paths, checksums must be SHA-256, and list cursors are boundary-scoped.

### Deferred

- Binary upload and download.
- Storage-provider adapters and provider selection.
- Signed or public URLs.
- Malware scanning and quarantine.
- Update, replacement, versioning, deletion, retention, restore, and purge workflows.
- Business Documents and HTTP endpoints.
