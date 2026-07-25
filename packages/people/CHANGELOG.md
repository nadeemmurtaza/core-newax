# Changelog

All notable changes to the NEWAX People module are documented here.

## Unreleased

### Added

- Tenant-scoped `CorePersonRelationship` storage for family, guardian, spouse, sibling, dependent, and other directed person links.
- Relationship role, basis, validity, verification, verifier, and source-reference fields.
- Database protection against self-links, invalid validity ranges, inconsistent verification, duplicate current relationships, and active parentage cycles.
- Focused schema and migration regression tests.
- Bounded `CurrentPersonRequestContext` and `CurrentPersonProfile` contracts.
- `PeopleService.getCurrent` for authenticated account self-profile access.
- `GET /api/core/people/current` through trusted account context.
- Focused package and controller tests for current-person retrieval and boundary enforcement.

### Security

- Self-profile access is separate from organization-wide `people.view` authority.
- Trusted actor and linked-person UUIDs are validated before persistence access.
- Missing, inactive, archived, suspended, or deleted people fail closed.
- Repository records must match the trusted person boundary.
- Every query parameter, including client-supplied person selection, is rejected.
- Responses exclude identifiers, date of birth, gender, contacts, addresses, authentication data, sessions, memberships, organizations, roles, permissions, timestamps, audit fields, and deletion metadata.
- Responses use `Cache-Control: no-store`.

### Database

- Adds `core_person_relationships` as a People-owned, Tenant-scoped relationship registry.
- Keeps official identifiers in `core_person_identifiers` rather than duplicating them in family links.
- Reuses the existing `core_people` Central Registry table.
- Adds no schema change, migration, cache, or alternative source of truth.

## 0.1.0 - 2026-07-11

### Added

- Reusable people service contracts and permission definitions.
- Person creation, retrieval, listing, update, and archive operations.
- Person identifier creation, listing, and verification operations.
- Input normalization and date validation.
- Duplicate-sensitive identifier assignment contracts.
- Person lifecycle and identifier events.
- Repository and event-publisher ports.
- Unit tests for core service behaviour.
- Prisma application adapter and NestJS module composition.

### Security

- Protected operations require explicit `people.*` permissions.
- Identifier viewing and management use separate permissions.
- Competing identifier assignments are serialized in PostgreSQL before duplicate checks.
- Public HTTP controllers remain disabled until trusted authentication and permission context exist.

### Database

- Uses the existing `core_people` and `core_person_identifiers` Central Registry tables.
- Does not modify domain profile or transaction tables.
