# Changelog

## 0.2.0 - 2026-07-12

- Require every Organization to belong to one Tenant.
- Scope create, read, list, update, archive, parent validation, and cycle checks by trusted `tenantId`.
- Include Tenant identity in organization records, events, and the bounded current-organization profile.
- Prevent cross-Tenant hierarchy through database-backed composite constraints.

All notable changes to the NEWAX Organizations module are documented here.

## Unreleased

### Added

- Trusted current-organization profile retrieval through `OrganizationsService.getCurrent`.
- `GET /api/core/organizations/current` protected by organization context and `organizations.view`.
- Bounded organization presentation fields with no query parameters or client-supplied organization identifier.
- Service and HTTP tests for permission enforcement, tenant-boundary integrity, active-state checks, and response minimization.
- ADR 0023 documenting the first organization read endpoint.

### Security

- The organization identifier is derived only from trusted organization context.
- The package and HTTP boundary both enforce `organizations.view`.
- Suspended, archived, deleted, missing, or boundary-mismatched organizations fail closed.
- Registration numbers, tax numbers, hierarchy data, deletion metadata, roles, permissions, and identity records are not returned.

### Database

- No tables or migrations are added.

## 0.1.0 - 2026-07-11

### Added

- Reusable organization service contracts and permission definitions.
- Organization creation, retrieval, listing, update, and archive operations.
- Parent validation and hierarchy cycle prevention.
- Active-child archive protection.
- Organization lifecycle events.
- Repository and event-publisher ports.
- Unit tests for core service behavior.
- Prisma application adapter and NestJS module composition.

### Security

- Protected operations require explicit `organizations.*` permissions.
- No public HTTP controller is exposed before trusted authentication and permission context exist.

### Database

- Uses the existing `core_organizations` Central Registry table.
- Uses parent hierarchy data owned by the Organization foundation.
