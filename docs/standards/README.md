# NEWAX Engineering Standards

## Purpose

This directory contains the mandatory engineering standards for NEWAX Core, reusable modules, client solutions, packages, and future business infrastructure systems.

These standards define how NEWAX designs, documents, secures, tests, versions, approves, deploys, and maintains reusable infrastructure.

They are internal engineering controls. They do not create production code by themselves.

## How to Use These Standards

A standard defines the minimum acceptable behavior for a class of engineering work.

Before creating or changing a module, package, API, database structure, deployment, or client extension:

1. Identify every applicable standard.
2. Review related ADRs.
3. Implement the feature within the documented boundaries.
4. Update documentation, tests, version records, and changelogs in the same logical change.
5. Complete the required review or approval checklist.
6. Update the Module Registry or Client Deployment Manifest where applicable.

A team may introduce stricter controls for a sensitive system, but it must not silently weaken these standards.

## Recommended Reading Order

New contributors should review the standards in this order:

1. [Module Standard](module-standard.md)
2. [Module Registry Standard](module-registry-standard.md)
3. [Data Model Naming Standard](data-model-naming-standard.md)
4. [API Design Standard](api-design-standard.md)
5. [Security Baseline Standard](security-baseline-standard.md)
6. [Testing Standard](testing-standard.md)
7. [Documentation Standard](documentation-standard.md)
8. [Environment Standard](environment-standard.md)
9. [Package Standard](package-standard.md)
10. [Client Deployment Manifest Standard](client-deployment-manifest-standard.md)
11. [Module Approval Checklist](module-approval-checklist.md)
12. [Core Data Contract Standard](core-data-contract-standard.md)
13. [Project Integration Standard](project-integration-standard.md)
14. [Project Onboarding Checklist](project-onboarding-checklist.md)

## Standards Index

| Standard                                                                      | Primary purpose                                                                                                                                                                    | Applies to                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [Module Standard](module-standard.md)                                         | Defines required module structure, boundaries, files, APIs, services, data ownership, permissions, configuration, events, testing, documentation, versioning, and extension rules. | Every reusable module                                     |
| [Module Registry Standard](module-registry-standard.md)                       | Defines module classification, metadata, lifecycle, naming, dependency direction, versioning, ownership, compatibility, and registration rules.                                    | Module Registry and all registered modules                |
| [Client Deployment Manifest Standard](client-deployment-manifest-standard.md) | Defines how client systems record installed packages, modules, versions, environments, database models, support plans, client extensions, and update policies.                     | Every client deployment                                   |
| [Package Standard](package-standard.md)                                       | Defines how modules are grouped into controlled deployable and sellable packages or solution editions.                                                                             | Packages and solution composition                         |
| [Environment Standard](environment-standard.md)                               | Defines local, development, staging, and production environment expectations, including secrets, access, data handling, backups, logging, and deployment safety.                   | Every project and deployment environment                  |
| [Security Baseline Standard](security-baseline-standard.md)                   | Defines minimum authentication, authorization, tenant isolation, sensitive data, audit, API, file, export, backup, and production security controls.                               | Every module and client system                            |
| [Data Model Naming Standard](data-model-naming-standard.md)                   | Defines table, column, identifier, relationship, timestamp, status, audit, tenant, and domain naming rules.                                                                        | Database designs, models, migrations, and reports         |
| [API Design Standard](api-design-standard.md)                                 | Defines endpoint naming, methods, requests, responses, errors, validation, pagination, filtering, permissions, tenancy, versioning, and deprecation.                               | Internal and client-facing APIs                           |
| [Testing Standard](testing-standard.md)                                       | Defines unit, integration, API, authentication, permission, tenant-isolation, database, event, security, acceptance, staging, and smoke-testing expectations.                      | Every reusable or business-critical capability            |
| [Documentation Standard](documentation-standard.md)                           | Defines required documentation for modules, APIs, permissions, events, configuration, databases, testing, packages, deployments, security, and maintenance.                        | Every reusable module, package, and client solution       |
| [Module Approval Checklist](module-approval-checklist.md)                     | Defines the formal quality gate before a module may move from `draft` to `active`.                                                                                                 | Every module seeking reusable status                      |
| [Core Data Contract Standard](core-data-contract-standard.md)                 | Defines the event envelope, signing scheme, delivery semantics, versioning, and compatibility rules that carry data between the core and project domains.                          | Every core event, inbox submission, and Core API consumer |
| [Project Integration Standard](project-integration-standard.md)               | Defines what a project domain must implement at each conformance level, the naming rules for mirrors and core references, and what must never happen.                              | Every registered project domain                           |
| [Project Onboarding Checklist](project-onboarding-checklist.md)               | Defines the repeatable gate that moves a project domain from `planned` through `draft` to `active` at a proved conformance level.                                                  | Every project domain seeking governed integration         |

## Standards by Engineering Activity

### Designing a New Module

Review:

- [Module Standard](module-standard.md)
- [Module Registry Standard](module-registry-standard.md)
- [Documentation Standard](documentation-standard.md)
- [Module Approval Checklist](module-approval-checklist.md)

Also review the relevant architecture documents and ADRs before implementation.

### Designing Database Structures

Review:

- [Data Model Naming Standard](data-model-naming-standard.md)
- [Security Baseline Standard](security-baseline-standard.md)
- [Testing Standard](testing-standard.md)
- [Documentation Standard](documentation-standard.md)

Shared people and organization identity must remain in the Central Registry. Business-domain tables must not become an accidental second identity system because databases apparently enjoy reproducing ambiguity when left unsupervised.

### Designing APIs

Review:

- [API Design Standard](api-design-standard.md)
- [Security Baseline Standard](security-baseline-standard.md)
- [Testing Standard](testing-standard.md)
- [Documentation Standard](documentation-standard.md)

Protected APIs must enforce authentication, permissions, and tenant boundaries at trusted backend layers.

### Preparing a Client Deployment

Review:

- [Package Standard](package-standard.md)
- [Client Deployment Manifest Standard](client-deployment-manifest-standard.md)
- [Environment Standard](environment-standard.md)
- [Security Baseline Standard](security-baseline-standard.md)
- [Testing Standard](testing-standard.md)

Every production deployment must be traceable to approved modules, exact versions, declared client extensions, a database model, an update policy, and an environment record.

### Approving a Module for Reuse

Review and complete:

- [Module Approval Checklist](module-approval-checklist.md)
- [Module Approval Example](../../templates/approval/module-approval-checklist.example.md)

A module may move to `active` only after its architecture, structure, documentation, permissions, tenancy, data ownership, events, configuration, testing, security, versioning, changelog, and registry metadata have passed review.

## Mandatory Module Evidence

Every reusable module must maintain:

```text
README.md
VERSION
CHANGELOG.md
```

The module must also document:

- Business purpose
- Scope and exclusions
- Architectural layer
- Dependencies
- Permissions
- Exposed and consumed events
- Configuration options
- Database ownership
- Tenant scope
- API behavior where applicable
- Testing expectations
- Security considerations
- Client extension guidance
- Maintenance ownership
- Compatibility and upgrade notes

Missing evidence blocks activation.

## Relationship to Architecture Decision Records

Standards define recurring engineering rules. ADRs record specific architecture decisions and their consequences.

When they interact:

- ADRs establish the decision.
- Standards translate that decision into repeatable engineering rules.
- Module documentation explains how one module follows those rules.
- Approval records provide evidence that the requirements were reviewed.

A standard must not silently contradict an accepted ADR. A material change to an accepted architecture decision requires a new or superseding ADR.

## Relationship to the Module Registry

The operational Module Registry is stored at:

- [NEWAX Module Registry](../../registry/module-registry.json)

Registry metadata must remain aligned with these standards.

For every registered module, verify:

- Module key and layer are correct.
- Version matches the module `VERSION` file.
- Lifecycle status is accurate.
- Dependencies are declared and compatible.
- Permissions and events are documented.
- Database ownership is explicit.
- Tenant scope is explicit.
- Documentation and changelog paths exist.
- Compatibility notes are current.

A registry entry tracks a module. It does not prove the module has been implemented, tested, secured, or approved.

## Reference Templates

The following templates support these standards:

| Template                                                                                                                 | Related standard                    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| [Module Template](../../templates/module-template/README.md)                                                             | Module Standard                     |
| [Module Registry Example](../../templates/module-registry/module-registry.example.json)                                  | Module Registry Standard            |
| [Client Deployment Manifest Example](../../templates/client-deployment-manifest/client-deployment-manifest.example.json) | Client Deployment Manifest Standard |
| [Package Example](../../templates/package/package.example.json)                                                          | Package Standard                    |
| [Environment Example](../../templates/environment/environment.example.md)                                                | Environment Standard                |
| [Security Review Checklist Example](../../templates/security/security-review-checklist.example.md)                       | Security Baseline Standard          |
| [Data Model Naming Example](../../templates/data-model/data-model-naming.example.md)                                     | Data Model Naming Standard          |
| [API Design Example](../../templates/api/api-design.example.md)                                                          | API Design Standard                 |
| [Module Testing Checklist Example](../../templates/testing/module-testing-checklist.example.md)                          | Testing Standard                    |
| [Module README Example](../../templates/documentation/module-readme.example.md)                                          | Documentation Standard              |
| [Module Approval Example](../../templates/approval/module-approval-checklist.example.md)                                 | Module Approval Checklist           |

Templates are starting points and examples. They do not replace engineering judgment, testing, security review, or formal approval.

## Change Control

When changing a standard:

- Explain the reason for the change.
- Review related ADRs and standards.
- Assess effects on active modules and client deployments.
- Update affected templates in the same feature change.
- Record migration or compatibility implications.
- Avoid weakening security, tenant isolation, data ownership, or update controls.
- Use one feature-based commit for the logical standards change.

Material standards changes may require reapproval of affected modules.

## What Must Never Happen

- Do not treat standards as optional suggestions for production work.
- Do not approve a module that fails applicable standards.
- Do not hide client-specific behavior inside reusable modules.
- Do not hardcode role names into business authorization.
- Do not bypass tenant boundaries for convenience.
- Do not introduce undocumented dependencies.
- Do not commit secrets.
- Do not deploy floating or unknown module versions.
- Do not allow documentation and implementation to drift silently.
- Do not change architecture direction by casually editing a standard instead of recording the decision.

## Ownership

These standards are jointly owned by NEWAX Product, Engineering, Architecture, and Security according to subject matter.

Their purpose is to ensure NEWAX builds systems organizations can depend on: clear, controlled, secure, maintainable, and designed for long-term ownership.
