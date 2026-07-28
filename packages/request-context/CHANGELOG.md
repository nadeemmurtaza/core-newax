# Changelog

## 0.2.0 - 2026-07-12

- Add server-derived `tenantId` to trusted organization and module request contexts.
- Reject organization context when the owning Tenant is inactive.
- Confirm Tenant identity alongside membership and Organization identity.

All notable changes to the NEWAX Trusted Request Context module are documented here.

## Unreleased

### Added

- Bounded account membership discovery from trusted account context.
- Active membership and active organization filtering.
- Integrity validation preventing cross-person, inactive, malformed, or duplicate membership results.
- Paginated discovery contracts and a Prisma account-membership directory adapter.
- `GET /api/account/memberships` with strict pagination parsing and no-store responses.
- Organization context confirmation for an already validated selected membership.
- Fixed high-level capability summaries for client navigation without raw permission disclosure.
- `GET /api/account/organization-context` with current membership and organization revalidation.

### Security

- Person identity is derived only from the authenticated account context.
- Discovery returns no person identifiers, reference numbers, roles, permissions, or client-declared organization authority.
- A discovered membership still requires full Trusted Request Context validation before organization access is granted.
- Confirmation reloads the current membership and verifies it against trusted person, membership, and organization identifiers.
- Confirmation returns no raw roles, permission codes, user identifiers, person identifiers, session identifiers, or bearer material.
- Capability indicators are advisory only and never replace exact server-side permission enforcement.

### Database

- No tables or migrations are added.

## 0.1.0 - 2026-07-12

### Added

- Authenticated account-context resolution.
- Organization-context resolution through an explicitly selected membership.
- Membership ownership, status, and organization-status validation.
- Effective permission evaluation with tenant-boundary integrity checks.
- Immutable permission sets.
- Permission authorization helpers and existing module-context conversion.
- Request identifier generation and request-local context storage ports.
- Node `AsyncLocalStorage` adapter with concurrent-request isolation tests.
- Authentication, Memberships, Access Control, Prisma, and NestJS integration.
- Documentation, tests, Module Registry entry, and ADR 0018.

### Security

- User, person, organization, and permission authority are never accepted from request payloads.
- Organization identity is derived from the validated membership.
- Cross-person, missing, suspended, ended, and inactive membership selections use one concealed failure.
- Permission results must match the validated membership and organization boundary.
- User sessions cannot create platform context.
- Missing request-local context fails closed.

### Database

- No tables or migrations are added.
