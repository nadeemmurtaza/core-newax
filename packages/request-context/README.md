# NEWAX Trusted Request Context Module

## Status

Draft reusable platform service.

Version: `0.2.0`

## Purpose

The Trusted Request Context module converts a validated account session and a selected active membership into an immutable organization-scoped execution context.

It also provides bounded account membership discovery so an authenticated person can see the active memberships available for organization-context selection without supplying or receiving trusted authority.

Organization context confirmation lets the client verify that a selected membership produced valid current organization context without receiving raw role or permission data.

It connects Authentication, Memberships, Organizations, and Access Control without allowing callers to declare their own user identity, organization identity, or permissions.

## Core sequence

```text
Session token
  -> authenticated user and person
  -> active membership discovery
  -> selected membership
  -> membership ownership and status validation
  -> organization status validation
  -> effective permission evaluation
  -> trusted organization request context
  -> bounded organization context confirmation
```

Authentication proves who controls the session. Memberships determine where that person may operate. Access Control determines what the selected membership may do.

## Public module API

The package exports:

- `TrustedRequestContextService`
- `AccountMembershipDiscoveryService`
- `OrganizationContextConfirmationService`
- `TrustedRequestContextStore`
- `ContextAuthorizer`
- `ImmutablePermissionSet`
- Session, membership, account-membership, confirmation, permission, clock, and request identifier ports
- Account and organization request-context contracts
- Account membership discovery contracts
- Organization context confirmation and capability-summary contracts
- `RequestContextError`

Core operations:

```text
resolveAccountContext
list available account memberships
resolveOrganizationContext
confirm organization context
hasPermission
requirePermission
requireAllPermissions
requireAnyPermission
toModuleContext
```

## Context types

### Account context

An account context contains:

- Request identifier.
- User identifier.
- Person identifier.
- Session identifier.
- Session expiry.

It does not contain an organization, membership, role, or permission set.

A valid session alone never grants organization access.

### Organization context

An organization context adds:

- Membership identifier.
- Organization identifier derived from the membership.
- Effective permission codes evaluated for the membership.
- Permission evaluation timestamp.

The client selects a membership identifier. The server derives the Tenant and Organization identifiers from the trusted membership record.

## Account membership discovery

Account membership discovery exists only to present valid organization-context choices to the authenticated account.

Rules:

- The person identifier comes from trusted account context.
- Only active memberships in active, non-archived organizations are returned.
- Archived people, ended memberships, suspended memberships, inactive organizations, and deleted organizations are excluded by persistence and verified again by the service boundary.
- Membership records returned for another person fail closed as an integrity error.
- Results are bounded and paginated.
- The response excludes person identifiers, membership reference numbers, role names, permission codes, and other authority-bearing or unnecessary fields.
- Discovery does not grant organization access. The selected membership must still pass full organization-context resolution.

## Organization context confirmation

Organization context confirmation exists only after Trusted Request Context has validated an active selected membership and evaluated its current permissions.

Rules:

- The service receives trusted organization context, not client-declared user, person, organization, role, permission, or status fields.
- The selected membership is reloaded from the Central Registry with active person, membership, organization, non-ended, and non-deleted filters.
- Reloaded person, membership, and Tenant and Organization identifiers must match trusted organization context.
- A selection that becomes unavailable fails with the concealed membership-unavailable response.
- Identifier mismatches or malformed persistence records fail as integrity errors.
- The response includes only selected organization display identity, membership presentation fields, session expiry, permission-evaluation time, and fixed capability indicators.
- Raw permission codes, role names, user identifiers, person identifiers, and session identifiers are not returned.

### Capability indicators

The confirmation service projects exact permission codes into a fixed set of boolean capability categories:

- Organization view and management.
- People view and management.
- Membership view and management.
- User view and management.
- Access Control view and management.

These indicators exist for navigation and interface presentation only. They are not authorization decisions. Every protected endpoint must continue to enforce its own exact server-side permissions.

Capability projection uses explicit permission allowlists. It does not infer authority from role names, arbitrary prefixes, or client input.

## Trust rules

The resolver never accepts the following values as caller-supplied authority:

- `userId`
- `personId`
- `organizationId`
- Permission codes
- Role names
- Account or membership status

The only caller-selected organization input is `membershipId`. The resolver verifies that the membership belongs to the person attached to the authenticated session and that both the membership and organization are active.

Missing memberships, memberships belonging to another person, suspended memberships, ended memberships, and inactive organizations return one concealed membership-unavailable failure.

## Permission integrity

Permission evaluation must return the same membership and Tenant and Organization identifiers that were validated by the trusted membership directory.

A mismatch is treated as an integrity failure rather than as an empty permission set.

Effective permissions are exposed through `ImmutablePermissionSet`, which implements `ReadonlySet<string>` without mutation methods. Downstream modules receive the existing request-context shape:

```text
actorUserId
organizationId
permissionCodes
```

This allows current Organization, People, Memberships, Users, and Access Control services to consume trusted context without accepting authority from request payloads.

## Request-local storage

The API adapter uses `AsyncLocalStorage` to isolate concurrent request contexts.

Rules:

- Context exists only inside an explicitly established operation.
- Concurrent requests must not observe each other's context.
- Missing context fails closed.
- Context must not be stored in process-global mutable variables.

## Platform context

User sessions do not create platform context.

Platform-wide operations remain restricted to separately trusted internal execution paths. An authenticated tenant user cannot obtain `organizationId = null` by omitting a membership or changing request data.

## Database ownership

The module owns no database tables.

It reads trusted references from:

- Authentication sessions.
- Membership and organization status.
- Organization display identity.
- Effective permission evaluation.

## HTTP exposure

The API exposes two bounded account flows:

```text
GET /api/account/memberships
GET /api/account/organization-context
```

Membership discovery requires trusted account context, accepts only bounded pagination fields, returns `Cache-Control: no-store`, and does not require organization permissions because it reveals only the authenticated person's active context choices.

Organization confirmation requires trusted organization context established from the `x-newax-membership-id` transport. It returns `Cache-Control: no-store` and requires no additional business permission because it confirms only the already validated selected context.

The caller may select a returned membership identifier in the existing `x-newax-membership-id` transport when requesting an organization-scoped endpoint. Selection alone grants nothing. The HTTP Security Boundary and Trusted Request Context validate the membership and permissions again.

Capability indicators returned by confirmation may help the client present navigation, but the server remains authoritative for every operation.

## Dependencies

The module depends on:

- Authentication `>=0.1.0`
- Memberships `>=0.1.0`
- Organizations `>=0.1.0`
- Access Control `>=0.1.0`

## Known limitations

- Membership selection is explicit for each organization context.
- Permission scopes beyond effective permission codes are deferred.
- Platform operator context is deferred.
- Context caching is not implemented.
- Permission changes during an active request take effect on the next resolution.
- Durable authorization-denial audit persistence is deferred.
- Organization hierarchy presentation and preferred default membership selection are deferred.
- Capability categories currently cover foundation administration only, not future business-domain modules.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0010: Define Authentication and User Identity Strategy.
- ADR 0015: Consolidate Roles and Permissions into Access Control.
- ADR 0016: Build the Users Registry Service Foundation.
- ADR 0017: Build the Authentication Service Foundation.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0020: Build Authentication HTTP Endpoints.
- ADR 0021: Build Account Membership Discovery.
- ADR 0022: Build Organization Context Confirmation.
