# NEWAX People Module

## Status

Draft reusable foundation module.

Version: `0.2.0`

## Purpose

The People module maintains one stable identity record for each real person and governed, tenant-scoped relationships between people used across NEWAX business infrastructure.

A person may participate in multiple organizations, hold multiple memberships, and have a login account, but those concerns remain outside this module. Domain modules such as LMS, HR, Healthcare, Legal, CRM, and Finance reference the shared person through `person_id` instead of duplicating identity data.

## Owned concepts and data

The module owns:

- Human identity records.
- Person lifecycle status.
- Person identifiers such as national identifiers, passports, and professional registration numbers.
- Identity validation and duplicate-sensitive identifier assignment.
- Tenant-scoped person relationships such as parent, guardian, spouse, sibling, and dependent links.
- Relationship validity, verification, provenance, and cycle protection.
- A bounded current-person self-profile projection.
- People permission definitions.
- Person lifecycle and identifier events.

Database ownership:

- `core_people`
- `core_person_identifiers`
- `core_person_relationships`

The module does not own users, authentication, memberships, roles, contacts, addresses, student profiles, employee profiles, patient profiles, or business transactions.

## Public module API

The package exports:

- `PeopleService`
- `PeopleRepository`
- `PersonEventPublisher`
- Person request, response, persistence, and event contracts
- `PEOPLE_PERMISSIONS`
- `PeopleModuleError`

Primary operations:

```text
create
getById
getCurrent
list
update
archive
addIdentifier
listIdentifiers
verifyIdentifier
```

## Permissions and self-access

Organization-wide People Registry operations require explicit permissions:

```text
people.view
people.create
people.update
people.archive
people.identifiers.view
people.identifiers.manage
```

Roles may bundle these permissions, but the module never authorizes actions through role names.

`getCurrent` is intentionally separate from organization-wide `people.view`. It accepts only a trusted actor user identifier and the person identifier already linked to that authenticated account by Trusted Request Context. It does not accept a client-selected person identifier, organization permission set, role, membership, or tenant authority.

## Current-person rules

- The trusted actor and linked person identifiers must be valid UUIDs.
- The linked person is reloaded from the Central Registry source of truth.
- The person must still exist, remain active, and have no deletion marker.
- The repository result must match the trusted person identifier.
- Malformed trusted context or repository boundary mismatches fail as integrity errors.
- The bounded profile contains only person ID, first name, optional middle name, last name, optional preferred name, and active status.
- Date of birth, gender, identifiers, contacts, addresses, credentials, sessions, memberships, organizations, roles, permissions, audit metadata, deletion metadata, and timestamps are excluded.

## Identity rules

- First and last names are required.
- Date of birth cannot be in the future.
- Archived people cannot be updated or receive new identifiers.
- Identifier types are normalized to lowercase machine-readable codes.
- Identifier values are stored in canonical uppercase form without spaces or hyphens.
- Country codes use two uppercase letters.
- Identifier validity end dates cannot precede start dates.
- The PostgreSQL adapter serializes competing assignments for the same normalized identifier using a transaction-scoped advisory lock.
- The same identifier cannot be assigned to two people within the same type, issuing-country, and issuing-authority scope.

The module deliberately does not perform probabilistic person matching based on names or dates of birth. Similarity is not identity, despite humanity’s recurring optimism about spreadsheets.

## Person relationship rules

A relationship is stored once as a directed statement from one person to another.

Example:

```text
Iqbal Hussain -- parent_of / father / biological --> Zahra Iqbal
```

The relationship record stores only person identifiers and relationship meaning. CNIC, CRC, passport, and other official identifier values remain in `core_person_identifiers` and are never copied into the relationship row.

Database rules:

- Every relationship belongs to one Tenant so family and dependency information cannot leak across customers.
- Source and target must be two different people.
- `relationship_type` defines direction, such as `parent_of`, `guardian_of`, `spouse_of`, `sibling_of`, or `dependent_of`.
- `relationship_role` adds human meaning where needed, such as `father`, `mother`, `parent`, or `legal_guardian`.
- `relationship_basis` records the basis, such as `biological`, `adoptive`, `step`, `legal`, or `declared`.
- At most one active record may express the same directed relationship, role, and basis within one Tenant, even when an end date is scheduled.
- Validity end dates cannot precede start dates.
- Verified relationships require a verification time and source; unverified relationships cannot claim a verification actor or time.
- Active `parent_of` relationships cannot create ancestry cycles, including concurrent writes within the same Tenant.
- A family relationship never grants organization membership, login access, a role, or a permission.
- `source_reference` is an optional opaque evidence reference. It must not be used to duplicate a person's CNIC or CRC.

The database stores the relationship foundation only. Service operations, authorization, HTTP exposure, reciprocal-display rules, and evidence-file linking remain separate controlled slices.

## Events

The module publishes:

```text
person.created
person.updated
person.archived
person.identifier_added
person.identifier_verified
```

Events include the actor user, person identifier, occurrence time, and resulting person or identifier record.

The initial application adapter records events through structured application logging. Durable event delivery and transactional outbox support remain deferred until the shared Events capability is implemented.

Current-person reads do not publish lifecycle events because they do not mutate person state. HTTP access is still covered by the shared HTTP Security audit boundary.

## Dependencies

The reusable package has no dependency on another business domain.

The NestJS application adapter depends on:

- The API Database Module.
- Prisma-generated database access.
- PostgreSQL Central Registry tables.
- Trusted account context established by the global HTTP Security Boundary.

## HTTP exposure

The API exposes:

```text
GET /api/core/people/current
```

The endpoint:

- Requires an authenticated account session.
- Uses account context rather than organization context.
- Accepts no route person identifier.
- Rejects every query parameter.
- Accepts no client person authority.
- Returns `Cache-Control: no-store`.
- Returns only the bounded current-person profile.

Arbitrary person lookup, search, administration, identifiers, contacts, addresses, and domain profiles remain unexposed.

## Testing

Tests cover:

- Permission rejection for organization-wide operations.
- Person input normalization.
- Future date-of-birth rejection.
- Identifier normalization.
- Cross-person identifier conflict handling.
- Identifier verification and event publication.
- Person-relationship schema ownership and migration constraint coverage.
- Successful verified parent-relationship persistence against PostgreSQL.
- PostgreSQL rejection of self-links, duplicate active links, unverifiable claims, and active parentage cycles.
- Successful current-person self-profile retrieval without `people.view`.
- Trusted actor and linked-person UUID integrity.
- Missing linked-person context.
- Missing, inactive, and deleted current-person records.
- Repository boundary mismatch detection.
- Bounded response-field enforcement.
- Account-context-only HTTP metadata.
- Query-parameter and client person-selection rejection.
- `Cache-Control: no-store` declaration.

Repository CI validates formatting, linting, strict TypeScript, tests, production builds, Prisma schema validity, and database migrations against PostgreSQL 18.

## Client customization

Client-specific student, employee, doctor, lawyer, customer, supplier, or patient fields must remain in their respective domain profiles.

Client fields must not be added directly to `core_people` unless they are universal identity requirements approved through architecture review.

## Known limitations

- Person relationships currently have no service or HTTP operations.
- Reciprocal display, symmetric-relation canonicalization, and evidence-file linking remain deferred.
- Only the bounded authenticated current-person read endpoint is exposed.
- Contacts and addresses remain separate planned modules.
- Authentication and membership consequences of person archival are not yet automated.
- Probabilistic duplicate-person matching and record merging remain deferred.
- Durable module-event persistence remains deferred.
- Arbitrary person administration HTTP endpoints remain deferred.

## Related decisions

- ADR 0001: Use Modular Monolith First.
- ADR 0002: Use Permission-Based Access Control.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0010: Define Authentication and User Identity Strategy.
- ADR 0011: Define Technology Stack and Implementation Baseline.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0013: Build the People Registry Service Foundation.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0024: Build the Current Person Read API.
