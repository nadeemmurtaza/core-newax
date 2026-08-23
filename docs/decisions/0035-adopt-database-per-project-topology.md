# ADR 0035: Adopt Database-Per-Project Topology

## Purpose

Define the default database topology for NEWAX project domains and end the ambiguity left by
ADR 0007, which described one project's database strategy without defining the platform default.

## 1. Decision Title

ADR 0035: Adopt Database-Per-Project Topology

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

NEWAX Core is a reusable business infrastructure foundation. The Central Registry defined by
ADR 0008 and implemented from ADR 0012 onward holds tenants, organizations, people, users,
memberships, roles, permissions, contacts, addresses, objects, files, audit logs, and external
references.

ADR 0007 defined a centralized operational database for the LMS project. It stated explicitly
that the centralized model "applies only to the LMS project and must not become the default
architecture for every future NEWAX project."

No later ADR defined what the default is. In the absence of that decision, NEWAX project domains
have each made their own choice independently. Several project domains now maintain their own
databases with their own person, contact, address, audit, and lead concepts, defined differently
in each project and in more than one language.

The concepts diverge because nothing declares which side of the boundary they belong on.

## 5. Problem

Without a declared default topology, every new project domain forces the same unowned decision:
share the Central Registry database, or build a separate one.

Sharing produces:

- A single migration timeline coupling unrelated project release cycles.
- One failure and one restore boundary for every project.
- Cross-domain joins that quietly become load-bearing and cannot later be separated.
- Unbounded growth of one schema as project count grows.

Building separately without rules produces:

- Duplicate and divergent copies of core identity concepts.
- No agreed way to reference a core record from a project record.
- Point-to-point integrations that multiply with project count.

NEWAX needs one declared default that makes the boundary explicit before the next project domain
begins.

## 6. Decision

The default topology for NEWAX project domains is one database per project domain.

Each project domain receives its own PostgreSQL database with its own database role, its own
credentials, its own migration history, and its own schema owned by that project's repository.

The Core NEWAX Database remains the single Central Registry database and is not merged into any
project database.

Two decisions are deliberately separated:

- **Logical boundary.** Fixed by this ADR. One database per project domain. No shared tables
  between project domains, no shared migration timeline, no cross-database joins.
- **Physical placement.** Not fixed by this ADR. Project databases may share a managed PostgreSQL
  cluster or occupy dedicated instances. Placement is resolved through configuration as defined
  by ADR 0038.

This ADR scopes ADR 0007 to the LMS project domain only. ADR 0007 remains valid for LMS. It does
not describe the platform default and never claimed to.

## 7. Reasoning

Fixing the logical boundary now costs little and preserves every future option. Each project can
be backed up, restored, scaled, and migrated independently. A failure in one project database
cannot exhaust connections or storage for another.

Deferring physical placement avoids paying for one cluster per project before the project count
justifies it. Because no query is ever permitted to cross the boundary, moving a database to a
dedicated instance later is a configuration change rather than a rewrite.

The topology also matches how NEWAX already works in practice. Several project domains already
operate their own PostgreSQL databases. This ADR formalises existing reality rather than
proposing a migration.

Most importantly, the boundary makes ownership answerable. A concept is either core, and lives in
the Central Registry, or it is domain-specific, and lives in one project database. There is no
third option in which it lives in both and drifts.

## 8. Alternatives Considered

**One shared database with a schema per project.** Cheaper to operate and permits cross-schema
joins. Rejected because those joins become load-bearing, restoring one project means restoring
all of them, and a single migration timeline couples unrelated release cycles.

**One shared database with tenant and project columns.** Simplest to build. Rejected because it
gives the weakest isolation available, makes per-project scaling impossible, and places every
project's data inside one failure boundary.

**A dedicated database instance per project from the start.** Strongest isolation. Rejected as
the default because it pays maximum operational cost immediately for isolation not yet required.
ADR 0038 keeps this available as a promotion path for any project that needs it.

**Extending the LMS centralized database from ADR 0007 to all projects.** Rejected because
ADR 0007 explicitly forbade it, and because it reproduces the shared-database problems above with
the added defect of making one project domain the platform foundation, which ADR 0008 rejects.

## 9. Consequences

Positive:

- Each project domain scales, backs up, restores, and fails independently.
- Ownership of every concept is answerable.
- Physical isolation is available later without an application change.
- Project release cycles decouple.
- The existing separate project databases become conformant rather than accidental.

Cost:

- Central Registry data must be distributed to project databases, requiring the mechanism defined
  by ADR 0039 and ADR 0040.
- A project can no longer join directly against Central Registry tables.
- Operating several databases requires per-project provisioning, credential, and backup handling.
- Existing duplicated concepts in project databases require a documented convergence path.

## 10. Impact On NEWAX Core

The Central Registry remains the source of truth and its schema is unchanged by this ADR.

Core gains the responsibility of publishing its data outward, because project domains can no
longer read it directly. Core does not gain the right to read project databases.

Module ownership rules in `docs/standards/module-standard.md` are unaffected. Module ownership
still means owning tables, migrations, and access rules, not owning a separate database.

## 11. Impact On Client Systems

A client deployment may now involve several databases rather than one. Deployment manifests must
record every project database in the deployment and its placement.

Client data-isolation guarantees improve, because a client's project data can be moved to a
dedicated instance or region without redesign.

## 12. Security Considerations

Each project database has its own role and credentials. A credential compromised in one project
does not grant access to the Central Registry or to another project.

No project receives direct credentials to the Core NEWAX Database. The blast radius of a project
compromise stops at that project's own data plus whatever Central Registry data it mirrors, which
is bounded by what that project subscribes to.

Database-per-project does not replace tenant isolation. ADR 0027's tenant boundary still applies
inside every project database that serves more than one tenant.

## 13. Scalability Considerations

Per-project databases can be sized, indexed, tuned, and scaled independently. Connection pools are
bounded per project rather than shared.

The topology provides the natural sharding unit for growth. When one project's load exceeds a
shared cluster, that project alone is promoted to dedicated infrastructure.

The cost this ADR introduces is distribution: core data must reach project databases, and that
mechanism must fan out to a growing number of subscribers without per-project wiring. ADR 0040
addresses that directly.

## 14. Maintenance Considerations

Each project owns its migrations and can deploy without coordinating with other projects.

The cost is operational surface: more databases to provision, monitor, back up, and rotate
credentials for. This must be automated rather than performed per project by hand, which is why
ADR 0036 requires every project database to be registered rather than informally created.

## 15. Related Documents

- [Platform Data Topology](../architecture/platform-data-topology.md)
- [ADR 0001: Use Modular Monolith First](0001-use-modular-monolith-first.md)
- [ADR 0003: Design for Multi-Tenancy](0003-design-for-multi-tenancy.md)
- [ADR 0007: Define LMS Centralized Database and Data Ownership Rules](0007-define-lms-centralized-database-and-data-ownership.md)
- [ADR 0008: Use Central Identity and Organization Registry](0008-use-central-identity-and-organization-registry.md)
- [ADR 0027: Separate Tenant Ownership from Organizations](0027-separate-tenant-ownership-from-organizations.md)
- [ADR 0036: Establish Project Identity and Registry](0036-establish-project-identity-and-registry.md)
- [ADR 0037: Define Cross-Database Reference Rules](0037-define-cross-database-reference-rules.md)
- [ADR 0038: Define Connection Routing and Credential Isolation](0038-define-connection-routing-and-credential-isolation.md)

## 16. Approved By

NEWAX Engineering and Architecture.
