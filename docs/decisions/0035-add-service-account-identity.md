# ADR 0035: Add Service Account Identity

## 1. Decision Title

Add a `CoreServiceAccount` entity so machine/integration identities are never represented as a
`CorePerson`.

## 2. Status

Accepted

## 3. Date

2026-07-28

## 4. Context

The Lead Harvester integration (ADR-pending sync feature) needs a `CoreUser` to act as
`actorUserId`/`createdByUserId` across the many existing foreign keys that record "who did
this" (`CoreAuditLog.actorUserId`, `CoreFile.createdByUserId`, `CoreRolePermission.createdByUserId`,
`CoreMembershipRole.assignedByUserId`, and others), and a `CoreMembership` so its rights can be
evaluated through the same `PermissionEvaluator`/`CoreRole`/`CoreRolePermission`/
`CoreMembershipRole` chain a human's request context uses — no separate, parallel authorization
mechanism for machine callers.

Before this ADR, `CoreUser.personId` and `CoreMembership.personId` were both required, non-null
foreign keys to `CorePerson`. Satisfying them for a machine integration meant creating a
`CorePerson` row with placeholder human-shaped fields (`firstName`/`lastName`) to represent
"the Lead Harvester sync service" — which is exactly what NEWAX's identity model says not to do:
a person is a real human, and a machine integration must not be disguised as one. `core_people`
existing as the _only_ path to a `CoreUser`/`CoreMembership` was a gap surfaced by this being the
first machine-to-machine integration NEWAX Core has needed, not a deliberate prior decision.

## 5. Decision

### 5.1 Scope

- A new `CoreServiceAccount` table: `id`, optional `tenantId` (a service account may be scoped to
  one tenant, like this integration's, or left tenant-less for a platform-level integration),
  `name`, optional `description`, `status`, timestamps.
- `CoreUser.personId` becomes nullable; add nullable, unique `CoreUser.serviceAccountId`.
- `CoreMembership.personId` becomes nullable; add nullable `CoreMembership.serviceAccountId`.
- A database check constraint on both tables enforcing exactly one of `person_id` /
  `service_account_id` is set — a `CoreUser` or `CoreMembership` row represents a human **or** a
  service account, never both, never neither.
- No existing `*_user_id` foreign key elsewhere in the schema changes shape — they all still
  point at `core_users.id`. A service-account-backed `CoreUser` is still a `CoreUser`; every
  existing audit/attribution column keeps working unchanged.

### 5.2 Why extend `CoreUser`/`CoreMembership` rather than build a parallel track

An earlier option considered was giving service accounts their own independent role-assignment
and audit-attribution path, entirely separate from `CoreUser`/`CoreMembership`. Rejected because
it would require touching every existing `*_user_id`/`*_membership_id` foreign key in the schema
(dozens of columns across audit, files, role permissions, membership roles, object assignments)
to accept a second actor type, which is a far larger blast radius than making two existing
foreign keys nullable and adding one new table. This keeps the change additive to the foundation
rather than a rewrite of it.

### 5.3 What this does not change

- Human authentication (`core_user_sessions`, password/OAuth login) is untouched — session
  validation only ever produces `CoreUser`/`CoreMembership` rows with `personId` set, since a
  service account never logs in interactively.
- `TrustedRequestContextService`'s human-authentication path is untouched; it keeps assuming
  `personId` is present, because it only ever resolves rows reachable from a session token, and
  service-account rows are never reachable that way.
- Permission evaluation (`PermissionEvaluator.evaluate(membershipId)`) does not read `personId` at
  all — it only needs `organizationId` and `status` — so no change was needed there for a
  service-account-backed membership to be evaluated identically to a human one.

## 6. Consequences

- Every future machine/integration identity (not just Lead Harvester) has a real, documented path
  that doesn't require inventing a fake person.
- `CoreUser.personId`/`CoreMembership.personId` being nullable means any code that previously
  assumed those fields are always present must be reviewed — in practice this is scoped to the
  human-authentication path, which never touches a service-account row, but the type change is
  real and callers were audited as part of landing this ADR.
