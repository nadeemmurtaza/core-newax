# ADR 0047: Establish Analytics Rollup Store

## Purpose

Establish how NEWAX aggregates activity from every project domain for cross-project reporting,
without core reading project databases and without reporting requirements distorting operational
models.

## 1. Decision Title

ADR 0047: Establish Analytics Rollup Store

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 gives every project its own database and ADR 0039 prohibits core from reading them.
That is correct for operational purposes and creates an obvious gap: NEWAX cannot report across
projects.

Cross-project reporting is a real requirement. How many people who arrived through one project
converted in another, how a tenant's activity compares across the systems they use, and how a
campaign performed across every surface are all questions no single project can answer.

ADR 0045 already establishes touchpoints and attribution in core, which covers person-level
journeys. It does not cover aggregate operational reporting, which is a different shape of
question over a different volume of data.

## 5. Problem

The obvious solutions each break something the architecture protects.

**Core queries project databases directly.** Rejected by ADR 0039, and for good reason: it couples
core to every project's physical schema and makes core's reporting a reason projects cannot change
their tables.

**Reporting runs against operational tables.** Reporting queries are large, scan-heavy, and
unpredictable. Running them against operational tables means a report degrades the system it is
reporting on, and reporting requirements start shaping the operational schema.

**Each project reports on itself.** Produces per-project reports that cannot be combined, because
nothing reconciles definitions across them.

There is also a boundary question. Touchpoints in the Growth domain and analytics events look
similar, and without a stated distinction one absorbs the other: either operational tables grow
into a reporting store, or reporting becomes the system of record.

## 6. Decision

NEWAX establishes an analytics rollup store in Core, populated by telemetry that projects submit.

**Projects push telemetry; core never pulls.** Telemetry travels the same inbound path as other
submissions, defined by ADR 0040, and is appended to the rollup store rather than adjudicated
against canonical records. Core reads no project database, for reporting or for anything else.

**Telemetry conforms to a published schema.** A project emits events conforming to the contract,
carrying `tenantId` and `project_key` so every fact is attributable. Project-specific event shapes
are not accepted, because facts that cannot be compared cannot be combined.

**The rollup store is derived, never authoritative.** It holds no fact that exists nowhere else.
Losing it entirely is a rebuild, not data loss. This is what allows it to be reshaped as reporting
needs change.

**The rollup store is separate from operational tables.** Reporting queries do not run against
operational data, and reporting requirements do not shape operational schemas.

**The boundary with Growth is by purpose, not by shape.** A conversion is a Growth fact: it drives
consent-gated forwarding and attribution, and it is operational. Its contribution to a funnel
count is an analytics fact. The same real-world event may produce both, and that duplication is
correct rather than redundant.

**Tenant boundaries hold in reporting.** Aggregates never combine tenants except in NEWAX-internal
reporting that is explicitly permission-gated and never exposed to a tenant.

**L5 is optional.** A project is not required to be rolled up. Reaching L5 is a declared level with
a conformance suite, not an obligation of existing.

## 7. Reasoning

Push rather than pull follows directly from ADR 0039. The prohibition on core reading project
databases is what lets projects evolve their schemas, and making an exception for reporting would
remove that freedom for the least urgent reason.

A published telemetry schema is what makes aggregation meaningful. Accepting arbitrary
project-specific shapes produces a store containing everything and comparable in nothing, which is
the failure mode of most event collection.

Keeping the store derived is what keeps it changeable. A reporting store that holds the only copy
of a fact cannot be restructured, so it accumulates schema decisions that were correct once. A
derived store can be rebuilt from telemetry when reporting needs change.

Separating the store from operational tables protects both. Reporting cannot degrade operations,
and reporting requirements cannot distort the operational model, which is the more insidious of the
two problems.

Stating the Growth boundary by purpose prevents the two domains collapsing into each other. Without
it, either the operational touchpoint table becomes a reporting store or reporting becomes
authoritative, and both are worse than duplication.

## 8. Alternatives Considered

**Core queries project databases directly for reporting.** No telemetry pipeline required.
Rejected because it violates ADR 0039, couples core to every project's physical schema, and makes
core reporting a reason projects cannot change their tables.

**Change-data-capture from every project database into a warehouse.** Efficient and requires no
project-side work. Rejected because it replicates physical schemas rather than meaningful facts,
so every project schema change breaks the pipeline, and it captures rows rather than events.

**A third-party analytics platform as the store.** Avoids building one. Rejected as the platform
decision because tenant-scoped person-level data would leave NEWAX control, and because it still
requires the canonical telemetry schema this ADR defines. It remains available as a consumer of the
rollup store.

**Extend the Growth touchpoint model to serve reporting.** Avoids a second store. Rejected because
it puts scan-heavy reporting queries on operational tables and lets reporting requirements shape an
operational model.

**Defer cross-project analytics entirely.** Rejected not because reporting is urgent, but because
projects would meanwhile emit whatever telemetry suited them, and the schema would then have to be
retrofitted across every project.

## 9. Consequences

Positive:

- Cross-project reporting becomes possible without core reading project databases.
- Reporting load is isolated from operational systems.
- The store can be reshaped as reporting needs change, because it is derived.
- Every fact is attributable to a tenant and a project.
- Projects keep full freedom over their own schemas.

Cost:

- A telemetry pipeline and a rollup store to build and operate.
- Projects at L5 must emit conforming telemetry, which is project-side work.
- Telemetry volume is the highest in the platform and needs retention and partitioning.
- Aggregates are eventually consistent and will not match operational counts exactly at any instant.
- Some duplication between Growth touchpoints and analytics facts, accepted deliberately.

## 10. Impact On NEWAX Core

The rollup store is a reporting-layer concern depending on the inbound path from ADR 0040 and on
tenant and project identity. Nothing operational depends on it, which is deliberate: an outage of
the rollup store must not affect operations.

## 11. Impact On Client Systems

A client gains reporting across every NEWAX system they use, in one place with consistent
definitions.

Reported figures may lag operational reality. Interfaces must state as-of times rather than
implying live figures.

## 12. Security Considerations

Telemetry carries tenant-scoped, person-level behavioural data and is sensitive despite being
aggregate in purpose.

Tenant isolation must hold in the rollup store and in every query against it. A reporting query
that omits a tenant filter is a cross-tenant disclosure, and this is the most likely place for such
a mistake because reporting queries are written ad hoc.

Cross-tenant aggregates are NEWAX-internal only, permission-gated, and never exposed to a tenant.

Telemetry payloads must carry the minimum needed for reporting. Sending an entire record because it
is convenient widens exposure permanently, since analytics stores are retained.

Access to the rollup store is permission-gated. Class E consumers receive rollup access only and
never operational reads.

## 13. Scalability Considerations

Telemetry is the highest-volume data in the platform and grows with activity rather than customer
count. It requires partitioning, a retention position, and aggregation into summaries rather than
querying raw events for common reports.

Ingestion must absorb bursts without backpressure reaching the emitting project. A project's write
path never waits on telemetry acceptance.

The rollup store is the most likely component to outgrow PostgreSQL. Because it is derived and
non-authoritative, moving it to a dedicated analytical store is a contained change rather than a
migration of system-of-record data. That move requires its own ADR.

## 14. Maintenance Considerations

Telemetry schemas evolve, and historical data was written under earlier versions. Queries must
handle version skew, or the store silently reports on a subset of its history.

Aggregation definitions need owners. An aggregate whose definition nobody can state is a number
nobody should act on.

Retention must be decided early. Analytics stores grow monotonically, and deciding retention after
the fact means deleting data someone has already built a report on.

## 15. Related Documents

- [Growth and Measurement Architecture](../architecture/growth-and-measurement-architecture.md)
- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [ADR 0035: Adopt Database-Per-Project Topology](0035-adopt-database-per-project-topology.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](0041-define-project-integration-classes-and-conformance-levels.md)
- [ADR 0045: Establish Growth Domain](0045-establish-growth-domain.md)

## 16. Approved By

NEWAX Engineering and Architecture.
