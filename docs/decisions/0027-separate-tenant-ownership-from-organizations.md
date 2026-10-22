# ADR 0027: Separate Tenant Ownership from Organizations

## Status

Accepted

## Date

2026-07-12

## Context

NEWAX Core originally used Organization as the first business-facing tenant concept. That was sufficient for early organization-scoped access, but it combines two responsibilities that diverge as enterprise infrastructure grows.

A customer may own several legal entities, branches, schools, hospitals, departments, or companies while sharing one commercial relationship, deployment model, support entitlement, and data-isolation boundary.

## Decision

Tenant and Organization are separate foundation identities.

Tenant represents:

- Customer ownership.
- Data isolation.
- Licensing ownership.
- Deployment ownership.
- Support entitlement ownership.
- Future data-region, retention, configuration, and commercial policy ownership.

Organization represents legal and operating entities inside one Tenant, including:

- Legal entities.
- Companies.
- Branches.
- Departments.
- Schools.
- Hospitals.
- Institutions.
- Business units.

Every Tenant receives an independent UUID in `core_tenants`. Every Organization must reference exactly one `tenant_id`.

## Integrity rules

- An Organization cannot exist without a Tenant.
- Organization parent-child hierarchy cannot cross Tenant boundaries.
- Organization-to-Organization relationships cannot cross Tenant boundaries.
- Trusted organization request context contains both `tenantId` and `organizationId` derived from server-side membership records.
- An inactive or deleted Tenant invalidates organization context even when the membership and Organization remain active.
- Clients never supply Tenant identity as authority.
- Global People, Users, credentials, sessions, and reusable Contact Methods remain global where their existing ownership model requires it.
- Organization-owned records inherit Tenant ownership through their required Organization relationship unless a later ADR requires direct `tenant_id` for a tenant-level operation.

## Migration

Existing data is preserved:

1. Each top-level Organization receives a new deterministic Tenant UUID.
2. Descendant Organizations inherit their hierarchy root's Tenant.
3. Orphaned or cyclic Organization hierarchies stop migration rather than receiving guessed ownership.
4. Existing Organization relationships inherit the source Tenant.
5. Existing cross-Tenant relationships stop migration.
6. Database composite foreign keys enforce same-Tenant hierarchy and relationships after backfill.

## Deferred capabilities

This ADR establishes identity and isolation only. It does not invent business rules for:

- Licensing.
- Deployment management.
- Support plans or entitlements.
- Billing.
- Data residency.
- Retention.
- Tenant suspension or archival workflows.
- Tenant administration HTTP endpoints.

Those capabilities must reference `tenant_id` through separately approved modules.

## Consequences

Positive:

- One customer can own several Organizations without becoming several Tenants.
- Licensing, support, deployment, and data controls have one stable customer identifier.
- Cross-Tenant hierarchy errors are prevented in PostgreSQL.
- Trusted context carries the complete ownership boundary.
- Future domains can distinguish customer ownership from operating structure.

Cost:

- Organization contracts and persistence become Tenant-scoped.
- Trusted context contracts gain `tenantId`.
- Existing Organization data requires a controlled backfill.
- Tests and adapters must create a Tenant before creating an Organization.

## Supersession

This ADR supersedes the part of ADR 0003 that used Organization as the primary Tenant identity. ADR 0003 remains valid for the broader multi-tenancy, isolation, shared-database, and tenant-aware-module direction.
