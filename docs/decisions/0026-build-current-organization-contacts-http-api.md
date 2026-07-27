# ADR 0026: Build the Current Organization Contacts HTTP API

## 1. Decision Title

Expose bounded current-organization contact creation and listing through the HTTP security boundary.

## 2. Status

Accepted

## 3. Date

2026-07-12

## 4. Context

ADR 0025 established the Contacts Registry foundation for permission-controlled organization email and phone contacts. The foundation now owns normalization, duplicate handling, organization-state revalidation, primary-contact concurrency, tenant-bound pagination, persistence integrity checks, and sensitive-value-free events.

Clients still need a protected HTTP contract to create and display contacts for the organization selected through trusted request context.

This contract must not become an arbitrary organization-contact API. Accepting an organization identifier from a path, query, body, or header would duplicate tenant selection and create another cross-organization access risk.

The HTTP adapter must also avoid exposing Contacts persistence details. The shared `contact_method_id`, canonical normalized value, and organization identifier are internal registry data rather than necessary client response fields.

## 5. Decision

NEWAX Core will expose:

```text
GET  /api/core/organizations/current/contacts
POST /api/core/organizations/current/contacts
```

Both endpoints will:

- Require authenticated trusted organization context.
- Derive the organization identifier only from trusted server-side context.
- Reject client-supplied organization authority.
- Use the existing Contacts service rather than duplicate normalization or persistence rules.
- Return `Cache-Control: no-store`.
- Use the existing HTTP security envelope for rejected requests.

### 5.1 Listing contract

`GET /api/core/organizations/current/contacts` requires `contacts.view` at the HTTP guard and Contacts package boundaries.

The endpoint accepts only:

```text
limit

after_id
```

Rules:

- `limit` is optional and must be a single integer string between 1 and 100.
- `after_id` is optional and must be a single non-empty string; the Contacts service validates its UUID form and repository ownership.
- Unknown, repeated, array, or client-authority query fields are rejected.
- The response contains `items` and `next_cursor`.

### 5.2 Creation contract

`POST /api/core/organizations/current/contacts` requires `contacts.create` at the HTTP guard and Contacts package boundaries.

The JSON body accepts only:

```text
contact_type
contact_value
label
is_primary
valid_from
valid_until
```

Rules:

- `contact_type` is required and must be `email` or `phone`.
- `contact_value` is required and must be a string.
- `label` is optional and may be a string or `null`.
- `is_primary` is optional and must be a boolean when present.
- `valid_from` and `valid_until` are optional and must be valid `YYYY-MM-DD` strings or `null`.
- Unknown fields are rejected.
- Organization, user, permission, verification, normalized-value, and contact-method identifiers are never accepted from the client.
- Successful creation returns HTTP status 201.

Browser mutation protections, including origin and CSRF enforcement, remain owned by the HTTP Security Boundary.

### 5.3 Response minimization

Each returned contact contains only:

```text
id
type
value
label
is_primary
is_verified
verified_at
status
valid_from
valid_until
created_at
```

The response excludes:

- `organization_id`, because the route already represents the trusted current organization.
- `contact_method_id`, because it is an internal shared-registry identifier.
- `normalized_value`, because canonicalization is an implementation detail.
- Verification evidence or policy metadata.
- Person-contact relationships.
- Audit, role, membership, permission, or deletion metadata.

### 5.4 Error mapping

The HTTP exception filter recognizes `CONTACT_*` package errors and maps them to stable public envelopes:

- Invalid input -> 400.
- Forbidden -> 403.
- Conflict -> 409.
- Organization unavailable -> 409.
- Integrity failure -> 500.

Package messages and implementation details are never returned to the client.

### 5.5 Stacked delivery

This implementation depends on ADR 0025 and the Contacts foundation PR. Until that dependency is merged, this PR is reviewed as a stacked change against the Contacts foundation branch.

After the dependency is integrated, the HTTP PR may be retargeted to `main` without changing its implementation diff.

## 6. Consequences

### Positive

- Clients can manage current-organization contacts without submitting tenant authority.
- HTTP and package authorization remain defense in depth.
- Contact normalization, concurrency, and persistence behavior remain centralized.
- Response contracts do not expose shared-registry internals.
- Query and body shapes are strict, predictable, and auditable.
- The endpoint can serve future CRM, healthcare, education, legal, retail, and other NEWAX domains without domain-specific coupling.
- No database schema, migration, cache, or alternate source of truth is introduced.

### Negative

- Clients cannot browse or modify another organization through these routes.
- Update, removal, verification, and person-contact operations require later contracts.
- Strict rejection of unknown fields requires deliberate API evolution.
- The stacked PR must be retargeted after its dependency is integrated.

## 7. Implementation Rules

- Never accept an organization identifier from the client.
- Always require trusted organization context.
- Always require `contacts.view` or `contacts.create` at both HTTP and package boundaries.
- Always use the Contacts service for validation, normalization, and persistence operations.
- Never expose `contact_method_id` or `normalized_value`.
- Never infer person-contact visibility from organization membership.
- Always reject unsupported query and body fields.
- Always use exact date-only parsing for validity dates.
- Always return `Cache-Control: no-store`.
- Always map Contacts package errors through the stable HTTP envelope.
- Never weaken CSRF, origin, body-size, rate-limit, audit, or tenant controls for these endpoints.

## 8. Deferred Decisions

- Contact update endpoints.
- Non-destructive contact removal endpoints.
- Contact verification authority, evidence, and workflows.
- Self-service person-contact management.
- Organization access to person contacts.
- Emergency-contact relationships.
- Addresses and geospatial contact data.
- Arbitrary organization contact lookup.
- Public or unauthenticated contact presentation.
- Durable transactional outbox delivery.

## 9. Related Decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use the Central Identity and Organization Registry.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0023: Build the Current Organization Read API.
- ADR 0025: Build the Organization Contacts Registry Foundation.

## 10. Approval

This decision is accepted as the baseline for bounded current-organization contact creation and listing through NEWAX Core HTTP infrastructure.
