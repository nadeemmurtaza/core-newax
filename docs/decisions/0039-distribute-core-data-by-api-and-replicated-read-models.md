# ADR 0039: Distribute Core Data by API and Replicated Read Models

## Purpose

Define how a project domain obtains Central Registry data once ADR 0035 has placed it in a
separate database that the project cannot query.

## 1. Decision Title

ADR 0039: Distribute Core Data by API and Replicated Read Models

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 gives each project domain its own database. ADR 0037 prohibits cross-database
constraints and connections. Together these mean a project can no longer join against
`core_people` or `core_organizations`.

Projects still need core data constantly. An enrolment displays a person's name. An order
displays an organization's address. A message list filters by contact method. These are joins
against core data in the middle of ordinary project queries.

## 5. Problem

Three mechanisms are available and each fails alone.

Calling the Core API for every reference makes core availability a dependency of every project
query, makes local filtering and sorting impossible, and turns one project query into many
network calls.

Giving projects read-only credentials to the Core NEWAX Database restores the coupling ADR 0035
removed, makes core schema changes breaking changes for every project, and grants every project
access to the entire Central Registry rather than the part it needs.

Copying core data into project tables with no defined contract diverges immediately, which is the
state several project domains are already in.

## 6. Decision

Project domains obtain Central Registry data through two mechanisms and no others.

**A Core API, consumed through a generated client library.** Used for writes, for authoritative
reads where freshness matters more than availability, and for data too rarely used or too large
to justify replication.

**Replicated read models, held in `core_mirror_*` tables in the project database.** Used where
the project must join core data against its own data. Mirrors are maintained solely by the
project's Central Registry consumer, applying events delivered by the mechanism defined in
ADR 0040.

Direct project access to the Core NEWAX Database is prohibited. No project is issued credentials
to it. Foreign data wrappers, `dblink`, and shared connections are prohibited, as ADR 0037
already states.

A project subscribes only to the core entities it declares in `registry/project-registry.json`.
Subscription is explicit; a project does not receive the whole Central Registry by default.

Mirror tables are read-only to project business logic. A project changes core data by calling the
Core API, never by writing its mirror.

## 7. Reasoning

The two mechanisms cover different needs and neither covers both. Mirrors provide local joins and
availability; the API provides authority and freshness. Choosing one alone forces the wrong
trade-off for half the use cases.

The prohibition on direct database access is what keeps the core schema changeable. If projects
query core tables, then every core column rename is a breaking change for every project, and the
Central Registry ossifies. A published contract can evolve with compatibility rules; a schema
that others query cannot.

Explicit subscription bounds exposure. A project holding only what it declared is a smaller
breach if compromised and a smaller reconciliation problem in normal operation.

Making mirrors read-only to business logic prevents the most likely form of drift, where a
project writes its mirror for a local reason and the value survives until the next event
overwrites it, or does not.

## 8. Alternatives Considered

**Synchronous API calls only, with no mirrors.** Simplest consistency story. Rejected because
local joins become impossible, core availability becomes a hard dependency of every project
request, and list rendering degenerates into per-row fetches.

**Read-only database credentials to the Core NEWAX Database.** Fastest to build and requires no
new machinery. Rejected because it recreates the coupling ADR 0035 removed, freezes the core
schema, and grants each project far more access than it needs.

**Logical replication or change-data-capture directly from the core database.** Efficient and
requires no API layer for reads. Rejected because it couples projects to the physical core schema
rather than to a published contract, and because it offers no way to bound what a project
receives.

**Each project chooses for itself.** Rejected because it is the current state and has already
produced divergent copies of core concepts across project domains.

## 9. Consequences

Positive:

- Projects join core data locally and stay available when core is not.
- The core schema can evolve behind a published contract.
- Each project's exposure is bounded by its declared subscription.
- Core data has one authoritative copy and defined replicas.

Cost:

- Mirrors are eventually consistent, and projects must handle that visibly.
- Each project must build and operate a consumer and a reconciliation job.
- Core must publish reliably, because projects can no longer fall back to querying it.
- Storage is duplicated, bounded by what each project subscribes to.

## 10. Impact On NEWAX Core

Core gains a publishing obligation. Every change to a subscribed entity must produce an event,
including merges and deletions, because a change core makes without publishing leaves every
mirror wrong.

The Core API becomes a contract with external consumers rather than an internal interface, and
must follow the compatibility rules in `docs/standards/core-data-contract-standard.md`.

## 11. Impact On Client Systems

Client-facing behaviour must tolerate replication delay. A person created in core may not appear
in a project immediately, and interfaces must not present expected delay as failure.

Availability improves overall: a project remains usable during a core outage for everything that
reads from mirrors.

## 12. Security Considerations

Denying database credentials to projects is the primary control. It must be enforced by role
grants, not by convention, because a credential that exists will eventually be used.

Explicit subscription is a data-minimisation control. A project receives only the entities it
declared, so a project compromise does not expose the Central Registry.

Mirrors extend the boundary of sensitive core data into project databases. Each project database
must therefore meet the security baseline appropriate to the most sensitive entity it mirrors,
and subscriptions to sensitive entities require review rather than self-service.

## 13. Scalability Considerations

Mirrors move read load off core entirely. Core serves the event stream once per change rather
than serving every project's read traffic, so core read load does not grow linearly with project
count.

The cost that does grow is fan-out, addressed by ADR 0040, and reconciliation, which must be
incremental rather than a full comparison.

## 14. Maintenance Considerations

Each project operates a consumer, and consumers fail in ways that are quiet: a stalled cursor
looks exactly like a period with no changes. Lag and reconciliation drift must be monitored per
project, with a declared staleness threshold beyond which the mirror is a defect.

Consumer logic is the same in every project of a given class, which is why it belongs in the
generated client and the scaffold rather than being written per project.

## 15. Related Documents

- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Core Data Contract Standard](../standards/core-data-contract-standard.md)
- [ADR 0035: Adopt Database-Per-Project Topology](0035-adopt-database-per-project-topology.md)
- [ADR 0037: Define Cross-Database Reference Rules](0037-define-cross-database-reference-rules.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)

## 16. Approved By

NEWAX Engineering and Architecture.
