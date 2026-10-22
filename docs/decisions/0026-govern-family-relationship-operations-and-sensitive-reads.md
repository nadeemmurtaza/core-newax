# ADR 0026: Govern Family Relationship Operations and Sensitive Reads

- Status: Accepted
- Date: 2026-07-16
- Decision owners: NEWAX Core Architecture
- Depends on: ADR 0025 and PR #46

## Context

The Central People Registry can represent tenant-scoped relationships between people, and the People Intake workflow can stage and independently verify proposed family information. The platform still lacks a canonical service boundary for applying approved relationships, reading a bounded family graph, correcting relationship metadata, ending relationships without deleting history, and selectively disclosing sensitive identifiers.

Direct database access would bypass permission checks, Tenant and Organization scope, optimistic concurrency, audit events, and the relationship integrity constraints established in the database. A broad person-read permission would also expose more family information than many operational roles require.

## Decision

NEWAX will add governed family-relationship operations to the reusable People module and expose them through current-Organization HTTP endpoints.

The service boundary will:

1. Derive actor, Tenant, and Organization authority only from Trusted Request Context.
2. Require separate permissions for relationship viewing, relationship management, verification, and sensitive identifier disclosure.
3. Treat a relationship as a historical business fact. Ordinary corrections update controlled metadata with optimistic concurrency; ending a relationship changes its lifecycle status and validity rather than deleting the row.
4. Preserve PostgreSQL enforcement for self-links, duplicates, validity, verification state, and parentage cycles.
5. Return bounded family projections. Summary and graph responses omit full official identifier values unless the caller has the dedicated sensitive permission.
6. Keep relationship access distinct from organization membership, account access, roles, and permissions.
7. Record mutation events and audit metadata without logging CNIC, CRC, passport, or other sensitive values.
8. Keep certificate ingestion, evidence-file attachment, duplicate-person merging, and family-tree visualization in later dependent slices.

## Permissions

The slice introduces permission codes with the following intent:

- `people.relationships.view`: view bounded family relationships and non-sensitive person identity fields.
- `people.relationships.manage`: create, correct, or end relationships.
- `people.relationships.verify`: verify or revoke verification metadata through an authorized workflow.
- `people.family_sensitive.view`: view approved sensitive person fields and official identifier values required for authorized verification work.

A role may bundle these permissions, but service and HTTP authorization evaluate permission codes, never role names.

## Organization scope

A relationship is Tenant-owned. A current-Organization family graph must begin at a root person who has an active membership in that Organization. The graph may then traverse active Tenant-owned relationships to relatives who are not Organization members. A relationship mutation requires at least one endpoint to have an active membership in the current Organization. This allows legitimate parent, child, guardian, spouse, sibling, and dependent records without granting Organization users a way to select an unrelated Tenant-owned family as the starting point.

The reachability query and its service tests are part of this slice. Approved-intake reachability may be added later when approved intakes can be canonically applied.

## Consequences

### Positive

- Family information becomes accessible through a reusable, permission-driven service rather than direct SQL.
- Sensitive disclosure is narrower than general People access.
- Relationship corrections retain history and concurrency protection.
- Later import, evidence, deduplication, and visualization slices receive a stable API contract.

### Costs

- Organization reachability must be enforced consistently in every read and mutation.
- Sensitive projections require dedicated tests and careful cache controls.
- Historical correction and verification transitions add service and repository complexity.

## Verification evidence

Acceptance is supported by:

- Unit tests for permission, validation, state, sensitive-field redaction, graph scope, and optimistic-concurrency behavior.
- PostgreSQL migration and integrity tests for versioning, verification state, verification-revocation ownership, and restrictive foreign-key behavior.
- HTTP input tests for bounded graph options, dates, and unsupported client fields.
- Full application-composition tests proving Request Context is available to the controller.
- Complete repository formatting, lint, type-check, tests, builds, migrations, and database-registry generation against the exact final pull-request head.
