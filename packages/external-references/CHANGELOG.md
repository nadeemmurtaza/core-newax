# Changelog

All notable changes to the NEWAX External References module are recorded here.

## 0.1.0 - 2026-07-14

### Added

- Added permission-gated current-Organization registration and bounded listing.
- Added stable-code validation and opaque identifier/key length and control-character checks.
- Added metadata-free `external_reference.registered` events and structured logging.
- Added active Tenant, Organization, actor User, and actor Person revalidation.
- Added transaction-scoped duplicate serialization without placing opaque external keys in lock
  or event logs.
- Added Tenant-aware PostgreSQL ownership, indexes, checks, and composite Organization integrity.
- Preserved dormant global rows while keeping global service operations unavailable.

### Deferred

- HTTP endpoints, metadata, lifecycle operations, credentials, provider adapters,
  synchronization, reconciliation, and durable event delivery.
