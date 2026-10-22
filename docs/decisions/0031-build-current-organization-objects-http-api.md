# ADR 0031: Build the Current Organization Objects HTTP API

## 1. Decision Title

Expose bounded current-Organization Object creation and listing through the HTTP security boundary.

## 2. Status

Accepted

## 3. Date

2026-07-14

## 4. Context

ADR 0030 established Tenant-safe Object Type registration and current-Organization Object creation and listing in the reusable Objects Registry. The package owns normalization, authorization, active Tenant and Organization revalidation, Object Type availability, same-Tenant parent validation, Organization reference-code conflicts, bounded pagination, persistence integrity, and metadata-only events.

Clients still need a protected HTTP contract to create and display individually identifiable non-human entities for the Organization selected through trusted request context.

This contract must not become an arbitrary Organization, Tenant, Object Type management, or global Object lookup API. Tenant and Organization authority must remain server-derived, and the response must not expose internal ownership keys or database relationship details that clients do not need.

## 5. Decision

NEWAX Core will expose:

```text
GET  /api/core/organizations/current/objects
POST /api/core/organizations/current/objects
```

Both endpoints will:

- Require authenticated trusted Organization context.
- Derive Tenant and Organization identity only from trusted server-side context.
- Reject client-supplied authority identifiers.
- Use the existing Objects service instead of duplicating normalization, authorization, or persistence rules.
- Return `Cache-Control: no-store`.
- Use the existing HTTP security envelope for rejected requests.

### 5.1 Listing contract

`GET /api/core/organizations/current/objects` requires `objects.view` at the HTTP guard and Objects package boundaries.

The endpoint accepts only:

```text
object_type_code
limit
after_id
```

Rules:

- `object_type_code` is optional and must be a single non-empty string; the Objects service applies the canonical stable-code rules.
- `limit` is optional and must be a single integer string between 1 and 100.
- `after_id` is optional and must be a single non-empty string; the Objects service validates UUID form and repository ownership.
- Unknown, repeated, array, or client-authority query fields are rejected.
- The response contains `items` and `next_cursor`.

### 5.2 Creation contract

`POST /api/core/organizations/current/objects` requires `objects.create` at the HTTP guard and Objects package boundaries.

The JSON body accepts only:

```text
object_type_code
parent_object_id
name
reference_code
serial_number
description
```

Rules:

- `object_type_code` and `name` are required strings.
- `parent_object_id`, `reference_code`, `serial_number`, and `description` are optional and may be strings or `null`.
- The Objects service validates Object Type codes, UUIDs, text bounds, normalization, parent Tenant ownership, and reference-code uniqueness.
- `parent_object_id` identifies an approved same-Tenant hierarchy relationship; it does not supply Tenant or Organization authority.
- Unknown fields are rejected.
- Tenant ID, owning Organization ID, Object Type ID, user, membership, role, permission, status, and lifecycle fields are never accepted from the client.
- The creation query contract is empty; all query parameters are rejected before trusted context or the Objects service is invoked.
- Successful creation returns HTTP status 201.

Browser mutation protections, including origin and CSRF enforcement, remain owned by the HTTP Security Boundary.

### 5.3 Response minimization

Each returned Object contains only:

```text
id
object_type_code
parent_object_id
name
reference_code
serial_number
description
created_at
```

The response excludes:

- `tenant_id` and `owning_organization_id`, because the route already represents trusted context.
- `object_type_id`, because the stable Object Type code is the client-facing contract.
- Object Type category, description, and global registration metadata.
- Assignment, location, transfer, lifecycle, audit, permission, and domain-extension data.

### 5.4 Error mapping

The HTTP exception filter recognizes `OBJECT_*` package errors and maps them to stable public envelopes:

- Invalid input or invalid/foreign cursor -> 400.
- Forbidden -> 403.
- Conflict, unavailable Organization, unavailable Object Type, or unavailable parent -> 409.
- Integrity failure -> 500.

Package messages, cross-Tenant details, Object names, reference codes, serial numbers, and descriptions are never returned in error responses.

### 5.5 Stacked delivery

This implementation depends on ADR 0030 and PR #31. Until that dependency is merged, this PR is reviewed as a stacked change against the Object Registry foundation branch.

After the dependency is integrated, the HTTP PR may be retargeted to `main` without changing its implementation diff.

## 6. Consequences

### Positive

- Clients can create and list current-Organization Objects without submitting Tenant or Organization authority.
- HTTP and package authorization remain defense in depth.
- Object normalization, Tenant isolation, hierarchy, conflict, pagination, and persistence rules remain centralized.
- Responses expose stable business identifiers without exposing internal ownership keys.
- Query and body shapes are strict, predictable, and auditable.
- No new table, migration, dependency, cache, or alternate source of truth is introduced.

### Negative

- Clients cannot browse another Organization or search the global Object registry.
- Global Object Type registration remains unavailable through this Organization-scoped HTTP contract.
- Update, retirement, assignment, location, transfer, and deletion workflows require later approved contracts.
- Strict rejection of unknown fields requires deliberate API evolution.

## 7. Implementation Rules

- Never accept Tenant or owning Organization authority from the client.
- Always require trusted Organization context.
- Always require `objects.view` or `objects.create` at both HTTP and package boundaries.
- Always use the Objects service for validation, authorization, and persistence operations.
- Never expose `tenant_id`, `owning_organization_id`, or `object_type_id`.
- Never activate assignment, location, lifecycle, transfer, or domain-specific behavior through this contract.
- Always reject unsupported query and body fields.
- Always return `Cache-Control: no-store`.
- Always map Objects package errors through the stable HTTP envelope.
- Never weaken CSRF, origin, body-size, rate-limit, audit, or Tenant controls for these endpoints.

## 8. Deferred Decisions

- Global Object Type management HTTP endpoints and platform-context policy.
- Object assignment to memberships.
- Object address and location history.
- Ownership transfer between Organizations.
- Update, retirement, archive, restore, and deletion workflows.
- Domain-specific attributes and identifiers.
- Arbitrary Organization, Tenant, or global Object search.

## 9. Related Decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use the Central Identity and Organization Registry.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0023: Build the Current Organization Read API.
- ADR 0027: Separate Tenant Ownership from Organizations.
- ADR 0030: Build the Object Registry Foundation.

## 10. Approval

This decision is accepted as the baseline for bounded current-Organization Object creation and listing through NEWAX Core HTTP infrastructure.
