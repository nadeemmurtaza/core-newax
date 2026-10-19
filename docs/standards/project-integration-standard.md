# NEWAX Project Integration Standard

## Purpose

Define what a NEWAX project domain must implement to integrate with the Core NEWAX Database at
each conformance level, and what it must never do.

This document is a standard only. It does not create production code, actual environment files,
secrets, deployment scripts, or infrastructure automation.

## Scope

This standard applies to every project domain registered in `registry/project-registry.json`,
regardless of language, framework, or repository.

Obligations are determined by the project's integration class and conformance level, defined by
ADR 0041. A project implements the obligations for its class at its declared level and no more.

## 1. Universal Rules

These apply to every project at every level, in every class.

- A project holds no credentials to the Core NEWAX Database.
- A project never opens a database connection to another project's database.
- Foreign data wrappers, `dblink`, cross-database views, and shared connections are prohibited.
- A project references core records by their core UUID in a plain column, never by a foreign key
  across the boundary.
- A project uses the generated client library. It does not hand-write a Core API client, an event
  envelope, or a signature implementation.
- A project does not modify, fork, or patch a generated client. A missing capability is added to
  the contract.
- A project pins the contract version it was generated against.
- A project's `project_key` is immutable once assigned.

## 2. Naming Rules

- Mirror tables are prefixed `core_mirror_`, followed by the core entity name:
  `core_mirror_people`, `core_mirror_organizations`.
- Columns referencing core records are named for the core entity: `core_person_id`,
  `core_organization_id`, `core_tenant_id`.
- A project's own tables use its domain prefix, per `docs/standards/data-model-naming-standard.md`.
  A project table is never prefixed `core_`, because that prefix is reserved for shared foundation
  tables and using it hides ownership.

## 3. Level Obligations

### L0: Registered

- An entry exists in `registry/project-registry.json` with a `project_key`, an integration class,
  a target conformance level, and an owner.
- The entry is truthful about current state. A `planned` project does not claim `active`.

### L1: Identity consumer

- Tokens are validated against Core. A project never trusts a client-supplied tenant, person, or
  user identity as authority.
- Trusted request context carries both `tenantId` and `organizationId` derived server-side, per
  ADR 0027.
- An inactive or deleted tenant invalidates context even where local records remain active.
- Identity resolution failures fail closed. An unresolvable identity is never treated as anonymous
  access to scoped data.

### L2: Mirror consumer

Available to Class A only.

- A consumer applies Core events to `core_mirror_*` tables and is the only writer of those tables.
- The consumer is idempotent, keyed on `eventId`. Applying an event twice produces the same result.
- Events concerning the same core record are applied in production order.
- A durable cursor records applied position and survives restarts.
- Merge events are applied. A project that ignores merges accumulates stale references.
- Delete and archive events are applied.
- An event that cannot be applied moves to a dead-letter queue after bounded retries. It does not
  block the cursor indefinitely and is not discarded.
- A reconciliation job compares mirror state against Core and reports drift as a defect.
- A declared staleness threshold exists. Lag beyond it is a defect, not a normal state.
- Unresolved-reference behaviour is documented per reference, per ADR 0037. Rejecting, deferring,
  or recording a data-quality defect are acceptable. Treating the reference as absent or valid is
  not.
- Backfill converges with the stream without a gap: snapshot at a known log position, then apply
  the log forward from it.

### L3: Master-data contributor

Available to Class A and, through a Core-owned adapter, Class D.

- Submissions go through a durable project outbox, written in the same transaction as the change
  that caused them.
- The same `eventId` is reused across every retry of a logical submission.
- Submissions are signed per `docs/standards/core-data-contract-standard.md`.
- Submitted records are candidates. A project never assumes its submission became a canonical
  record, and never treats a local candidate as canonical.
- The project maintains its mapping between its local identifiers and core identifiers.
- Dedupe keys are supplied so Core can adjudicate matches.
- A failed submission never breaks the project's write path.

### L4: Measured

- The project emits canonical Growth events as defined by the contract, rather than
  project-specific event names.
- Consent state is propagated with the event. A project never forwards to a destination directly.
- The project holds no destination credentials. Forwarding is performed by Core.

For Class C, this level is reached by registering a measurement container in Core, not by shipping
integration code.

### L5: Rolled up

- Telemetry conforms to the published schema.
- Telemetry carries `tenantId` and `project_key`.
- Telemetry is submitted through the inbox. Core never reads the project database.

## 4. Class Notes

**Class A.** The full surface. All levels available.

**Class B.** The device store is not a project database. It cannot hold a platform subscription,
it is frequently offline, and its contents are outside NEWAX operational control. A Class B
project synchronises through a cursor and must declare a conflict policy stating which side wins
and what happens to a losing local change. It does not consume the Core delivery log and does not
reach L2 or L3.

**Class C.** No database, therefore no mirrors and no consumer. Integration is measurement
registration plus read-only client library calls.

**Class D.** Outside NEWAX code control. The adapter is owned by Core. The system holds no Core
credentials and never holds a mirror.

**Class E.** Rollup store access only. No operational reads against Core or any project database.

## 5. Verification

- The conformance suite for the declared level runs in the project's own continuous integration,
  on every change rather than once at onboarding.
- A declared level is a claim until the suite proves it.
- Registry status is promoted through `docs/standards/project-onboarding-checklist.md`.

## 6. What Must Never Happen

- A project must never hold credentials to the Core NEWAX Database.
- Project business logic must never write a `core_mirror_*` table.
- A project must never treat a mirror as authoritative for a write.
- A project must never accept client-supplied tenant identity as authority.
- A project must never mint a new `eventId` per delivery attempt.
- A project must never assume exactly-once delivery.
- A project must never fail on an unrecognised payload field.
- A project must never hold destination credentials for a measurement platform.
- A project must never silently discard a dead-lettered message.
- A project must never claim a conformance level the suite has not proved.
- A project must never work around a platform gap locally. The gap is fixed in the platform.

## 7. Related Documents

- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Core Data Contract Standard](core-data-contract-standard.md)
- [Project Onboarding Checklist](project-onboarding-checklist.md)
- [Data Model Naming Standard](data-model-naming-standard.md)
- [ADR 0037: Define Cross-Database Reference Rules](../decisions/0037-define-cross-database-reference-rules.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](../decisions/0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](../decisions/0041-define-project-integration-classes-and-conformance-levels.md)
