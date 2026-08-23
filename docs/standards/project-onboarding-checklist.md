# NEWAX Project Onboarding Checklist

## Purpose

Provide the repeatable gate that moves a NEWAX project domain from an idea to a governed Core
integration, so that onboarding a new project is a known process rather than a fresh negotiation.

This checklist is the project-level counterpart to
[Module Approval Checklist](module-approval-checklist.md), and follows the same principle: a
registry entry tracks something, it does not approve it.

This document is a standard only. It does not create production code, actual environment files,
secrets, deployment scripts, or infrastructure automation.

## 1. Status Lifecycle

A project domain moves through the same lifecycle already used for modules.

| Status     | Meaning                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| planned    | Registered and tracked. Nothing is implemented or approved.               |
| draft      | Implemented against the contract. Not yet approved for governed reliance. |
| active     | Approved at a proved conformance level.                                   |
| deprecated | Superseded or being retired. Still operating.                             |
| replaced   | Superseded by a named successor project.                                  |
| archived   | No longer operating.                                                      |

A `planned` entry means the project is tracked. It does not mean the project has been implemented,
tested, secured, documented, approved, or deployed.

## 2. The Onboarding Path

1. Register the project. This is L0.
2. Provision the database, roles, and Connection Registry entries from the registry entry.
3. Scaffold from `templates/project-integration-template/`.
4. Consume the generated client library for the project's language.
5. Implement the obligations for the project's class at its target level.
6. Prove the level with the conformance suite in the project's own continuous integration.
7. Complete this checklist.
8. Promote the registry entry.

If any step requires a new architecture decision, a new contract, or an exception, stop. That is a
platform gap and is fixed in the platform, not worked around in the project.

## 3. Registration Checklist

Required before `planned`.

- [ ] A `project_key` is assigned. It is lowercase, stable, and not reused from a retired project.
- [ ] The project has a named owner.
- [ ] The owning repository is recorded.
- [ ] An integration class is declared, and the project genuinely fits it.
- [ ] A target conformance level is declared and is available to that class.
- [ ] The technology stack is recorded.
- [ ] The core domains the project will consume are listed.
- [ ] The core entities the project will mirror are listed, or explicitly none.
- [ ] The core entities the project will contribute are listed, or explicitly none.
- [ ] `registry/project-registry.json` parses and the entry validates.
- [ ] The entry contains no credentials, connection strings, or secrets.

## 4. Provisioning Checklist

- [ ] The project database exists per environment, or the entry records that the class has none.
- [ ] The database name matches the registry entry.
- [ ] A distinct database role exists per environment.
- [ ] Roles are separated by purpose, so migration rights and application rights are not the same
      role.
- [ ] No role spans two project databases.
- [ ] No role spans two environments.
- [ ] The project holds no credential to the Core NEWAX Database.
- [ ] Connection Registry entries exist per environment.
- [ ] Credentials are held as secret references, not values, per
      [Environment Standard](environment-standard.md).
- [ ] A documented local development path exists that does not require production infrastructure.

## 5. Architecture Checklist

- [ ] The project owns its own database, or its class explains why it has none.
- [ ] No table in the project database duplicates a core entity outside the `core_mirror_` prefix.
- [ ] No cross-database constraint, extension, or connection exists.
- [ ] Core references use plain UUID columns named for the core entity.
- [ ] The project's own tables use its domain prefix, never `core_`.
- [ ] Tenant scoping is applied inside the project database where it serves more than one tenant.
- [ ] The project does not depend on another project's database.

## 6. Contract Checklist

- [ ] The generated client library is consumed, not hand-written.
- [ ] The generated client is unmodified.
- [ ] The contract version is pinned.
- [ ] No hand-written envelope, signature, or Core API client exists in the project.
- [ ] Signing keys are per project and per environment, held as secret references.
- [ ] Unrecognised payload fields are ignored rather than rejected.

## 7. Level Checklists

Complete the section for the declared level and every level below it that the class supports.

### L1: Identity

- [ ] Tokens are validated against Core.
- [ ] Client-supplied tenant, person, and user identity is never accepted as authority.
- [ ] Trusted context carries `tenantId` and `organizationId` derived server-side.
- [ ] An inactive or deleted tenant invalidates context.
- [ ] Identity resolution failures fail closed.

### L2: Mirrors

- [ ] `core_mirror_*` tables exist only for declared subscriptions.
- [ ] The consumer is the only writer of mirror tables.
- [ ] The consumer is idempotent on `eventId`.
- [ ] Per-record ordering is preserved.
- [ ] The cursor is durable and survives restart.
- [ ] Merge events are applied.
- [ ] Delete and archive events are applied.
- [ ] A dead-letter queue exists, is bounded, and is monitored.
- [ ] A reconciliation job exists and reports drift as a defect.
- [ ] A staleness threshold is declared and monitored.
- [ ] Unresolved-reference behaviour is documented per reference and fails visibly.
- [ ] Backfill converges with the stream without a gap.

### L3: Contribution

- [ ] Submissions go through a durable outbox written in the same transaction as the change.
- [ ] `eventId` is stable across retries.
- [ ] Submissions are signed.
- [ ] Submitted records are treated as candidates, never as canonical.
- [ ] Local-to-core identifier mapping is maintained.
- [ ] Dedupe keys are supplied.
- [ ] A failed submission does not break the project write path.

### L4: Measurement

- [ ] Canonical Growth event names are emitted, not project-specific ones.
- [ ] Consent state is propagated with every event.
- [ ] The project holds no destination credentials.
- [ ] The project does not forward to any destination directly.

### L5: Analytics

- [ ] Telemetry conforms to the published schema.
- [ ] Telemetry carries `tenantId` and `project_key`.
- [ ] Telemetry is submitted through the inbox.

## 8. Security Checklist

- [ ] The project database meets the baseline appropriate to the most sensitive entity it mirrors.
- [ ] Subscriptions to sensitive entities have been reviewed rather than self-selected.
- [ ] Signature verification uses constant-time comparison over raw received bytes.
- [ ] Timestamp windows bound replay.
- [ ] Dead-letter payloads are treated as sensitive.
- [ ] No secret appears in the repository, the registry, the contract, or any envelope.
- [ ] Credential revocation for this project is bounded and complete.

## 9. Documentation Checklist

- [ ] The project documents which core entities it mirrors and why.
- [ ] The project documents its unresolved-reference behaviour.
- [ ] The project documents its staleness threshold.
- [ ] A Class B project documents its conflict policy.
- [ ] The project's integration documentation follows
      [Documentation Standard](documentation-standard.md).

## 10. Promotion

### Planned to draft

- [ ] Registration, provisioning, architecture, and contract checklists complete.
- [ ] The level checklists for the target level are complete.
- [ ] The conformance suite runs in the project's continuous integration.

### Draft to active

- [ ] The conformance suite passes for the declared level.
- [ ] Security checklist complete.
- [ ] Documentation checklist complete.
- [ ] Reconciliation has run and reported no unexplained drift, where the level requires it.
- [ ] An owner is confirmed for ongoing operation.
- [ ] The registry entry's `conformance_level` matches what the suite proved, not the target.

### Approval Record

```text
Project:
Project key:
Integration class:
Conformance level proved:
Reviewed by:
Date:
Outcome:
```

## 11. Reapproval Triggers

Re-run this checklist when:

- The project raises its conformance level.
- The project changes integration class.
- The project adds a subscription to a new core entity.
- The project begins contributing a core entity it did not contribute before.
- The contract version the project pins changes by a breaking version.
- The project database is promoted to a dedicated instance or a different region.

## 12. What Must Never Happen

- A project must never be promoted to `active` on a declared level the suite has not proved.
- A registry entry must never claim a status the project has not reached.
- An exception must never be granted to let a project bypass a platform gap.
- A project must never be onboarded without an owner.
- Provisioning must never issue a project a credential to the Core NEWAX Database.

## 13. Related Documents

- [Project Integration Standard](project-integration-standard.md)
- [Core Data Contract Standard](core-data-contract-standard.md)
- [Module Approval Checklist](module-approval-checklist.md)
- [Environment Standard](environment-standard.md)
- [Security Baseline Standard](security-baseline-standard.md)
- [Core Integration Platform](../architecture/core-integration-platform.md)
- [ADR 0036: Establish Project Identity and Registry](../decisions/0036-establish-project-identity-and-registry.md)
- [ADR 0038: Define Connection Routing and Credential Isolation](../decisions/0038-define-connection-routing-and-credential-isolation.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](../decisions/0041-define-project-integration-classes-and-conformance-levels.md)
