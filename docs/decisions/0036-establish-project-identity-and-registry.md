# ADR 0036: Establish Project Identity and Registry

## Purpose

Give every NEWAX project domain a stable identity and a governed registry entry, so that
databases, credentials, events, entitlements, and audit records can all be attributed to a named
project rather than inferred from a repository name.

## 1. Decision Title

ADR 0036: Establish Project Identity and Registry

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 establishes one database per project domain. That decision assumes something NEWAX has
never defined: what a project is, and how one is identified.

NEWAX already solved the equivalent problem one level down. ADR 0009 established the Module
Registry, `docs/standards/module-registry-standard.md` defines its rules, and
`docs/standards/module-approval-checklist.md` defines the status lifecycle from planned through
draft to active. `registry/module-registry.json` is the source of truth, and
`tooling/database-registry/generate.mjs` reads it to produce an evidence-based map.

Nothing equivalent exists for projects. Project domains are currently identified by repository
name, by database name, and by informal convention, and those three do not always agree.

## 5. Problem

Without project identity:

- A database cannot be attributed to an owner, so provisioning and credential rotation stay
  manual.
- An event cannot record which project produced or consumed it.
- Entitlements cannot express that a tenant has one project enabled and another disabled.
- Audit records cannot distinguish actions originating in different project domains.
- There is no place to record how deeply a project integrates with the Central Registry, so
  every integration review restarts from nothing.

Each new project therefore costs a bespoke discussion rather than following a known path. That
cost grows with project count, which is the opposite of what a shared foundation should do.

## 6. Decision

NEWAX establishes project identity in two places.

**A governance registry.** `registry/project-registry.json` is the source of truth for project
domains, modelled on `registry/module-registry.json`. Each entry records at minimum:

- `project_name` and `project_key`.
- `project_status` following the planned, draft, active, deprecated, replaced, archived
  lifecycle already defined for modules.
- `project_owner` and the owning repository.
- `integration_class` and `conformance_level`, defined by ADR 0041.
- The project database name and technology stack.
- The Central Registry domains the project consumes.
- The Central Registry entities the project mirrors.

**A runtime table.** `core_projects` in the Core NEWAX Database holds project identity for
runtime use, so that events, credentials, entitlements, and audit records can carry a
`project_id` foreign key. Table and column naming follows
`docs/standards/data-model-naming-standard.md`.

`project_key` is a stable lowercase identifier. It is assigned once, never reused, and never
renamed. Repository names, display names, and database names may change; `project_key` may not.

A registry entry tracks a project. It does not approve one. Only a project at active status with
a completed onboarding review may be treated as a governed integration, matching the rule already
stated in `registry/module-registry.json` for modules.

## 7. Reasoning

The Module Registry pattern is already proven inside this repository, already understood by the
team, and already has tooling that reads it. Reusing the pattern for projects costs far less than
inventing a second governance mechanism, and it keeps one mental model for anything NEWAX
registers.

Splitting identity between a JSON registry and a database table is deliberate. The registry is
reviewable in a pull request, versioned with the repository, and readable without a running
system. The table is what runtime foreign keys point at. Neither substitutes for the other.

Making `project_key` immutable is what allows every other decision to depend on it. If the key
can change, then event history, audit trails, and credential mappings all become ambiguous at the
moment of the rename.

## 8. Alternatives Considered

**Identify projects by repository name.** Free, and already informally in use. Rejected because
repositories are renamed and moved, one repository may contain more than one deployable project,
and a repository name is not available to a running system.

**Identify projects by database name.** Rejected for the same reasons, with the additional defect
that a project with no database, such as a static web property, could not be identified at all.

**A database table only, with no JSON registry.** Rejected because project onboarding decisions
would then be invisible to code review and unavailable to repository tooling, including the
existing registry map generator.

**A JSON registry only, with no table.** Rejected because runtime records need a foreign key
target, and duplicating registry contents into every consuming table is worse.

## 9. Consequences

Positive:

- Every database, event, credential, and audit record becomes attributable to a project.
- Project onboarding follows a reviewable, repeatable path.
- Provisioning and credential rotation become automatable.
- The existing registry map tooling can be extended to cover projects.
- Entitlements can express which tenant has which project enabled.

Cost:

- A new registry file and a future table must be maintained.
- Adding a project now requires a governance step rather than creating a database.
- Registry drift becomes possible and must be checked, not assumed.

## 10. Impact On NEWAX Core

Core gains a Platform Operations responsibility it did not previously have. `core_projects` is the
first table of that domain, defined in schema terms by a later ADR.

The Module Registry is unaffected. Modules and projects are different things at different levels:
a module is a unit of code ownership inside a repository; a project is a deployable domain with
its own database and its own integration with the Central Registry.

## 11. Impact On Client Systems

Client deployment manifests reference projects by `project_key` rather than by repository or
database name, giving a stable identifier across renames.

A client deployment can be described as the set of projects enabled for that tenant, which is the
foundation entitlements later build on.

## 12. Security Considerations

Project identity is the anchor for credential scoping. Each project's database role, API
credentials, and event signing key are issued against its `project_key`, so revocation is
bounded and complete.

Attributing audit records to a project makes cross-project activity visible, which is not
possible when actions are only attributed to a user.

The registry file must not contain credentials, connection strings, or secrets. It records that a
database exists and who owns it, never how to reach it. Connection details are handled by
ADR 0038.

## 13. Scalability Considerations

The registry is the mechanism that keeps per-project cost flat as project count grows.
Provisioning, credential issuance, subscription setup, and conformance checking all key off the
registry entry, so onboarding project N+1 is a governed data change rather than an architecture
exercise.

The registry is small, reviewed by humans, and read at build or deploy time. It is not a runtime
hot path and does not need to scale as a data structure.

## 14. Maintenance Considerations

The registry must be kept truthful. A registry that claims a project is active when it is not is
worse than no registry, which is the standard the existing database registry generator already
holds itself to by separating repository state from governance state.

Automated checks should verify that every registered project database appears in the connection
configuration and that every configured connection belongs to a registered project.

## 15. Related Documents

- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Module Registry](../../registry/README.md)
- [Module Registry Standard](../standards/module-registry-standard.md)
- [Module Approval Checklist](../standards/module-approval-checklist.md)
- [Data Model Naming Standard](../standards/data-model-naming-standard.md)
- [ADR 0009: Define Module Registry and Dependency Rules](0009-define-module-registry-and-dependency-rules.md)
- [ADR 0035: Adopt Database-Per-Project Topology](0035-adopt-database-per-project-topology.md)
- [ADR 0038: Define Connection Routing and Credential Isolation](0038-define-connection-routing-and-credential-isolation.md)

## 16. Approved By

NEWAX Engineering and Architecture.
