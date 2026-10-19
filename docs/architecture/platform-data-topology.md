# NEWAX Platform Data Topology

## Purpose

This document defines how NEWAX separates data across the Core NEWAX Database and the databases
owned by individual project domains.

It answers one question that NEWAX architecture has not yet answered: when NEWAX builds a new
project, where does that project's data live, and how does it relate to the Central Registry?

This document is for internal NEWAX engineering use. It does not define implementation code,
database migrations, or production modules.

## Core Principle

The Central Registry is the shared source of truth. Every project domain owns its own database.

A project database may hold a local read-only copy of Central Registry data so it can query
locally. It may never hold the authoritative copy, and it may never reach into another database
to read one.

## 1. The Topology

```text
                    +------------------------------------------+
                    |          CORE NEWAX DATABASE             |
                    |                                          |
                    |  Identity and Access   Master Data       |
                    |  Platform Operations   Growth            |
                    |  Measurement and Tags  Analytics Rollup  |
                    +------+----------------------------+------+
                           |                            ^
        core to project    |                            |    project to core
        replicated read    |                            |    contributions and
        models             v                            |    telemetry
                           |                            |
   +-----------------------+----------------------------+--------------------+
   |                                                                         |
   v                       v                            v                    v
+------------------+  +------------------+  +------------------+  +------------------+
| project database |  | project database |  | project database |  | project database |
| project tables   |  | project tables   |  | project tables   |  | project tables   |
| core_mirror_*    |  | core_mirror_*    |  | core_mirror_*    |  | core_mirror_*    |
+------------------+  +------------------+  +------------------+  +------------------+
   project domain        project domain        project domain        project domain
```

The Core NEWAX Database is the hub. Each project domain is a spoke with its own database. Spokes
never connect to each other directly at the database layer.

## 2. Logical Boundary and Physical Placement

NEWAX separates two decisions that are frequently confused.

### Logical boundary

The logical boundary is fixed: one database per project domain.

Each project database has:

- Its own PostgreSQL database.
- Its own database role and credentials.
- Its own migration history.
- Its own schema definition owned by that project's repository.

There are no shared tables between two project domains. There is no shared migration timeline.
There are no cross-database joins.

### Physical placement

Physical placement is a configuration decision, not an application decision.

Every project resolves its database connection through a Connection Registry entry keyed by
project key and environment. The application never contains a hardcoded host.

This means a project database may:

- Share a managed PostgreSQL cluster with other project databases.
- Move to a dedicated instance.
- Move to a specific data region.
- Move to an isolated compliance boundary.

None of those moves require an application change, because no query was ever permitted to cross
the boundary in the first place.

### Why the separation matters

Starting with a dedicated instance for every project buys isolation NEWAX does not yet need and
pays operational cost forever. Starting with a shared schema saves cost now and makes separation
expensive later.

Fixing the logical boundary immediately and deferring physical placement gives NEWAX independent
scaling, independent backup and restore, and contained failure impact, without provisioning one
cluster per project before the project count justifies it.

## 3. The Three Boundary Rules

These rules apply to every project domain regardless of its technology or integration depth.

### Rule 1: A project database holds only two kinds of tables

A project database contains:

1. Tables the project owns.
2. Tables named `core_mirror_*`, which are read-only replicas of Central Registry data.

A `core_mirror_*` table is maintained only by the project's Central Registry consumer. Project
business logic reads mirror tables and never writes them.

If a project needs to change core data, it calls the Core API. It does not write its mirror and
hope the change propagates.

### Rule 2: No foreign keys cross the database boundary

A project row that references a Central Registry record stores the Central Registry UUID in a
plain column, such as `core_person_id` or `core_organization_id`.

PostgreSQL cannot enforce a foreign key across databases, and pretending otherwise produces
silent corruption. Referential correctness across the boundary comes from:

- Idempotent consumers that apply Central Registry changes in order.
- Reconciliation jobs that detect and report drift.
- Documented behaviour for a reference whose mirror row has not arrived yet.

Each project must define what it does when a referenced core record is missing from its mirror.
Failing loudly is acceptable. Silently treating the reference as absent is not.

### Rule 3: Authority is one-directional per record

The Central Registry is authoritative for Central Registry data. A project is authoritative for
its own data.

When a project has information that belongs in the Central Registry, it submits a candidate
record. It does not overwrite a canonical record. The Central Registry decides whether the
candidate creates a new record, matches an existing one, or requires review.

The Core NEWAX Database never reads a project database. Data moves from a project to the core
only as an explicit contribution or as telemetry, never as an operational query.

## 4. What Lives Where

| Concern                                                             | Owner   |
| ------------------------------------------------------------------- | ------- |
| Tenants, organizations, organization relationships                  | Core    |
| People, users, credentials, sessions, external identities           | Core    |
| Memberships, roles, permissions                                     | Core    |
| Contact methods, addresses, objects, files                          | Core    |
| Audit logs, external references                                     | Core    |
| Project registry, service catalog, feature flags, entitlements      | Core    |
| Canonical master records and their merge history                    | Core    |
| Campaigns, audiences, segments, leads, opportunities, consent       | Core    |
| Tag containers, destinations, event mapping, server-side forwarding | Core    |
| Cross-project metrics and reporting rollups                         | Core    |
| Course delivery, lead harvesting, messaging, orders, tickets        | Project |

The rule behind the table: if two project domains would each need the concept and would each
expect it to mean the same thing, it belongs in the core. If the concept only makes sense inside
one domain, it belongs in that project.

## 5. Tenant Isolation Inside a Project Database

Database-per-project is not a substitute for tenant isolation.

ADR 0027 defines Tenant as the customer ownership and data-isolation boundary. That boundary
still applies inside every project database. A project database serving several tenants must
scope its own tables by `tenant_id` exactly as the Central Registry does.

Separating projects and separating tenants are different problems. Solving one does not solve
the other.

## 6. What This Topology Does Not Decide

This document defines where data lives. It does not define:

- How Central Registry data reaches a project database.
- The event contract, envelope, or delivery guarantees.
- How a new project is registered, classified, or approved.
- The schema of any core domain named in section 4.

Those are defined by the Core Integration Platform documents and their ADRs.

## 7. Related Documents

- [Core Architecture](core-architecture.md)
- [Central Registry Architecture](central-registry-architecture.md)
- [ADR 0027: Separate Tenant Ownership from Organizations](../decisions/0027-separate-tenant-ownership-from-organizations.md)
- [ADR 0035: Adopt Database-Per-Project Topology](../decisions/0035-adopt-database-per-project-topology.md)
- [ADR 0036: Establish Project Identity and Registry](../decisions/0036-establish-project-identity-and-registry.md)
- [ADR 0037: Define Cross-Database Reference Rules](../decisions/0037-define-cross-database-reference-rules.md)
- [ADR 0038: Define Connection Routing and Credential Isolation](../decisions/0038-define-connection-routing-and-credential-isolation.md)
