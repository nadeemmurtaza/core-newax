# NEWAX Architecture Decision Records

## Purpose

This directory contains Architecture Decision Records for NEWAX Core.

ADRs preserve important technical and architectural decisions that affect NEWAX as a reusable business infrastructure foundation. They explain not only what was decided, but why the decision exists, which alternatives were considered, and what consequences future teams must understand.

ADRs are used for decisions with long-term impact on:

- Core architecture
- Module boundaries and dependencies
- Shared identity and organization ownership
- Database and tenant boundaries
- Authentication and authorization
- Security and auditability
- Client customization
- Versioning and upgrades
- Technology platforms
- Scalability and service extraction
- Operational maintainability

## Accepted Decision Index

| ADR                                                                       | Status   | Decision                                                                                                                                         |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ADR 0001](0001-use-modular-monolith-first.md)                            | Accepted | Begin with a modular monolith and extract services only when evidence justifies the additional operational complexity.                           |
| [ADR 0002](0002-use-permission-based-access-control.md)                   | Accepted | Authorize business actions through explicit permissions rather than hardcoded role names.                                                        |
| [ADR 0003](0003-design-for-multi-tenancy.md)                              | Accepted | Design NEWAX Core for organization-scoped multi-tenancy and strict tenant isolation.                                                             |
| [ADR 0004](0004-separate-client-customizations-from-core.md)              | Accepted | Keep client-specific configuration and extensions separate from reusable core modules.                                                           |
| [ADR 0005](0005-use-event-driven-module-communication.md)                 | Accepted | Use documented events for suitable cross-module communication while retaining direct service calls when clearer.                                 |
| [ADR 0006](0006-use-controlled-updates-and-versioning.md)                 | Accepted | Use semantic versioning, changelogs, compatibility review, and controlled client updates.                                                        |
| [ADR 0007](0007-define-lms-centralized-database-and-data-ownership.md)    | Accepted | Use a centralized LMS operational database with explicit module ownership and organization isolation.                                            |
| [ADR 0008](0008-use-central-identity-and-organization-registry.md)        | Accepted | Use one Central Identity and Organization Registry across LMS and future NEWAX domains.                                                          |
| [ADR 0009](0009-define-module-registry-and-dependency-rules.md)           | Accepted | Maintain a Module Registry and enforce architecture-layer dependency rules.                                                                      |
| [ADR 0010](0010-define-authentication-and-user-identity-strategy.md)      | Accepted | Separate people, users, authentication, memberships, roles, permissions, and organization context.                                               |
| [ADR 0011](0011-define-technology-stack-and-implementation-baseline.md)   | Accepted | Use the TypeScript, Node.js, pnpm, NestJS, Next.js, PostgreSQL, Prisma, Vitest, Playwright, Docker, and GitHub Actions implementation baseline.  |
| [ADR 0012](0012-implement-central-registry-data-foundation.md)            | Accepted | Implement the first Prisma Central Registry foundation while keeping domain transactions outside the registry.                                   |
| [ADR 0013](0013-build-people-registry-service-foundation.md)              | Accepted | Build the reusable People Registry service foundation with permission-controlled identity and identifier operations.                             |
| [ADR 0014](0014-build-memberships-registry-service-foundation.md)         | Accepted | Build the organization-scoped Memberships Registry service foundation connecting people to organizations.                                        |
| [ADR 0015](0015-consolidate-roles-and-permissions-into-access-control.md) | Accepted | Consolidate roles, permissions, membership-role assignments, templates, and evaluation into one Access Control bounded context.                  |
| [ADR 0016](0016-build-users-registry-service-foundation.md)               | Accepted | Build the global Users Registry service foundation while preserving organization-scoped access through memberships and permissions.              |
| [ADR 0017](0017-build-authentication-service-foundation.md)               | Accepted | Build credential verification, failed-attempt protection, and revocable sessions without merging Authentication into Users.                      |
| [ADR 0018](0018-build-trusted-request-context-foundation.md)              | Accepted | Resolve tenant-safe execution context from authenticated sessions, active memberships, organizations, and effective permissions.                 |
| [ADR 0019](0019-build-http-security-boundary.md)                          | Accepted | Establish secure HTTPS entry, browser protections, distributed throttling, trusted context enforcement, response controls, and HTTP auditing.    |
| [ADR 0020](0020-build-authentication-http-endpoints.md)                   | Accepted | Expose bounded login, session, CSRF bootstrap, and logout endpoints without weakening authentication or tenant boundaries.                       |
| [ADR 0021](0021-build-account-membership-discovery.md)                    | Accepted | Let authenticated accounts discover only their active organization memberships before trusted organization-context selection.                    |
| [ADR 0022](0022-build-organization-context-confirmation.md)               | Accepted | Confirm selected organization context with minimal identity data and fixed capability summaries without exposing raw authority.                  |
| [ADR 0023](0023-build-current-organization-read-api.md)                   | Accepted | Expose a bounded current-organization profile derived only from trusted context and protected by `organizations.view`.                           |
| [ADR 0024](0024-build-current-person-read-api.md)                         | Accepted | Expose a bounded authenticated self-profile derived only from trusted account context without granting organization-wide `people.view`.          |
| [ADR 0025](0025-build-organization-contacts-registry-foundation.md)       | Accepted | Establish permission-controlled organization email and phone contacts while deferring person-contact visibility until an explicit policy exists. |

## Decision Sequence

The ADRs form a deliberate sequence rather than twenty-five independent opinions wandering around the repository unsupervised.

### Architecture Foundation

- ADR 0001 establishes the modular-monolith-first direction.
- ADR 0004 protects reusable core modules from client-specific coupling.
- ADR 0005 defines appropriate cross-module communication.
- ADR 0006 defines controlled evolution and upgrade discipline.

### Access, Tenancy, and Identity

- ADR 0002 establishes permission-based authorization.
- ADR 0003 establishes organization-scoped multi-tenancy.
- ADR 0008 establishes the Central Identity and Organization Registry.
- ADR 0010 separates authentication, identity, users, memberships, roles, and permissions.

### Data and Module Governance

- ADR 0007 defines LMS database and data-ownership boundaries.
- ADR 0009 defines module registration, lifecycle, and dependency rules.
- ADR 0012 defines the first executable Central Registry persistence foundation and preserves domain transaction ownership.
- ADR 0013 defines the first reusable People Registry service and identifier-protection rules.
- ADR 0014 defines organization-scoped memberships and non-destructive membership lifecycle rules.
- ADR 0015 consolidates role, permission, assignment, template, and evaluation rules into Access Control.
- ADR 0016 defines global user accounts, organization-scoped creation, and platform-scoped account lifecycle rules.
- ADR 0017 defines password verification, failed-attempt protection, and secure account sessions.
- ADR 0018 defines trusted account and organization execution context without accepting client-declared authority.
- ADR 0019 establishes secure HTTPS entry, browser request integrity, distributed throttling, permission enforcement, response controls, and HTTP security auditing.
- ADR 0020 exposes only the first bounded browser authentication workflows while preserving transport, identity, and tenant separation.
- ADR 0021 exposes self-scoped active membership discovery without treating discovery results as organization authority or permissions.
- ADR 0022 confirms selected organization context while keeping raw permissions, role names, and browser-side authorization outside the response contract.
- ADR 0023 exposes the first organization profile through trusted context without accepting client-supplied tenant authority or unrelated registry data.
- ADR 0024 exposes the authenticated account's bounded person profile without client person selection or organization-wide People Registry authority.
- ADR 0025 establishes organization-scoped contact creation and reads while deferring person-contact visibility, lifecycle, and verification policy.

### Implementation Baseline

- ADR 0011 selects the initial technology stack and implementation approach required to turn the architecture into executable infrastructure.

## Current Decision Baseline

The accepted architecture currently means:

- NEWAX Core begins as a modular monolith.
- Foundation Modules remain independent from business domains.
- The Central Registry owns shared people, organization, user, membership, object, contact, address, file, and audit foundation data.
- Business domains own their domain-specific master data and transactions.
- Organizations provide the initial tenant context.
- Business authorization uses explicit permissions grouped through roles.
- Client customization remains separate from reusable core modules.
- Module communication uses clear services, contracts, APIs, or events.
- Modules use controlled versions and lifecycle states.
- The implementation baseline uses TypeScript across the primary web and backend stack.
- PostgreSQL remains the primary operational database.
- The initial platform avoids mandatory microservices, Kubernetes, Redis, and message brokers.

## When to Create an ADR

Create an ADR when a decision materially affects one or more of the following:

- Architecture direction
- Technology stack
- Module boundaries
- Dependency direction
- Data ownership
- Tenant isolation
- Authentication or authorization
- Security controls
- Shared contracts or events
- Client extension mechanisms
- Database strategy
- Deployment architecture
- Versioning or migration policy
- Service extraction
- Long-term operational ownership

Do not create an ADR for routine implementation choices, small refactors, formatting decisions, ordinary bug fixes, or changes already governed by an accepted standard.

## ADR Statuses

Use one of these statuses:

| Status       | Meaning                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `Proposed`   | The decision is under review and must not be treated as accepted architecture.                     |
| `Accepted`   | The decision is approved and governs relevant implementation.                                      |
| `Deprecated` | The decision should no longer guide new implementation, but remains part of the historical record. |
| `Replaced`   | A newer ADR supersedes the decision. The replacement must be identified.                           |

An accepted ADR must not be edited to hide a later change in direction. Create a new ADR and mark the previous decision as replaced or deprecated. Architecture history is allowed to be inconvenient. That is still better than pretending nobody made the earlier decision.

## Approval

Approvers depend on scope.

Typical reviewers include:

- NEWAX Leadership for strategic platform direction
- Product for business and client impact
- Engineering for implementation and maintainability
- Architecture for boundaries and dependency direction
- Security for identity, access, tenancy, privacy, and audit impact
- Operations for deployment and support impact
- Relevant module owners for contract and ownership changes

An ADR should not be marked `Accepted` until the appropriate reviewers have approved it.

## Relationship to Other Documents

### Architecture Documents

Architecture documents explain the broader system structure.

- [Architecture Index](../architecture/README.md)
- [Core Architecture](../architecture/core-architecture.md)
- [Central Registry Architecture](../architecture/central-registry-architecture.md)

### Engineering Standards

Standards convert accepted decisions into recurring engineering rules.

- [Engineering Standards Index](../standards/README.md)

### Module Registry

The Module Registry records the modules governed by these decisions.

- [Module Registry](../../registry/module-registry.json)
- [Module Registry Operating Guide](../../registry/README.md)

### Module Documentation

Each module must explain how it implements applicable ADRs and standards.

An ADR does not replace a module README, API documentation, testing evidence, security review, `VERSION`, or `CHANGELOG.md`.

## Creating a New ADR

1. Copy [ADR-TEMPLATE.md](ADR-TEMPLATE.md).
2. Use the next sequential four-digit number.
3. Use a concise lowercase kebab-case filename.
4. Explain the context and specific problem.
5. State the decision clearly.
6. Record realistic alternatives.
7. Document positive and negative consequences.
8. Explain impact on NEWAX Core and client systems.
9. Include security, scalability, and maintenance considerations.
10. Link related ADRs, standards, architecture documents, and registry records.
11. Obtain appropriate approval before marking it `Accepted`.
12. Update this index in the same logical change.

Filename example:

```text
0026-define-repository-bootstrap-and-boundary-enforcement.md
```

## Review Triggers

Review an existing ADR when:

- A core assumption has changed.
- A selected technology reaches end of support.
- A module boundary repeatedly causes coupling.
- Tenant or security requirements materially change.
- A major version introduces architectural consequences.
- A client need exposes a platform-wide limitation.
- Operational evidence justifies service extraction.
- A new domain challenges Central Registry ownership.

Review does not automatically mean replacement. The existing decision may remain correct, which is a pleasantly rare outcome in technology.

## Template

Use [ADR-TEMPLATE.md](ADR-TEMPLATE.md) for new decisions.
