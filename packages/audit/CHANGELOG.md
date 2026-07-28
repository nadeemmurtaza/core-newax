# Audit Changelog

All notable changes to the NEWAX Audit module are recorded here.

## 0.1.0 - 2026-07-14

### Added

- A reusable Audit package with validated trusted-entry recording.
- Global, Tenant, and Organization scope contracts.
- Permission-gated current-Organization summary listing with bounded cursor pagination.
- Metadata limits and forbidden sensitive-key validation.
- A Prisma repository owned by the application Audit composition.
- A NestJS application adapter connecting the independent HTTP Security audit-sink port.
- PostgreSQL unit and integration coverage.
- Direct Tenant ownership and composite Tenant-Organization enforcement for audit rows.

### Security

- Added explicit Tenant identity to Organization-scoped audit rows.
- Prevented Organization attribution without Tenant identity.
- Prevented cross-Tenant Organization attribution through a composite foreign key.
- Kept metadata, value snapshots, IP addresses, user agents, and correlation IDs outside the
  summary read contract.
- Removed session identifiers from HTTP completion metadata and reject session-related metadata
  keys at the Audit boundary.
- Preserved best-effort HTTP audit failure handling.

### Permissions

- Added **audit.view** for bounded current-Organization summary reads.

### Deferred

- HTTP endpoints and platform-operator browsing.
- Audit export.
- Raw metadata, network-detail, and value-snapshot disclosure.
- Retention, legal hold, deletion, archival, external storage, and analytics.
- Event ingestion and transactional outbox delivery.
