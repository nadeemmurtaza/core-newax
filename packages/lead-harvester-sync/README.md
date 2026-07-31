# NEWAX Lead Harvester Sync

## Status

- Version: `0.1.0`
- Lifecycle: Draft
- Layer: Integration orchestration

## Purpose

Orchestrates syncing an inbound Harvester `institution.upserted` event into the Central Registry.
It is the first real consumer of `CoreExternalReference`: every Harvester entity (institution,
branch, contact point, contact person) is mapped to a Central Registry record via a namespaced
external key (`institution:<id>`, `branch:<id>`, `contact:<id>`, `contact-person:<id>`) under the
`lead_harvester` external system and `marketing_leads` domain code.

This package contains no Prisma repository of its own -- it composes the already-built
`@newax/organizations`, `@newax/addresses`, `@newax/contacts`, `@newax/people`,
`@newax/memberships`, and `@newax/external-references` services through narrow collaborator
ports (see `src/collaborators`), each extracted from the real service's own method types so a
signature drift on the underlying service is a compile error here.

## Algorithm

1. Look up the institution's `CoreExternalReference` by tenant (organization-less, since a
   brand-new institution has no organization yet). If found, compare the event's `occurredAt`
   against the mapping's `lastSyncedOccurredAt` metadata -- an out-of-order/stale event is
   rejected before any write (`status: 'stale'`).
2. Not found: `OrganizationsService.create()`, then register the mapping. Found:
   `OrganizationsService.update()`, then repoint the mapping's metadata (domain/website/status/
   lastSyncedOccurredAt) via `updateCurrentOrganizationExternalReferenceEntity` -- safe to mutate
   in place, since a `CoreExternalReference` row is a private 1:1 mapping, not a shared value.
3. Per branch: find-or-create/update via `AddressesService`, relink-not-mutate on value change
   (per that package's own `updateCurrentOrganizationAddress`). If the update relinked to a new
   join-row id, repoint the branch's external reference to follow it.
4. Per contact point: map Harvester's free-text `contact_type` to a supported `ContactType`
   (`email`/`phone`/`whatsapp`/`telegram`); anything else is skipped and reported in the result,
   not treated as a failure. Find-or-create/update via `ContactsService`, same relink-and-repoint
   pattern as branches. If a `personName` is present, split it (last whitespace token as
   `lastName`, the rest as `firstName` -- a documented lossy v1 heuristic) and find-or-
   create/update a `CorePerson` + person contact method + `contact`-type `CoreMembership`, storing
   the membership and person-contact ids in the mapping's metadata so they can be found again on
   the next sync.

## Known v1 limitations

- No delivery durability: a failure partway through leaves a partially-synced institution: the
  outbox/inbox work is tracked as follow-up, not solved here.
- Append-and-update only: removed branches/contacts on the Harvester side are not retired here.
- No cross-record person deduplication: the same real person named on two different contact
  points becomes two separate `CorePerson` rows.
