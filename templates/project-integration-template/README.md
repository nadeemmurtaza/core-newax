# NEWAX Project Integration Template

This directory is the official scaffold a NEWAX project domain copies into its own repository to
integrate with the Core NEWAX Database.

It is documentation and structure only. It must not contain production business logic, credentials,
connection strings, or environment files.

## What This Scaffold Is For

Every project domain integrating with Core needs the same pieces: a pinned contract, read models,
a consumer, an outbox, configuration, and tests. Those pieces are the same in every project of a
given integration class, which is why they are scaffolded rather than reinvented.

Only the project's own business logic should be genuinely novel. If a project finds itself writing
an HTTP client for Core, an event envelope, or a signature implementation, something belongs in
Core that is not yet there.

## Before Using This Scaffold

1. Register the project in `registry/project-registry.json` and obtain a `project_key`.
2. Declare an integration class and a target conformance level, per
   [ADR 0041](../../docs/decisions/0041-define-project-integration-classes-and-conformance-levels.md).
3. Read [Project Integration Standard](../../docs/standards/project-integration-standard.md).

## Required Structure

```text
project-integration/
|-- config/
|-- consumer/
|-- contract/
|-- docs/
|-- mirrors/
|-- outbox/
|-- tests/
|-- CHANGELOG.md
|-- README.md
`-- VERSION
```

## What Each Class Uses

Not every folder applies to every project. A project implements what its class and level require
and leaves the rest unused rather than filling it in for completeness.

| Folder      | Class A | Class B | Class C | Class D | Class E |
| ----------- | ------- | ------- | ------- | ------- | ------- |
| `contract/` | Yes     | Yes     | Yes     | Yes     | Yes     |
| `config/`   | Yes     | Yes     | Yes     | Yes     | Yes     |
| `mirrors/`  | Yes     | No      | No      | No      | No      |
| `consumer/` | Yes     | Sync    | No      | No      | No      |
| `outbox/`   | Yes     | Yes     | No      | No      | No      |
| `tests/`    | Yes     | Yes     | Yes     | Yes     | Yes     |
| `docs/`     | Yes     | Yes     | Yes     | Yes     | Yes     |

Class B uses `consumer/` for cursor-based synchronisation, not for consuming the Core delivery
log.

## Rules That Apply To Every Project

- No credentials to the Core NEWAX Database.
- No hand-written Core API client, event envelope, or signature implementation.
- No modification of a generated client library.
- Mirror tables are prefixed `core_mirror_` and written only by the consumer.
- Core references are plain UUID columns named for the core entity.
- The contract version is pinned.

## Related Documents

- [Core Integration Platform](../../docs/architecture/core-integration-platform.md)
- [Core Distribution Architecture](../../docs/architecture/core-distribution-architecture.md)
- [Project Integration Standard](../../docs/standards/project-integration-standard.md)
- [Project Onboarding Checklist](../../docs/standards/project-onboarding-checklist.md)
- [Core Data Contract Standard](../../docs/standards/core-data-contract-standard.md)
