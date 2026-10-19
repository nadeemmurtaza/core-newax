# NEWAX Registries

## Purpose

This directory contains the operational registries used to track reusable NEWAX modules and NEWAX project domains.

The registry is the internal source of truth for module identity, architecture layer, lifecycle status, version, ownership, dependencies, permissions, events, configuration, database ownership, tenant scope, documentation paths, and compatibility notes.

It supports NEWAX as **The Business Infrastructure Company** by keeping reusable infrastructure visible, controlled, and maintainable.

## Files

| File                                           | Purpose                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [module-registry.json](module-registry.json)   | Operational record of tracked NEWAX modules and their metadata.                                            |
| [project-registry.json](project-registry.json) | Operational record of tracked NEWAX project domains, their integration class, and their conformance level. |

Related documentation:

- [Module Registry Standard](../docs/standards/module-registry-standard.md)
- [Module Standard](../docs/standards/module-standard.md)
- [Module Approval Checklist](../docs/standards/module-approval-checklist.md)
- [Documentation Standard](../docs/standards/documentation-standard.md)
- [Module Registry Example](../templates/module-registry/module-registry.example.json)
- [Platform Data Topology](../docs/architecture/platform-data-topology.md)
- [ADR 0036: Establish Project Identity and Registry](../docs/decisions/0036-establish-project-identity-and-registry.md)

## Current Status

The registry is currently:

```text
registry_status: draft
registry_version: 0.1.0
```

Registered modules remain `planned` unless a later approved change records another status.

A planned registry entry means the module concept is tracked. It does not mean the module has been implemented, tested, secured, documented, approved, or deployed.

## Required Module Metadata

Every module entry must include:

- `module_name`
- `module_key`
- `module_layer`
- `module_version`
- `module_status`
- `module_owner`
- `description`
- `dependencies`
- `required_permissions`
- `exposed_events`
- `consumed_events`
- `configuration_options`
- `database_ownership`
- `tenant_scope`
- `documentation_path`
- `changelog_path`
- `compatibility_notes`

Required fields must not be omitted because a module is early. Empty arrays may be used only when the absence is intentional.

## Architecture Layers

Every module belongs to one primary layer.

### Foundation

Shared identity, organization, user, access, and control capabilities.

Examples:

- `people`
- `organizations`
- `memberships`
- `users`
- `authentication`
- `roles`
- `permissions`
- `contacts`

Foundation modules must remain client-neutral and must not depend on platform, business-domain, or client-solution modules.

### Platform Service

Shared operational capabilities used across domains.

Examples:

- `audit`
- `files`
- `notifications`
- `dashboard`
- `reports`

Platform services may depend on Foundation modules. They should remain domain-neutral where practical and must not depend on Client Solutions.

### Business Domain

Reusable capabilities for a defined business domain.

Examples:

- `lms-students`
- `lms-teachers`
- `lms-courses`
- `lms-lectures`
- `lms-enrollments`
- `lms-tests`
- `lms-test-results`
- `lms-payments`

Business-domain modules may depend on approved Foundation and Platform Service modules. They must not contain hidden client-specific behavior.

### Client Solution

Approved compositions of lower-layer modules, packages, configuration, and extensions.

Client Solutions may depend on lower layers. Lower layers must never depend on Client Solutions.

## Dependency Rules

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

Rules:

- Every dependency must be declared.
- Circular dependencies are not allowed.
- Lower layers must not depend on higher layers.
- A module must not directly modify another module's internal data.
- Cross-module interaction must use approved APIs, services, contracts, read models, or events.
- Events must not be used to disguise unclear ownership.

## Central Registry Rule

The Central Identity and Organization Registry is the shared foundation for future NEWAX domains.

Shared concepts include:

- People
- Organizations
- Memberships
- Users
- Roles
- Permissions
- Contacts
- Audit context

Domain modules should reference shared records through approved identifiers such as:

```text
person_id
organization_id
user_id
membership_id
```

The LMS is one connected domain. It is not the center of NEWAX Core. Future CRM, Legal, Healthcare, Finance, HR, Real Estate, Retail, Hospitality, and other domains must not depend on LMS tables for shared identity.

## Module Lifecycle

Valid statuses:

```text
planned
draft
active
deprecated
replaced
archived
```

Normal progression:

```text
planned -> draft -> active -> deprecated -> replaced or archived
```

Meaning:

- `planned`: Tracked but not implemented or approved.
- `draft`: Under design, implementation, documentation, or testing.
- `active`: Approved for controlled reuse.
- `deprecated`: Not selected for new deployments.
- `replaced`: Superseded by another module or major version.
- `archived`: No longer maintained or approved for deployment.

A module must not move to `active` without formal approval evidence.

## Version Rules

Module versions use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

Rules:

- Planned modules may begin at `0.1.0`.
- Registry versions must match module `VERSION` files once implemented.
- Versions must align with changelog entries.
- Breaking changes require appropriate version and migration review.
- Client Deployment Manifests must use exact approved versions.
- Do not use `latest` in production records.

## Adding a Module

Before adding a module:

1. Confirm it owns a distinct responsibility.
2. Confirm an existing module does not already own that responsibility.
3. Select the correct architecture layer.
4. Define a stable lowercase kebab-case key.
5. Declare dependencies and version expectations.
6. Define permissions and events.
7. Define configuration and database ownership.
8. Define tenant scope.
9. Define documentation and changelog paths.
10. Add compatibility notes.
11. Set the initial status to `planned` unless approved evidence supports another status.
12. Validate the complete registry.

A single client request does not automatically justify a reusable module. First determine whether the requirement belongs in configuration, a client extension, an existing module, or a genuinely reusable capability.

## Updating a Module Entry

Update the registry when any of these change:

- Purpose or ownership
- Architecture layer
- Lifecycle status
- Version
- Dependencies
- Permissions
- Events
- Configuration
- Database ownership
- Tenant scope
- Documentation or changelog path
- Compatibility notes

Registry updates should be committed with the related feature change where practical.

## Activating a Module

Before changing a module to `active`, verify:

- [ ] It follows the Module Standard.
- [ ] `README.md` exists and is complete.
- [ ] `VERSION` exists.
- [ ] `CHANGELOG.md` exists.
- [ ] Registry version matches `VERSION`.
- [ ] Dependencies are declared and compatible.
- [ ] Permissions are documented and enforced.
- [ ] Events are documented.
- [ ] Configuration is documented.
- [ ] Database ownership is explicit.
- [ ] Tenant scope is explicit and tested where applicable.
- [ ] Required tests pass.
- [ ] Security review is complete where applicable.
- [ ] Client-specific behavior is separated from reusable core logic.
- [ ] Product and Engineering approval is recorded.
- [ ] The Module Approval Checklist is complete.

No critical requirement may be dismissed with "we will fix it later," humanity's most durable undocumented dependency.

## Registry Validation Checklist

### File integrity

- [ ] JSON is valid.
- [ ] Every entry has all required fields.
- [ ] Module keys are unique.
- [ ] Structures are consistent.

### Architecture

- [ ] Every module has a valid layer.
- [ ] Dependency direction is valid.
- [ ] No circular dependencies exist.
- [ ] Foundation modules do not depend on LMS or client solutions.

### Versions

- [ ] Versions use semantic versioning.
- [ ] Implemented module versions match `VERSION` files.
- [ ] Dependency ranges are explicit.
- [ ] Production references do not use floating versions.

### Documentation

- [ ] Documentation paths exist for implemented modules.
- [ ] Changelog paths exist for implemented modules.
- [ ] Documentation matches registry metadata.

### Permissions and events

- [ ] Permission keys follow approved naming.
- [ ] Event names follow approved naming.
- [ ] Consumed events have valid publishers where applicable.
- [ ] Sensitive payloads are minimized.

### Database ownership

- [ ] Table names use approved prefixes.
- [ ] Shared identity remains in Central Registry modules.
- [ ] Two modules do not claim the same table without approval.
- [ ] Tenant-scoped data identifies organization ownership where required.

### Status and approval

- [ ] Status reflects actual maturity.
- [ ] Active modules have approval evidence.
- [ ] Deprecated and replaced modules include guidance.
- [ ] Archived modules are excluded from new deployments.

## Documentation Path Policy

A planned module may list its required future documentation path before the file exists.

Interpretation:

- `planned`: The path identifies the expected future location.
- `draft`: The file should normally exist while implementation progresses.
- `active`: The file must exist and be complete.

A missing documentation or changelog path blocks activation.

## Database Ownership Policy

- Each module must own clearly defined persistence responsibilities.
- A module must not directly modify another module's internal tables.
- Shared identity belongs to Central Registry modules.
- Business-domain tables use domain prefixes.
- Client-specific fields must not be inserted into reusable core tables without an approved extension strategy.
- Reports may use approved read models but do not own source-domain data.

Database ownership is a control boundary, not decorative metadata.

## Client Deployment Relationship

The Module Registry answers:

> Which reusable modules exist, and what are their approved characteristics?

A Client Deployment Manifest answers:

> Which approved modules, versions, packages, configuration, and client extensions are installed for one client system?

Rules:

- A deployment must not reference an unknown module key.
- Production deployments must use exact versions.
- Archived modules must not be selected for new deployments.
- Client-specific extensions remain separate unless formally promoted into reusable modules.
- Updating the registry does not automatically update client deployments.

## Package Relationship

- Every packaged module must exist in the registry.
- Package definitions must respect dependencies.
- Package versions must not hide module versions.
- Optional and excluded modules must be explicit.
- Packages do not replace registry governance.

## Commit Strategy

Registry changes use feature-based commits.

Good examples:

```text
Add initial Module Registry
Register LMS enrollment module
Activate People module v1.0.0
Deprecate legacy reporting module
```

Avoid vague file-based messages such as:

```text
Edit JSON
Update registry file
Fix commas
```

The commit should describe the architecture or business change, not merely admit that text moved.

## Review Ownership

Registry governance is shared across:

- Product, for business purpose and scope
- Engineering, for implementation and dependencies
- Architecture, for layers and ownership boundaries
- Security, for access, tenancy, and sensitive data
- Operations or Support, for deployment and compatibility impact

## What Must Never Happen

- Do not mark an unimplemented module `active`.
- Do not treat a registry entry as implementation evidence.
- Do not create duplicate or client-specific reusable keys.
- Do not hide dependencies or create cycles.
- Do not allow Foundation modules to depend on LMS or Client Solutions.
- Do not duplicate central identity ownership inside business domains.
- Do not claim tables owned by another module.
- Do not use floating production versions.
- Do not activate modules with missing documentation, tests, security review, or approval.
- Do not allow the registry and deployed reality to drift silently.

## Long-Term Direction

The registry should eventually support automated validation for:

- JSON schema compliance
- Unique module keys
- Valid statuses
- Semantic versions
- Dependency existence
- Dependency cycles
- Layer violations
- Missing documentation paths
- Version mismatches
- Duplicate database ownership
- Permission and event naming
- Package and deployment compatibility

Automation should enforce approved rules, not invent architecture decisions without review.

## Final Principle

The Module Registry exists so NEWAX can understand what infrastructure it owns, how that infrastructure fits together, and whether it is safe to reuse.

A disciplined registry improves visibility, protects module boundaries, supports controlled deployment, and gives NEWAX long-term control over the systems it builds.
