# ADR 0023: Build the Current Organization Read API

## 1. Decision Title

Build the first bounded current-organization read endpoint.

## 2. Status

Accepted

## 3. Date

2026-07-12

## 4. Context

NEWAX Core now supports authenticated sessions, active membership discovery, trusted organization-context resolution, and organization-context confirmation.

The next useful business-facing operation is a read-only organization profile that allows an authenticated client to display the organization currently selected through trusted membership context.

This endpoint must not become an arbitrary organization lookup API. Accepting an organization identifier from a route, query, body, or untrusted header would duplicate the tenant-selection mechanism and create another opportunity for cross-tenant access mistakes.

The existing Organizations service already owns organization identity and the `organizations.view` permission. The HTTP boundary already owns HTTPS, authentication, selected-membership validation, trusted context establishment, permission guards, throttling, response controls, and auditing.

## 5. Decision

NEWAX Core will expose:

```text
GET /api/core/organizations/current
```

The endpoint will:

- Require trusted organization context.
- Require `organizations.view` in the HTTP guard.
- Derive the organization identifier only from trusted request context.
- Recheck `organizations.view` inside the Organizations package.
- Reload the current organization from the Central Registry source of truth.
- Require the organization to remain active and non-deleted.
- Verify that the repository result matches the trusted organization identifier.
- Return a bounded organization profile.
- Reject every query parameter.
- Return `Cache-Control: no-store`.

### 5.1 Response contract

The endpoint returns only:

```text
id
legal_name
display_name
type
status
created_at
updated_at
```

The response does not include:

- Registration numbers.
- Tax numbers.
- Parent or child hierarchy.
- Deletion metadata.
- Roles or permission codes.
- People, users, or memberships.
- Contacts or addresses.
- Domain data or transactions.

### 5.2 Trusted identifier rule

The client does not submit an organization identifier.

The organization identifier follows this path:

```text
Authenticated session
  -> selected membership identifier
  -> trusted membership validation
  -> server-derived organization identifier
  -> current organization read
```

Route parameters, query parameters, body fields, and arbitrary request headers are not accepted as organization authority.

### 5.3 Authorization rule

The HTTP guard requires `organizations.view` before the controller executes.

`OrganizationsService.getCurrent` independently checks the same permission before reading persistence. This preserves package-level authorization when the service is used outside the current HTTP adapter.

Capability summaries returned by organization-context confirmation do not authorize this request. They remain advisory presentation hints only.

### 5.4 Current-state rule

Trusted request context represents an evaluated request boundary, but the current organization record is still reloaded.

If the organization is missing, suspended, archived, or deleted before the read occurs, the operation fails closed.

A repository result whose identifier differs from the trusted organization identifier is treated as an integrity failure.

### 5.5 Data minimization

Legal and display names are included because they are required to identify the current organization to authorized users.

Registration, tax, hierarchy, contact, and administrative data require separate contracts and permission decisions. They are not included merely because the underlying table contains them.

## 6. Consequences

### Positive

- Clients can display the current organization without submitting tenant authority.
- Tenant selection remains centralized in Trusted Request Context.
- The first organization endpoint is small, predictable, and easy to audit.
- Sensitive corporate identifiers and unrelated registry data remain hidden.
- HTTP and package authorization provide defense in depth.
- Organization suspension or archival takes effect on the next read.
- No new database table, cache, or source of truth is introduced.

### Negative

- Clients need separate future endpoints for hierarchy, registration, tax, contact, or administration data.
- The organization is read again after context establishment.
- The endpoint cannot serve platform-wide organization browsing.
- The fixed response contract must evolve deliberately when genuinely reusable profile fields are approved.

## 7. Implementation Rules

- Never accept an organization identifier from the client for this endpoint.
- Always require trusted organization context.
- Always require `organizations.view` at both HTTP and package boundaries.
- Always reload the organization from the Central Registry.
- Always require active status and `deleted_at = null`.
- Always verify the returned identifier against trusted context.
- Never return registration numbers, tax numbers, hierarchy, deletion metadata, roles, permission codes, or identity records.
- Never use organization-context capability booleans as authorization.
- Always reject query parameters.
- Always use `Cache-Control: no-store`.

## 8. Deferred Decisions

- Arbitrary organization lookup by identifier.
- Organization listing and search.
- Organization creation, update, suspension, archive, and restoration endpoints.
- Parent-child hierarchy presentation.
- Registration and tax profile exposure.
- Contacts and addresses.
- Organization branding and preferences.
- Platform-operator organization browsing.
- Domain-specific organization extensions.

## 9. Related Decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0021: Build Account Membership Discovery.
- ADR 0022: Build Organization Context Confirmation.

## 10. Approval

This decision is accepted as the baseline for the first bounded organization read endpoint in NEWAX Core.

## Tenant boundary amendment

ADR 0027 adds `tenant_id` to the bounded current-organization response. The value is derived from trusted context and the persisted Organization record; clients cannot select or override it.
