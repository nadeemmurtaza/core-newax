# NEWAX Core Architecture

## Purpose

This directory contains the system-level architecture documentation for NEWAX Core.

NEWAX Core is the private reusable foundation behind the systems NEWAX builds as **The Business Infrastructure Company**. Its architecture is designed to help NEWAX build mission-critical systems that are simpler to operate, easier to extend, safer to maintain, and owned over the long term.

Architecture documentation explains:

- How the platform is structured.
- Where responsibilities belong.
- Which modules may depend on which other modules.
- How identity, organizations, permissions, and tenant boundaries are handled.
- How business domains connect without becoming entangled.
- How client-specific behavior remains separate from reusable infrastructure.
- Which architectural decisions are fixed, provisional, or still unresolved.

## Architecture Documents

| Document                                                                      | Purpose                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Core Architecture](core-architecture.md)                                     | Defines the modular-monolith-first approach, architectural layers, module boundaries, dependency direction, and long-term extraction strategy.                |
| [Central Registry Architecture](central-registry-architecture.md)             | Defines the shared People, Organizations, Users, Memberships, Roles, Permissions, Contacts, and Audit foundation used across future NEWAX domains.            |
| [Platform Data Topology](platform-data-topology.md)                           | Defines where project data lives, the database-per-project boundary, the rules that cross it, and the separation of logical boundary from physical placement. |
| [Core Integration Platform](core-integration-platform.md)                     | Defines integration classes, conformance levels, the onboarding path, and the division between what Core provides and what a project builds.                  |
| [Core Distribution Architecture](core-distribution-architecture.md)           | Defines how core data reaches project databases and how projects contribute records and telemetry back to the core.                                           |
| [Growth and Measurement Architecture](growth-and-measurement-architecture.md) | Defines the Growth and Measurement domains, the consent gate, and server-side forwarding to external analytics and advertising destinations.                  |
| [Core Convergence Map](core-convergence-map.md)                               | Records where project domains duplicate core concepts today and what happens to each duplicate table, in what order.                                          |

Related governance:

- [Architecture Decision Records](../decisions/README.md)
- [Engineering Standards](../standards/README.md)
- [Module Registry](../../registry/README.md)
- [Module Approval Checklist](../standards/module-approval-checklist.md)

## Architecture Direction

The current direction is a **modular monolith first**.

This means NEWAX should begin with one deployable application boundary while preserving strong internal module boundaries.

The goal is not to build a large undifferentiated application. The goal is to avoid premature distributed complexity while retaining the ability to extract services later when scale, operational isolation, security, or independent deployment genuinely justify it.

The architecture should therefore provide:

- Clear module ownership.
- Explicit dependencies.
- Stable internal contracts.
- Permission-aware services and APIs.
- Organization-aware data access.
- Controlled events for suitable cross-module communication.
- Separate client extensions.
- Versioned reusable modules.
- Deployment visibility.

A microservice is not considered progress merely because a network call now exists where a function call used to be. Humanity has suffered enough from distributed enthusiasm.

## Architecture Layers

NEWAX Core uses four primary layers.

```text
Layer 4: Client Solutions
Layer 3: Business Domain Modules
Layer 2: Platform Service Modules
Layer 1: Foundation Modules
```

Dependency direction moves downward toward more stable layers.

### Layer 1: Foundation Modules

Foundation Modules provide shared identity, organization, access, and control capabilities.

Examples:

- People
- Organizations
- Memberships
- Users
- Authentication
- Roles
- Permissions
- Contacts

Rules:

- Foundation Modules must remain client-neutral.
- Foundation Modules must not depend on Platform Services, Business Domains, or Client Solutions.
- Foundation Modules must not depend on LMS tables or concepts.
- Foundation changes require careful compatibility and security review.
- Shared identity belongs here, not inside business domains.

### Layer 2: Platform Service Modules

Platform Services provide shared operational capabilities used across domains.

Examples:

- Audit
- Files
- Notifications
- Dashboard
- Reports
- Workflow
- Search
- Integrations

Rules:

- Platform Services may depend on Foundation Modules.
- Platform Services should remain domain-neutral where practical.
- Platform Services must not depend on Client Solutions.
- A dependency on a Business Domain requires explicit architecture approval.
- Platform Services should expose documented APIs, services, events, or configuration contracts.

### Layer 3: Business Domain Modules

Business Domain Modules provide reusable capabilities for a specific operational domain.

Examples:

- LMS Students
- LMS Teachers
- LMS Courses
- LMS Lectures
- LMS Enrollments
- LMS Tests
- LMS Test Results
- LMS Payments
- Future CRM, Legal, Healthcare, Finance, HR, Real Estate, Retail, and Hospitality modules

Rules:

- Business Domain Modules may depend on approved Foundation and Platform Service Modules.
- Business Domain Modules must not depend on Client Solutions.
- Business Domain Modules should not depend on unrelated domains without explicit approval.
- Business-domain data must remain separate from shared identity data.
- Client-specific behavior must not be hidden inside reusable domain modules.

### Layer 4: Client Solutions

Client Solutions compose approved lower-layer modules into deployable systems, editions, or client-facing products.

Examples:

- LMS Foundation Edition
- School Management System
- Clinic System
- Legal Case System
- Operations Dashboard

Rules:

- Client Solutions may depend on Foundation, Platform Service, and Business Domain Modules.
- Lower layers must never depend on Client Solutions.
- Client-specific extensions must remain visible and separate.
- Installed versions must be recorded in a Client Deployment Manifest.

## Dependency Direction

Allowed dependency direction:

```text
Foundation
   ↓
Platform Services
   ↓
Business Domains
   ↓
Client Solutions
```

A higher layer may depend on an approved lower layer.

A lower layer must not depend on a higher layer.

Additional rules:

- Every dependency must be declared.
- Circular dependencies are not allowed.
- Modules must not silently read or modify another module's internal data.
- Cross-module interaction must use approved APIs, services, contracts, read models, or events.
- Events must not be used to conceal unclear ownership.
- Direct service calls remain acceptable when they are clearer and safer.

## Central Identity and Organization Registry

The Central Registry is the shared foundation for identity and organization data across future NEWAX systems.

Core concepts include:

- `core_people`
- `core_organizations`
- `core_users`
- `core_memberships`
- `core_roles`
- `core_permissions`
- `core_contacts`
- `core_audit_logs`

The Central Registry separates related concepts that are often incorrectly collapsed:

### Person

A real human being represented once across the platform.

A person may exist without having a login account.

### User

A login account linked to a person.

Authentication proves which user is accessing the system. It does not replace the person record.

### Organization

A company, institute, client, branch, department, or other approved organizational entity.

Organizations provide tenant and operational context.

### Membership

The relationship between a person and an organization.

A person may have different memberships, responsibilities, and permissions across different organizations.

### Role

A named grouping of permissions within an organization or approved scope.

Roles improve administration. They must not become hardcoded authorization logic.

### Permission

An explicit authorization capability, such as:

```text
students.view
payments.approve
reports.export
```

Business logic checks permissions, not role names.

## Domain Data Separation

Business domains own domain-specific data.

For the LMS domain, examples include:

- `lms_student_profiles`
- `lms_teacher_profiles`
- `lms_courses`
- `lms_lectures`
- `lms_enrollments`
- `lms_tests`
- `lms_test_results`
- `lms_payments`

Domain tables reference shared identity and organization records through stable identifiers such as:

```text
person_id
organization_id
user_id
membership_id
```

The LMS must not become the identity foundation for future CRM, Legal, Healthcare, Finance, HR, Real Estate, Retail, Hospitality, or other projects.

The Central Registry is the foundation. The LMS is one connected domain.

## Tenant Architecture

NEWAX Core is designed for organization-scoped multi-tenancy.

Tenant-aware architecture requires:

- Clear organization ownership for tenant-scoped records.
- Server-side tenant enforcement.
- Permission-aware access.
- Tenant-safe reports, exports, files, dashboards, and APIs.
- Explicit and auditable cross-organization access.
- Explicit and auditable NEWAX super-admin access.

The client request must not be trusted as the sole source of tenant scope. Authorized organization context must be derived and enforced at trusted backend boundaries.

## Authorization Architecture

Authorization is permission-based.

Rules:

- Roles group permissions.
- Business logic checks explicit permissions.
- Frontend visibility is not a security boundary.
- APIs and services enforce authorization.
- Sensitive actions require specific permissions.
- Permission changes and sensitive access should be auditable.
- Client-specific role names must not alter reusable core authorization behavior.

Authentication, identity, and authorization remain separate concerns.

## Module Communication

Cross-module communication may use:

- Direct service calls.
- Documented APIs.
- Stable contracts.
- Read models.
- Business or system events.

Use direct calls when the dependency is clear, synchronous, and easy to understand.

Use events when multiple independent consumers may react to a completed fact, or when looser coupling provides real operational value.

Examples:

```text
student.created
payment.approved
report.exported
permission.changed
```

Events must:

- Represent completed facts.
- Have a clear owner.
- Use documented payloads.
- Avoid unnecessary sensitive data.
- Avoid hidden dependency cycles.
- Support audit and failure handling where required.

## Client Customization Architecture

Client-specific behavior must remain separate from reusable core modules.

Preferred extension mechanisms:

1. Configuration
2. Approved events and listeners
3. Public module APIs or services
4. Adapters
5. Explicit client extensions

Client customization must document:

- Client name
- Related core module
- Purpose
- Behavior added or changed
- Configuration used
- Events consumed
- Upgrade impact
- Maintenance ownership

Client-specific fields and rules must not be inserted casually into reusable core tables or services.

## Data Ownership Rules

Each module owns its data responsibilities.

Rules:

- A module must document the tables and records it owns.
- A module must not directly modify another module's internal tables.
- Shared identity belongs to Central Registry modules.
- Business-domain tables use domain prefixes.
- Reporting may use approved read models without claiming source-data ownership.
- Schema changes require migration and compatibility review.
- Client-specific fields require an approved extension strategy.

Ownership boundaries protect maintainability, reporting clarity, tenant safety, and controlled change.

## Versioning and Evolution

Reusable modules use semantic versioning.

```text
MAJOR.MINOR.PATCH
```

Architecture evolution should be controlled through:

- Module versions
- Changelogs
- Compatibility notes
- Architecture Decision Records
- Module Registry updates
- Client Deployment Manifests
- Migration and rollback planning

A material architecture change must not be introduced by silently rewriting an existing document as though history had simply agreed to cooperate.

## Service Extraction Criteria

A module may be considered for extraction from the modular monolith when evidence shows a real need, such as:

- Independent scaling requirements
- Strong security or data-isolation requirements
- Independent deployment needs
- Distinct operational ownership
- Technology constraints that cannot be handled cleanly inside the monolith
- Reliability isolation for a critical workload
- External integration boundaries requiring separate operation

Extraction is not justified by fashion, developer preference, or a desire to create more deployment dashboards.

Before extraction:

- Confirm module boundaries are already clean.
- Confirm APIs or events are stable.
- Confirm data ownership is explicit.
- Confirm operational ownership exists.
- Confirm monitoring, deployment, backup, and support responsibilities are defined.
- Record the decision in a new ADR.

## Architecture Decision Records

The accepted architecture decisions are maintained in:

- [ADR Index](../decisions/README.md)

Current decisions cover:

- Modular monolith first
- Permission-based access control
- Multi-tenancy direction
- Client customization separation
- Event-driven module communication
- Controlled updates and versioning
- LMS centralized data ownership
- Central Identity and Organization Registry
- Module Registry and dependency rules
- Authentication and user identity strategy

ADRs record decisions and consequences. Architecture documents explain the broader system structure. Standards translate decisions into recurring engineering rules.

## Architecture Review Triggers

Architecture review is required when a change introduces:

- A new Foundation Module
- A new architecture layer
- A cross-domain dependency
- A circular-dependency risk
- Shared database ownership
- A new tenant model
- Cross-organization access
- A new authentication method
- A major permission model change
- A new external integration boundary
- A new service extraction
- A breaking event or API contract
- A significant client extension mechanism
- A change to Central Registry ownership

## Architecture Review Questions

Before approving a significant design, reviewers should ask:

1. What business problem does this solve?
2. Which module owns the responsibility?
3. Which layer does it belong to?
4. Does an existing module already own this capability?
5. What data does it own?
6. What tenant boundary applies?
7. Which permissions protect it?
8. Which dependencies does it introduce?
9. Could it create a cycle?
10. Does it duplicate central identity or organization data?
11. Is client-specific behavior leaking into reusable core?
12. How will it be tested, secured, versioned, deployed, and supported?
13. What happens when the module changes or fails?
14. Does the design reduce operational complexity or merely relocate it?

## Architecture Documentation Rules

Architecture documentation must be updated when a change affects:

- Layer boundaries
- Dependency direction
- Shared identity ownership
- Tenant strategy
- Authorization model
- Data ownership
- Module communication
- Client extension strategy
- Deployment assumptions
- Service extraction direction

Implementation details that do not change system architecture belong in module documentation, not here.

## Current Architecture Gaps

The main architecture direction is documented, but implementation-specific decisions remain open until the technology stack and first modules are selected.

Expected future architecture work includes:

- Technology stack selection
- Repository build and dependency tooling
- Database and migration tooling
- Authentication implementation approach
- API framework and contract tooling
- Event implementation mechanism
- File-storage provider strategy
- Observability and operational monitoring design
- Backup and recovery implementation
- Deployment platform and CI/CD design
- Registry validation automation

These decisions should be made deliberately before production implementation, not inherited accidentally from whichever dependency was installed first.

## Ownership

Architecture is jointly owned by NEWAX Product, Engineering, Architecture, Security, and Operations according to subject matter.

The architectural objective is to build business infrastructure that remains clear, reliable, secure, scalable, and under NEWAX and client control for years to come.
