# NEWAX Organizations Module

## Status

Draft reusable foundation module.

Version: `0.2.0`

## Purpose

The Organizations module maintains legal and operating entities inside a Tenant, including companies, institutions, branches, campuses, departments, schools, hospitals, subsidiaries, and business units.

Tenant provides the customer ownership and data-isolation boundary. Organizations provide the legal and operating boundary that future LMS, CRM, Legal, Healthcare, Finance, HR, Real Estate, Hospitality, Connected Infrastructure, and other domains reference through stable `organization_id` values.

## Owned concepts and data

The module owns:

- Required Tenant ownership.
- Organization identity.
- Parent-child organization hierarchy.
- Organization lifecycle status.
- Organization relationship validation.
- Organization permission definitions.
- Organization events.

Database ownership:

- `core_organizations`
- `core_organization_relationships`

The module does not own people, memberships, users, roles, permission assignments, contacts, addresses, objects, files, domain records, or business transactions.

## Public module API

The package exports:

- `OrganizationsService`
- `OrganizationRepository`
- `OrganizationEventPublisher`
- Organization request, response, persistence, and event types
- `CurrentOrganizationRequestContext`
- `CurrentOrganizationProfile`
- `ORGANIZATION_PERMISSIONS`
- `OrganizationModuleError`

Primary operations:

```text
create
getById
getCurrent
list
update
archive
```

The service layer validates permissions, required text fields, parent existence, archived-parent rules, hierarchy cycles, active-child archive restrictions, current-organization state, trusted identifier integrity, and profile timestamps before persistence results reach callers.

## Current organization profile

`getCurrent` reads only the organization identified by trusted organization context.

It requires:

- A trusted actor user identifier.
- A trusted Tenant identifier.
- A trusted Organization identifier.
- `organizations.view` in the effective permission set.

The operation returns only:

- Tenant identifier.
- Organization identifier.
- Legal name.
- Display name.
- Organization type.
- Active status.
- Created and updated timestamps.

It deliberately excludes registration numbers, tax numbers, parent hierarchy, deletion metadata, roles, permission codes, people, users, memberships, and domain data.

The organization must still be active and non-deleted when the repository read occurs. A previously valid context does not preserve access after the organization becomes unavailable.

## Permissions

Protected operations require explicit permissions:

```text
organizations.view
organizations.create
organizations.update
organizations.archive
```

Roles may group these permissions, but module behavior must never authorize actions through hardcoded role names.

The current-organization HTTP endpoint enforces `organizations.view` in the HTTP guard and again inside `OrganizationsService`.

## Events

The module publishes:

```text
organization.created
organization.updated
organization.archived
```

Each event includes the actor user, organization identifier, occurrence time, and resulting organization record.

The initial application adapter logs these events in process. Durable external delivery or transactional outbox behavior remains deferred until a concrete integration requires it.

Read operations do not publish organization lifecycle events.

## Dependencies

The reusable package has no dependency on LMS or another business domain.

The NestJS application adapter depends on:

- The Tenants foundation module.
- The API database module.
- Trusted Request Context for server-derived actor, organization, and permission values.
- The HTTP Security Boundary for HTTPS, authentication, selected-membership validation, and permission guards.
- Prisma-generated database access.
- PostgreSQL Central Registry tables.

The package defines ports so its service rules do not depend directly on NestJS, Prisma, PostgreSQL, HTTP transport, or a client-specific deployment.

## Configuration

The first version uses the following built-in behavior:

- Default list page size: `50`
- Maximum list page size: `100`
- Organization status values: `active`, `suspended`, `archived`
- Archived organizations cannot be updated or selected as parents.
- Organizations with active children cannot be archived.
- Current-organization reads require active, non-deleted records.

Organization type values remain controlled by the calling solution until a dedicated reference-data capability is approved.

## HTTP exposure

The API exposes one bounded organization read endpoint:

```text
GET /api/core/organizations/current
```

Rules:

- The organization identifier comes from trusted organization context.
- The client must not supply an organization identifier in the route, query, or body.
- Every query parameter is rejected.
- `organizations.view` is required.
- The response uses `Cache-Control: no-store`.
- Only the bounded current-organization profile is returned.
- The endpoint does not expose organization listing, arbitrary lookup, creation, update, archive, hierarchy, registration, or tax data.

## Testing

Unit tests cover:

- Permission rejection.
- Create-input normalization.
- Event publication.
- Hierarchy cycle prevention.
- Active-child archive protection.
- Current-organization identifier normalization.
- Active and non-deleted state enforcement.
- Repository boundary mismatch rejection.
- Timestamp integrity.
- Minimal HTTP response projection.
- Query-parameter and missing-context rejection.

The Prisma migration and repository composition are validated through the repository CI pipeline using PostgreSQL 18.

## Client customization

Client-specific organization types, naming, hierarchy conventions, or status displays must be implemented through approved configuration or extension modules.

Client fields must not be added directly to `core_organizations` unless they are broadly reusable foundation requirements approved through architecture review.

## Known limitations

- Arbitrary organization lookup and administration HTTP endpoints are not enabled.
- Organization hierarchy presentation remains deferred.
- Registration and tax profile exposure requires a separately approved contract and permission policy.
- Durable event delivery is not yet implemented.
- Organization relationship types beyond the parent hierarchy are persisted but do not yet have service operations.
- Reference-data management for organization types remains deferred.

## Related decisions

- ADR 0001: Use Modular Monolith First.
- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0011: Define Technology Stack and Implementation Baseline.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0022: Build Organization Context Confirmation.
- ADR 0023: Build Current Organization Read API.
