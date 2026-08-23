# ADR 0043: Establish Platform Operations Domain

## Purpose

Establish the Core domain that holds the platform's own operational records: the project registry,
the service catalog, feature flags, entitlements, and quotas.

## 1. Decision Title

ADR 0043: Establish Platform Operations Domain

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0036 introduced `core_projects` as the runtime home of project identity. ADR 0038 introduced
the Connection Registry. ADR 0040 introduced the outbox, delivery log, subscriptions, and cursors.
ADR 0041 introduced integration classes and conformance levels.

Each of these introduced platform state without saying which domain owns it. That state is not
business data and does not belong to any existing Central Registry module: it describes NEWAX's
own operation rather than a tenant's.

## 5. Problem

Platform state placed into existing modules distorts them. Project identity is not a People
concern; subscriptions are not an Audit concern; entitlements are not an Organizations concern.

Without a named owner, this state is placed wherever it is first needed, which produces circular
dependencies between foundation modules and makes the platform's own records the least governed
part of the system.

There is also a capability gap. ADR 0035 gives each project its own database and ADR 0041 gives
each project a class and level, but nothing expresses which tenant has which project enabled, or
what limits apply. That question arrives as soon as more than one tenant uses more than one
project.

## 6. Decision

NEWAX establishes a Platform Operations domain in the Core NEWAX Database, owning the platform's
own operational records.

The domain owns:

- **Project identity.** `core_projects`, per ADR 0036, holding `project_key`, status, integration
  class, and conformance level.
- **The service catalog.** The deployable services belonging to each project, and their
  environments.
- **Connection routing.** The Connection Registry entries defined by ADR 0038, holding placement
  and credential references, never credential values.
- **Distribution state.** Subscriptions, per-subscriber cursors, retry state, and dead-letter
  queues, per ADR 0040.
- **Entitlements.** Which projects and capabilities are enabled for which tenant.
- **Feature flags.** Controlled behaviour toggles, scoped by tenant, project, and environment.
- **Quotas.** Declared limits per tenant and project, and their current consumption.

The domain does not own business data. It holds no person, organization, campaign, or transaction
record.

Platform Operations records are tenant-aware where they concern a tenant, and tenant-independent
where they concern NEWAX itself. A project exists whether or not any tenant has it enabled;
an entitlement exists only in relation to a tenant.

Entitlements are authoritative for access, not advisory. A project disabled for a tenant is
denied, not merely hidden.

## 7. Reasoning

Naming the domain is what keeps the platform's own state governed to the same standard as
everything else. State with no owner accumulates in whichever module first needed it and becomes
the least reviewed part of the system.

Separating platform state from business data keeps both models honest. The Central Registry
describes tenants and their people and organizations. Platform Operations describes NEWAX's own
machinery. Mixing them means a change to how NEWAX operates looks like a change to what a tenant
owns.

Entitlements belong here rather than in a billing system because they are an access-control input.
A billing system records what was sold; entitlements record what is permitted, and only the second
can be enforced at request time.

Making entitlements authoritative rather than advisory follows the principle already established
by ADR 0002: authorization is an explicit check, not a hidden assumption in a user interface.

## 8. Alternatives Considered

**Distribute platform state across existing modules.** No new domain required. Rejected because it
distorts foundation modules, creates circular dependencies, and leaves the platform's own records
the least governed part of the system.

**A separate platform database outside the Central Registry.** Stronger separation. Rejected
because entitlements and flags are read on the request path and must be available wherever
authorization happens, and because a separate database adds an operational boundary for records
that are small and tightly coupled to core.

**Configuration files instead of tables.** Simple and versioned. Rejected because entitlements and
flags change per tenant at runtime, and a deploy is not an acceptable mechanism for enabling a
project for a customer.

**Defer entitlements until a second tenant needs them.** Rejected because retrofitting an
authorization input after projects assume unrestricted access is substantially harder than
including it, and because ADR 0003 explicitly warns against single-tenant assumptions leaking into
the design.

## 9. Consequences

Positive:

- Platform state has one owner and is governed like everything else.
- Provisioning, subscription management, and credential rotation have a source of truth.
- Which tenant has which project becomes expressible and enforceable.
- Quotas and flags gain a defined home rather than appearing ad hoc.
- Foundation modules stay free of platform concerns.

Cost:

- A new domain to design, build, and maintain.
- Entitlement and flag checks sit on the request path and must be fast.
- Platform Operations becomes a dependency of authorization, so its availability matters.
- The registry file and the runtime table must be kept consistent.

## 10. Impact On NEWAX Core

Platform Operations is a foundation-layer domain. It may be depended on by other modules; it
depends on Tenants for tenant-scoped records and on nothing else.

The Module Registry gains Platform Operations entries at `planned` status. A registry entry tracks
a module and does not approve it.

## 11. Impact On Client Systems

A client deployment becomes describable as the set of projects entitled to that tenant, with their
flags and quotas. Deployment manifests reference `project_key` rather than repository names.

Enabling a project for a client becomes a governed data change rather than a deployment.

## 12. Security Considerations

Entitlements are an authorization input and must be enforced server-side, never inferred from a
user interface. A disabled project is denied at the API boundary.

The Connection Registry holds credential references only. Credential values never appear in this
domain, in the repository, or in documentation, per `docs/standards/environment-standard.md`.

Feature flags must not be used to bypass permission checks. A flag controls whether a capability is
present, never whether authorization applies to it.

Changes to entitlements, flags, and quotas are security-relevant and must be audited through
`core_audit_logs`.

## 13. Scalability Considerations

Entitlement and flag reads are on the request path and must be cached with a bounded staleness
window, with revocation propagating quickly enough that a disabled project does not remain usable.

Distribution state grows with subscriber count and event volume. The delivery log requires a
retention policy, per ADR 0040.

Quota consumption is high-write and should be modelled to avoid contention on a single row per
tenant.

## 14. Maintenance Considerations

The registry file and the runtime table describe the same projects and will drift unless checked.
Automated verification should confirm they agree, and that every configured connection belongs to a
registered project.

Feature flags accumulate. Each flag needs an owner and a removal condition, or the domain becomes a
record of decisions nobody remembers making.

## 15. Related Documents

- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Platform Data Topology](../architecture/platform-data-topology.md)
- [Environment Standard](../standards/environment-standard.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [ADR 0002: Use Permission-Based Access Control](0002-use-permission-based-access-control.md)
- [ADR 0003: Design for Multi-Tenancy](0003-design-for-multi-tenancy.md)
- [ADR 0036: Establish Project Identity and Registry](0036-establish-project-identity-and-registry.md)
- [ADR 0038: Define Connection Routing and Credential Isolation](0038-define-connection-routing-and-credential-isolation.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](0041-define-project-integration-classes-and-conformance-levels.md)

## 16. Approved By

NEWAX Engineering and Architecture.
