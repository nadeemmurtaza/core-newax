# ADR 0038: Define Connection Routing and Credential Isolation

## Purpose

Define how a NEWAX project resolves its database connection and how database credentials are
scoped, so that the physical placement of a project database can change without an application
change.

## 1. Decision Title

ADR 0038: Define Connection Routing and Credential Isolation

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 fixes the logical boundary at one database per project domain and deliberately leaves
physical placement open. That deferral is only valuable if placement can actually change later
without touching application code.

`docs/standards/environment-standard.md` already requires that each environment have its own
configuration, its own database, and its own credentials, and forbids committing secrets to this
repository. It does not define how a project locates its database or how credentials are scoped
across a growing number of project databases.

## 5. Problem

If a project embeds a host, a database name, or a connection string in its code or in a
committed file, then the deferral in ADR 0035 is fiction. Moving that database to a dedicated
instance or a different region becomes a code change in every project that reaches it.

If credentials are shared across project databases, then database-per-project provides no
security benefit, because one compromised credential reaches all of them.

If provisioning is manual, per-project operational cost grows linearly with project count, which
defeats the purpose of a shared foundation.

## 6. Decision

**Connections resolve through a Connection Registry.**

A project resolves its database connection by looking up its `project_key` and its environment.
The application never contains a host, port, database name, or credential. Changing where a
database physically lives is a change to the Connection Registry, not to the project.

The Connection Registry holds, per project and environment, the information required to reach the
database and a reference to the credential. It holds credential references, never credential
values.

**Credentials are isolated per project, per environment, and per purpose.**

Each project database has its own role in each environment. No role spans two project databases.
No role spans two environments. Roles are issued by purpose, so that a migration role holding
schema-change rights is distinct from the application role holding data rights, and a read-only
role exists for reporting.

No project holds any credential to the Core NEWAX Database. Project access to core data is
through the Core API and replicated read models, as ADR 0037 requires.

**Placement is a property of the registry entry, not of the project.**

A project database may share a managed PostgreSQL cluster with other project databases or occupy
a dedicated instance. Promotion from shared to dedicated is a Connection Registry change plus a
data move. It is not an application change, because ADR 0037 prohibits any query that crosses the
boundary and would break.

**Provisioning is automated from the project registry.**

Creating a project database, its roles, and its Connection Registry entries is driven from the
`registry/project-registry.json` entry established by ADR 0036, so that per-project setup cost
does not grow with project count.

## 7. Reasoning

Indirection through a registry is what converts placement from an architectural decision into an
operational one. It is a small amount of machinery that preserves a large amount of future
freedom.

Scoping credentials per project, per environment, and per purpose follows the least-privilege
principle already implied by the environment standard, and it makes revocation bounded and
complete. A compromised project credential is contained to one database in one environment with
one set of rights.

Denying every project a Core NEWAX Database credential is the control that makes the mirror model
real rather than advisory. If the credential exists, some code path will eventually use it, and
the boundary will erode without any decision to erode it.

Driving provisioning from the project registry is what keeps onboarding flat. The registry entry
already has to exist for governance, so using it as the provisioning input adds no separate
source of truth.

## 8. Alternatives Considered

**Environment variables holding connection strings per project.** The common approach and the
current de-facto one. Rejected as the platform mechanism because it distributes placement
knowledge across every deployment, offers no inventory of what exists, and provides no path to
verify that every registered database is configured or that every configured database is
registered.

**A shared credential across project databases.** Rejected because it removes the security
benefit of database-per-project entirely.

**A connection proxy or pooler as the single entry point.** Useful operationally and compatible
with this decision, but rejected as the mechanism because a pooler routes connections without
governing what exists, what it is called, or who owns it.

**Leaving placement to each deployment.** Rejected because it produces deployments whose topology
nobody can describe, which makes backup, restore, and residency guarantees unverifiable.

## 9. Consequences

Positive:

- Physical placement changes without an application change.
- Credential compromise is bounded to one database, one environment, one purpose.
- Provisioning and rotation become automatable.
- Deployment topology becomes inspectable rather than inferred.
- Promotion to a dedicated instance or region has a defined path.

Cost:

- A Connection Registry must be built and kept synchronised with reality.
- Local development needs a resolution path that does not require production infrastructure.
- More roles exist, so rotation must be automated rather than performed by hand.

## 10. Impact On NEWAX Core

Core owns the Connection Registry as part of the Platform Operations domain introduced by
ADR 0036, alongside project identity.

Core must resolve its own connection through the same mechanism. A Central Registry that
special-cases itself would leave the mechanism untested by its most important consumer.

## 11. Impact On Client Systems

Client deployment manifests describe placement per project rather than assuming one database per
deployment.

Data residency becomes expressible: a client requiring a specific region has the project
databases carrying their data placed in that region, without redesign.

## 12. Security Considerations

Credential values are never committed to this repository, in line with
`docs/standards/environment-standard.md`. The Connection Registry stores references that a secret
manager resolves at runtime.

Roles follow least privilege by purpose. A migration role with schema rights must not be the
role the application runs under.

Rotation must be routine rather than incident-driven, which requires it to be automated, which
requires the registry to know every role that exists.

The prohibition on project access to the Core NEWAX Database is a security boundary and must be
enforced by role grants, not only by convention.

## 13. Scalability Considerations

Connection resolution happens at startup or on pool creation, not per query, so the indirection
costs nothing at request time.

Connection pool limits are set per project, so one project cannot exhaust the connection budget
of another sharing a cluster. This is the failure mode most likely to appear first as project
count grows on shared infrastructure, and it is the earliest signal that a project should be
promoted to a dedicated instance.

## 14. Maintenance Considerations

The registry and reality drift unless checked. Automated verification should confirm that every
registered project database has a Connection Registry entry per environment, that every entry
resolves, and that no configured database is absent from the project registry.

Local development must remain simple. A developer should be able to run a project against a local
database without provisioning infrastructure, which means the resolution path needs a documented
local mode rather than an exception carved out per project.

## 15. Related Documents

- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Environment Standard](../standards/environment-standard.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [Client Deployment Manifest Standard](../standards/client-deployment-manifest-standard.md)
- [ADR 0035: Adopt Database-Per-Project Topology](0035-adopt-database-per-project-topology.md)
- [ADR 0036: Establish Project Identity and Registry](0036-establish-project-identity-and-registry.md)
- [ADR 0037: Define Cross-Database Reference Rules](0037-define-cross-database-reference-rules.md)

## 16. Approved By

NEWAX Engineering, Architecture, and Security.
