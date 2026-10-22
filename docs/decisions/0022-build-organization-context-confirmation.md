# ADR 0022: Build Organization Context Confirmation

- Status: Accepted
- Date: 2026-07-12
- Owners: NEWAX Engineering

## Context

Authentication now proves account identity, Account Membership Discovery presents active organization choices, and Trusted Request Context validates a selected membership before deriving organization identity and effective permissions.

Clients still need a bounded way to confirm that the selected membership successfully produced trusted organization context. Returning raw roles or the complete permission set would expose unnecessary authorization detail, encourage browser-side authorization logic, and couple clients to internal permission design.

The confirmation workflow must therefore provide enough identity and capability information for navigation and presentation without becoming another source of authority.

## Decision

NEWAX will expose:

```text
GET /api/account/organization-context
```

The endpoint requires trusted organization context. The client supplies only the existing selected membership transport through `x-newax-membership-id`. The HTTP Security Boundary and Trusted Request Context validate the session, membership ownership, membership status, organization status, and current effective permissions before the controller runs.

The confirmation service then reloads a minimal current membership and organization record and verifies that it matches the trusted person, membership, and organization identifiers.

### Response contract

The endpoint returns only:

- Context scope.
- Membership identifier.
- Organization identifier, display name, and organization type.
- Membership type and job title.
- Session expiry.
- Permission-evaluation timestamp.
- A fixed high-level capability summary.

It does not return:

- User or person identifiers.
- Session identifiers or tokens.
- Raw role names.
- Raw permission codes.
- Membership reference numbers.
- Registration or tax identifiers.
- Credentials, authentication history, or audit records.

### Capability summary

The capability summary is a fixed projection of exact current permission codes into stable boolean categories:

- Organization view and management.
- People view and management.
- Membership view and management.
- User view and management.
- Access Control view and management.

Capability indicators exist for client navigation and interface presentation only. They do not authorize requests. Every protected endpoint must continue to enforce its own exact server-side permissions.

The projection uses explicit allowlists. It does not infer management capability from arbitrary permission prefixes, role names, or client claims.

### Current-state confirmation

Confirmation reloads the selected membership from the Central Registry with active-person, active-membership, active-organization, non-ended, and non-deleted filters.

If the membership or organization becomes unavailable after initial request-context resolution, confirmation fails with the same concealed membership-unavailable result used by Trusted Request Context.

Identifier mismatches, malformed records, or a persistence result outside the trusted person and organization boundary are integrity failures.

### HTTP behavior

The endpoint:

- Uses `GET` because it performs no state change.
- Requires `OrganizationContextEndpoint` metadata.
- Requires no additional business permission because it reveals only the already validated selected context.
- Uses `Cache-Control: no-store`.
- Uses the standard success response envelope.
- Remains protected by HTTPS, proxy trust, request framing, throttling, stable errors, and the existing HTTP security boundary.

## Alternatives Considered

### Return raw effective permissions

Rejected. Raw permission disclosure creates unnecessary coupling, reveals internal authorization structure, and invites clients to treat browser state as authority.

### Return role names

Rejected. Roles are permission bundles and may be organization-specific. Business behavior must not depend on hardcoded role names.

### Store a selected organization in the session

Rejected for this slice. Membership selection remains explicit per organization-scoped request. Persisted defaults and recent-organization behavior require separate product and lifecycle decisions.

### Trust the discovered organization identifier directly

Rejected. Membership discovery presents choices only. Organization identity must still be derived again from the validated membership through Trusted Request Context.

### Add a new standalone context-confirmation module

Rejected. Confirmation is part of the Trusted Request Context platform responsibility and does not justify another module, database owner, or dependency boundary.

## Consequences

### Positive

- Clients can confirm the selected organization safely.
- Organization identity remains derived from server-validated membership data.
- Raw authorization internals remain concealed.
- Frontends receive stable navigation hints without becoming authorization engines.
- Current membership and organization availability are checked again at confirmation time.
- No new source of truth, table, migration, cache, or role dependency is introduced.

### Negative

- Capability categories require deliberate maintenance when new foundation capabilities are approved.
- Clients cannot reconstruct every permitted action from the confirmation response.
- Membership selection remains explicit on each organization-scoped request.
- The confirmation read adds another small database query after request-context resolution.

## Security Rules

- The endpoint requires a valid authenticated session and selected active membership.
- The caller cannot provide trusted user, person, organization, role, permission, status, or capability data.
- Returned membership, person, and organization identifiers must match trusted organization context.
- Missing or newly inactive selections fail closed.
- Raw permission codes and role names are never returned.
- Capability booleans are advisory only and never replace endpoint permission checks.
- Capability derivation uses exact approved permission codes.
- Responses use `Cache-Control: no-store`.
- No session token, CSRF secret, credential, or authentication history is returned or persisted.

## Deferred

- Preferred or default organization selection.
- Recent organization ordering.
- Organization hierarchy and branch presentation.
- Context persistence across browser sessions.
- Capability categories for future business-domain modules.
- Permission-scope presentation.
- Platform-operator context.
- End-to-end browser and reverse-proxy deployment tests.

## Related Decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0010: Define Authentication and User Identity Strategy.
- ADR 0015: Consolidate Roles and Permissions into Access Control.
- ADR 0018: Build Trusted Request Context Foundation.
- ADR 0019: Build HTTP Security Boundary.
- ADR 0020: Build Bounded Authentication HTTP Endpoints.
- ADR 0021: Build Account Membership Discovery.

## Tenant boundary amendment

ADR 0027 adds the server-derived `tenant_id` to organization context confirmation. The Tenant must remain active, and the confirmed membership and Organization must match the trusted Tenant boundary.
