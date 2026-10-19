# ADR 0037: Define Cross-Database Reference Rules

## Purpose

Define how a record in a project database references a record in the Core NEWAX Database, now
that ADR 0035 places them in separate databases where PostgreSQL cannot enforce a foreign key.

## 1. Decision Title

ADR 0037: Define Cross-Database Reference Rules

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 establishes one database per project domain. Project records still need to refer to
Central Registry records: an enrolment refers to a person, an order refers to an organization, a
message refers to a contact method.

Within a single database this is a foreign key. Across databases it cannot be. PostgreSQL has no
mechanism to enforce referential integrity between two databases, and the failure mode when this
is ignored is silent: a reference points at a record that does not exist, or that was merged, or
that was deleted, and nothing reports it.

The Central Registry already contains `core_external_references`, established by ADR 0034, which
governs how core records map to identifiers owned by external systems. That table addresses the
outward direction. This ADR addresses the inward direction: how a project record points at a core
record.

## 5. Problem

Without explicit rules, each project invents its own answer, and the three plausible answers are
all wrong in different ways.

Copying the core record into the project table produces divergence the moment core changes.

Storing the core identifier with no defined semantics produces references that cannot be
validated, cannot be reconciled, and break silently when a core record is merged.

Attempting cross-database constraints through foreign data wrappers or a shared connection
reintroduces exactly the coupling ADR 0035 removed, with worse failure characteristics.

Projects also need to know what to do when a reference resolves to nothing, and that behaviour
must be defined rather than left to whichever code path notices first.

## 6. Decision

NEWAX adopts four rules for references that cross a database boundary.

**Rule 1. Store the core identifier in a plain column.**

A project table referencing a Central Registry record stores the core UUID in a column named for
the core entity: `core_person_id`, `core_organization_id`, `core_tenant_id`. The column is a UUID.
It carries no database-level foreign key constraint, because none can exist.

**Rule 2. Never create a database constraint across the boundary.**

Foreign data wrappers, `dblink`, cross-database views, and shared connections between a project
database and the Core NEWAX Database are prohibited. A project holds no credentials to the Core
NEWAX Database.

**Rule 3. Integrity is maintained by consumers and reconciliation, not by constraints.**

Correctness across the boundary is produced by three mechanisms working together:

- An idempotent consumer that applies Central Registry changes in order, so mirror rows converge
  on core state.
- A reconciliation process that periodically compares project references against core state and
  reports drift as a defect rather than repairing it silently.
- An explicit merge behaviour, so that when core merges two records the surviving identifier
  propagates to every project holding the losing identifier.

**Rule 4. Unresolved references must fail visibly.**

Every project must define, per reference, what happens when the referenced core record is not
present in its mirror. Rejecting the operation is acceptable. Deferring it for retry is
acceptable. Recording it as a data-quality defect is acceptable. Treating the reference as null,
absent, or valid is not.

## 7. Reasoning

The rules follow from accepting a fact rather than working around it: referential integrity
across databases is an application responsibility, and the only honest design is one that says so
and then builds the machinery.

Naming the column after the core entity makes the boundary visible in the schema itself. A
developer reading `core_person_id` in a project table can see that the value is owned elsewhere,
which a bare `person_id` would hide.

Prohibiting foreign data wrappers matters more than it appears. They are the obvious shortcut,
they work in development, and they silently rebuild the coupling that database-per-project
removed, while adding a failure mode where one database being unavailable breaks queries in
another.

Requiring visible failure for unresolved references is the rule that prevents slow corruption. An
eventually consistent mirror means a reference can legitimately arrive before its target. That is
tolerable when the system knows it is happening and intolerable when it silently produces wrong
results.

## 8. Alternatives Considered

**Foreign data wrappers to enforce constraints.** Rejected because it recreates cross-database
coupling, makes one database's availability a dependency of another's queries, and gives projects
read access to core data that the mirror model deliberately bounds.

**Duplicating full core records into project tables without a mirror contract.** Rejected because
the copy diverges immediately and there is no defined mechanism to converge it.

**Requiring a synchronous Core API call for every reference resolution.** Rejected because it
makes every project query depend on core availability and makes local joins impossible, which is
the specific problem the mirror model exists to solve.

**Leaving the rules to each project.** Rejected because it is the current state, and it has
already produced divergent person, contact, and address concepts across project domains.

## 9. Consequences

Positive:

- The boundary is visible in schema naming.
- Failure modes are defined rather than discovered.
- Merge propagation has a defined path.
- Projects remain queryable when core is unavailable.
- Drift is detected and reported rather than accumulating.

Cost:

- The database no longer prevents an invalid reference; application code and reconciliation must.
- Every project must implement reconciliation and unresolved-reference handling.
- Merge handling must be designed rather than inherited from cascade rules.

## 10. Impact On NEWAX Core

Core must publish enough information for projects to maintain correct references, which
specifically includes record merges. A merge that core performs without publishing it leaves
every project holding a stale identifier.

`core_external_references` and this ADR are complementary and must not be confused.
`core_external_references` records how a core record is known to an external system.
This ADR governs how a project record points back at a core record.

## 11. Impact On Client Systems

Client-facing behaviour must account for eventual consistency. A record created in core may not
be immediately visible in a project, and interfaces must not present that delay as an error where
it is expected.

## 12. Security Considerations

Prohibiting cross-database connections is a security control as well as an architectural one. A
project compromised at the database layer cannot reach the Central Registry, because it holds no
credentials for it.

Mirrors bound exposure: a project holds only the core data it subscribes to, so a project
compromise does not expose the whole Central Registry.

Reconciliation output describes core records and must be treated as sensitive. It is operational
evidence, not a debug log to be emitted freely.

## 13. Scalability Considerations

Plain UUID columns index and join exactly like any other column, so local joins against mirror
tables stay fast as project data grows.

Reconciliation cost grows with reference count and must be incremental, scoped by tenant or by
time window, rather than a full comparison of every project against core.

## 14. Maintenance Considerations

The rules must be enforced by review and, where possible, by automated checks: a project schema
containing a cross-database extension or a core-owned table without the mirror prefix is a defect
that tooling can detect.

Unresolved-reference behaviour must be documented per project rather than held as tribal
knowledge, because it is the behaviour most likely to be reinvented incorrectly.

## 15. Related Documents

- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Data Model Naming Standard](../standards/data-model-naming-standard.md)
- [ADR 0034: Build External References Governance Foundation](0034-build-external-references-governance-foundation.md)
- [ADR 0035: Adopt Database-Per-Project Topology](0035-adopt-database-per-project-topology.md)
- [ADR 0036: Establish Project Identity and Registry](0036-establish-project-identity-and-registry.md)

## 16. Approved By

NEWAX Engineering and Architecture.
