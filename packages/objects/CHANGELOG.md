# Objects Changelog

## 0.2.0 - 2026-07-14

### Added

- `GET /api/core/organizations/current/objects` for bounded current-Organization Object listing.
- `POST /api/core/organizations/current/objects` for trusted current-Organization Object creation.
- Strict query and JSON body allow-lists, minimized `no-store` responses, and stable HTTP error envelopes.

### Security

- Tenant and Organization authority remains derived only from trusted request context.
- HTTP and package permission checks enforce `objects.view` and `objects.create`.
- Responses exclude Tenant IDs, owning Organization IDs, and internal Object Type IDs.
- Assignment, location, transfer, lifecycle, and global Object Type management HTTP operations remain deferred.

## 0.1.0 - 2026-07-13

### Added

- Global Object Type registration protected by `objects.types.manage`.
- Tenant- and Organization-scoped Object creation protected by `objects.create`.
- Bounded current-Organization Object listing protected by `objects.view`.
- Same-Tenant parent Object validation.
- Object Type and Object creation events without names, serial numbers, reference codes, or descriptions.
- PostgreSQL-backed repository contracts and integrity rules.

### Database

- Adds immutable `tenant_id` ownership to `core_objects`.
- Backfills existing Objects from their owning Organizations.
- Rejects existing cross-Tenant parent relationships during migration.
- Adds composite foreign keys for Tenant ownership, owning Organization, and parent Object integrity.

### Deferred

- Object assignments to memberships.
- Object addresses and location history.
- Transfers between Organizations.
- Update, retirement, archival, restoration, and deletion workflows.
- HTTP endpoints.
