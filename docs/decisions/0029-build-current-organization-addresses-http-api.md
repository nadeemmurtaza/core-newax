# ADR 0029: Build the Current Organization Addresses HTTP API

## 1. Decision Title

Expose bounded current-organization address creation and listing through the HTTP security boundary.

## 2. Status

Accepted

## 3. Date

2026-07-12

## 4. Context

ADR 0028 established the Addresses Registry foundation for permission-controlled Organization locations. The package owns normalization, canonical location reuse, Tenant and Organization revalidation, active-primary concurrency, active-only reads, tenant-bound pagination, persistence integrity checks, and physical-address-free event logging.

Clients still need a protected HTTP contract to create and display locations for the Organization selected through trusted request context.

This contract must not become an arbitrary Organization or global location lookup API. Accepting a Tenant, Organization, canonical address, Person, object, or authority identifier from a path, query, body, or header would duplicate trusted context and create cross-boundary disclosure risks.

## 5. Decision

NEWAX Core will expose:

```text
GET  /api/core/organizations/current/addresses
POST /api/core/organizations/current/addresses
```

Both endpoints will:

- Require authenticated trusted Organization context.
- Derive Tenant and Organization identity only from trusted server-side context.
- Reject client-supplied authority identifiers.
- Use the existing Addresses service rather than duplicate normalization or persistence rules.
- Return `Cache-Control: no-store`.
- Use the existing HTTP security envelope for rejected requests.

### 5.1 Listing contract

`GET /api/core/organizations/current/addresses` requires `addresses.view` at the HTTP guard and Addresses package boundaries.

The endpoint accepts only:

```text
address_type
limit
after_id
```

Rules:

- `address_type` is optional and must be an approved Organization address type.
- `limit` is optional and must be a single integer string between 1 and 100.
- `after_id` is optional and must be a single non-empty string; the Addresses service validates UUID form and repository ownership.
- Unknown, repeated, array, or client-authority query fields are rejected.
- The response contains `items` and `next_cursor`.

### 5.2 Creation contract

`POST /api/core/organizations/current/addresses` requires `addresses.create` at the HTTP guard and Addresses package boundaries.

The JSON body accepts only:

```text
address_type
is_primary
line_1
line_2
city
state_region
postal_code
country_code
```

Rules:

- `address_type`, `is_primary`, `line_1`, `city`, and `country_code` are required.
- `address_type` must be one of the approved Organization address types.
- `is_primary` must be a boolean.
- `line_1`, `city`, and `country_code` must be strings.
- `line_2`, `state_region`, and `postal_code` are optional and may be strings or `null`.
- Unknown fields are rejected.
- Tenant, Organization, Person, object, canonical address, role, permission, and lifecycle identifiers are never accepted from the client.
- The creation query contract is empty; all query parameters are rejected before trusted context or the Addresses service is invoked.
- Successful creation returns HTTP status 201.

Browser mutation protections, including origin and CSRF enforcement, remain owned by the HTTP Security Boundary.

### 5.3 Response minimization

Each returned Organization address contains only:

```text
id
address_type
is_primary
line_1
line_2
city
state_region
postal_code
country_code
created_at
```

The response excludes:

- `tenant_id` and `organization_id`, because the route already represents trusted context.
- `address_id`, because canonical address identity is an internal registry detail.
- Canonical hashing or matching metadata.
- Person-address and object-address relationships.
- Role, membership, permission, audit, or removal metadata.

### 5.4 Error mapping

The HTTP exception filter recognizes `ADDRESS_*` package errors and maps them to stable public envelopes:

- Invalid input -> 400.
- Invalid or foreign cursor -> 400.
- Forbidden -> 403.
- Conflict -> 409.
- Organization unavailable -> 409.
- Integrity failure -> 500.

Package messages and physical address details are never returned to the client.

### 5.5 Stacked delivery

This implementation depends on ADR 0028 and PR #29. Until that dependency is merged, this PR is reviewed as a stacked change against the Organization Addresses foundation branch.

After the dependency is integrated, the HTTP PR may be retargeted to `main` without changing its implementation diff.

## 6. Consequences

### Positive

- Clients can manage current-Organization locations without submitting Tenant or Organization authority.
- HTTP and package authorization remain defense in depth.
- Address normalization, canonical reuse, concurrency, lifecycle, and persistence behavior remain centralized.
- Response contracts do not expose canonical-registry internals.
- Query and body shapes are strict, predictable, and auditable.
- No new database table, migration, dependency, cache, or alternate source of truth is introduced.

### Negative

- Clients cannot browse another Organization or search the global canonical address registry.
- Update, removal, verification, geocoding, and Person-address operations require later contracts.
- Strict rejection of unknown fields requires deliberate API evolution.
- Physical locations are returned only to users with explicit `addresses.view` permission inside trusted Organization context.

## 7. Implementation Rules

- Never accept Tenant, Organization, Person, object, or canonical address identifiers from the client.
- Always require trusted Organization context.
- Always require `addresses.view` or `addresses.create` at both HTTP and package boundaries.
- Always use the Addresses service for normalization, authorization, and persistence operations.
- Never expose `address_id`, canonical hashes, or global address search.
- Never infer Person-address visibility from Organization membership.
- Always reject unsupported query and body fields.
- Always return `Cache-Control: no-store`.
- Always map Addresses package errors through the stable HTTP envelope.
- Never weaken CSRF, origin, body-size, rate-limit, audit, or Tenant controls for these endpoints.

## 8. Deferred Decisions

- Organization address update endpoints.
- Non-destructive Organization address removal endpoints.
- Address verification evidence.
- Person-address privacy and self-service workflows.
- Object-address APIs.
- Tenant-level addresses without an Organization owner.
- Geocoding, maps, postal validation, delivery zones, or public location presentation.
- Arbitrary Organization or global canonical address lookup.

## 9. Related Decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use the Central Identity and Organization Registry.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0023: Build the Current Organization Read API.
- ADR 0027: Separate Tenant Ownership from Organizations.
- ADR 0028: Build the Organization Addresses Registry Foundation.

## 10. Approval

This decision is accepted as the baseline for bounded current-Organization address creation and listing through NEWAX Core HTTP infrastructure.
