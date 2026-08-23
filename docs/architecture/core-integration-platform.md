# NEWAX Core Integration Platform

## Purpose

This document defines how a NEWAX project domain integrates with the Core NEWAX Database, and how
that integration stays cheap as the number of project domains grows.

It exists to answer one question in advance rather than repeatedly: when NEWAX starts a new
project, what does connecting it to the core involve?

This document is for internal NEWAX engineering use. It does not define implementation code,
database migrations, or production modules.

## Core Principle

Integrating a project must be a governed, largely mechanical process, not an architecture
exercise.

A platform that integrates its known projects by hand stops scaling at the next one. The platform
therefore defines a small number of project shapes, a small number of integration depths, one
contract, one scaffold, and one conformance gate. A new project selects from these rather than
inventing.

## 1. The Problem This Solves

Every integration decision that is left open becomes a decision each project makes independently.
Independently made decisions diverge, and divergence is not visible until two projects need to
agree about something.

NEWAX has already seen this. Several project domains have each built their own person, contact,
address, audit, and outbox concepts, defined differently in each project and in more than one
language. None of those projects did anything wrong. There was no contract to follow.

The cost of the missing contract is not paid once. It is paid again by every project, and it
grows, because each new project both reimplements the same concepts and diverges from a larger
number of existing implementations.

## 2. Integration Classes

Not every project has the same shape. A server with its own PostgreSQL database, a mobile app
with a device-local store, and a static marketing site cannot integrate identically, and
pretending otherwise produces a contract that fits none of them.

NEWAX defines five integration classes. Every project belongs to exactly one.

| Class | Description                     | Integration surface                                                       |
| ----- | ------------------------------- | ------------------------------------------------------------------------- |
| A     | Service with its own database   | Full: SDK, `core_mirror_*` read models, outbox and inbox                  |
| B     | Offline-first client            | SDK, sync cursor, declared conflict policy. No server-side event consumer |
| C     | Stateless web property          | Measurement and tag registration, read-only SDK calls                     |
| D     | External or third-party system  | Core-owned adapter. Never holds a mirror                                  |
| E     | Analytics or reporting consumer | Rollup store access only. No operational reads                            |

### Class A: service with its own database

The standard shape. The project owns a PostgreSQL database, maintains `core_mirror_*` read models
from Core events, and may contribute candidate records back to the Central Registry.

### Class B: offline-first client

The project's store lives on a device, not on a server. It is not a project database and must not
be treated as one: it cannot hold a durable subscription cursor on behalf of the platform, it is
frequently offline, and its contents are outside NEWAX operational control.

A Class B project synchronises through a cursor and must declare a conflict policy. It does not
consume the Core delivery log.

### Class C: stateless web property

The project holds no database. Its integration is measurement and tag registration plus read-only
Core API calls.

This class matters more than its simplicity suggests. A Class C project reaches full measurement
integration by registering a container in Core, not by shipping integration code. That is what
keeps web-property onboarding close to free.

### Class D: external or third-party system

A system NEWAX does not control, such as a third-party CRM or an advertising platform.

The adapter is owned by Core, not by a project, because there is no NEWAX repository in which to
put it. A Class D system never holds a mirror and never receives Core credentials.

### Class E: analytics or reporting consumer

A read-only consumer of the analytics rollup store. It performs no operational reads against
either the Core NEWAX Database or any project database.

## 3. Conformance Levels

Class describes the shape of a project. Level describes how deeply it integrates. The two are
independent: a Class C web property can reach L4 without ever reaching L2, because it has no
database to mirror into.

Levels are additive within the set a class supports.

| Level | Grants                                             | Requires                                                       |
| ----- | -------------------------------------------------- | -------------------------------------------------------------- |
| L0    | A `project_key` and a place in the platform map    | A project registry entry                                       |
| L1    | Core identity: tenant, person, and user resolution | Token validation and trusted context handling                  |
| L2    | Local `core_mirror_*` read models for local joins  | An idempotent consumer, a durable cursor, a reconciliation job |
| L3    | The right to submit candidate records to Core      | A signed outbox, dedupe keys, external reference mapping       |
| L4    | Growth attribution and destination forwarding      | Canonical event emission and consent propagation               |
| L5    | Inclusion in cross-project analytics               | Telemetry schema conformance                                   |

### Which levels each class can reach

| Class | L0  | L1  | L2  | L3  | L4  | L5  |
| ----- | --- | --- | --- | --- | --- | --- |
| A     | Y   | Y   | Y   | Y   | Y   | Y   |
| B     | Y   | Y   | -   | -   | Y   | Y   |
| C     | Y   | Y   | -   | -   | Y   | Y   |
| D     | Y   | -   | -   | Y   | Y   | Y   |
| E     | Y   | Y   | -   | -   | -   | Y   |

L2 requires a server-side database and a durable subscription, which classes B, C, D, and E do not
have. A Class D system reaches L3 through its Core-owned adapter rather than through its own code.

### A declared level is a claim

A project declares its class and level in `registry/project-registry.json`. The declaration is a
claim until the conformance suite proves it, and the onboarding checklist promotes the project
from planned through draft to active.

This mirrors the rule already applied to modules: a registry entry tracks something, it does not
approve it.

## 4. What Core Provides and What a Project Builds

The division is deliberate. Anything every project would otherwise build identically belongs to
Core.

Core provides:

- The contract definition, as an API specification and an event specification.
- Generated client libraries for each supported language.
- The event envelope, its signing scheme, and its versioning rules.
- The delivery log and per-subscriber cursors.
- The inbox that accepts candidate records and telemetry.
- The conformance suite that proves a declared level.
- A project integration scaffold.

A project builds:

- Its own schema, including its `core_mirror_*` tables where its class supports them.
- Its consumer, which applies Core events to its mirrors idempotently.
- Its reconciliation job.
- Its unresolved-reference behaviour, as ADR 0037 requires.
- Its own business logic, which is the only part that should be genuinely novel.

If a project finds itself writing an HTTP client for Core, defining an event envelope, or
inventing a signature scheme, something belongs in Core that is not yet there.

## 5. The Onboarding Path

The path is the same for every project. Only the class and level differ.

1. Register the project. Add an entry to `registry/project-registry.json` with a `project_key`,
   its class, and its target level. Status is `planned`. This is L0.
2. Provision. The registry entry drives database and credential provisioning and the Connection
   Registry entries defined by ADR 0038.
3. Scaffold. Copy `templates/project-integration-template/` into the project repository.
4. Generate. Pull the generated client library for the project's language from the contract.
5. Implement to the target level. Only the parts the class and level require.
6. Prove. Run the conformance suite for the declared level in the project's own continuous
   integration.
7. Review. Complete `docs/standards/project-onboarding-checklist.md`.
8. Promote. Move the registry entry from `planned` to `draft` to `active`.

No step in this path requires a new architecture decision. If a project cannot be onboarded
without one, the platform has a gap, and the gap is fixed in the platform rather than worked
around in the project.

## 6. How This Stays Scalable

Four properties keep per-project cost flat rather than growing with project count.

**One contract, generated clients.** The contract is defined once, in a language-neutral form,
and client libraries are generated from it. Adding a language costs one generator, not one hand
written client per project.

**Fan-out by subscription, not by wiring.** Core writes an event once. Each subscriber has its own
cursor and its own retry state. Adding a subscriber adds a row, not a code path. Point-to-point
webhooks would instead require configuring a new destination in the producer for every new
consumer.

**Conformance proved by the project, not reviewed by hand.** Each project runs the conformance
suite in its own continuous integration. Keeping twenty projects conformant does not require
twenty manual reviews.

**Classes bound the surface.** A project's class determines what it must implement. A Class C web
property is never asked to build a consumer it has no database for.

## 7. What This Document Does Not Decide

- The event envelope, signing, and delivery guarantees, defined by
  [Core Distribution Architecture](core-distribution-architecture.md) and its ADRs.
- The schema of any core domain.
- The contents of the conformance suite, which is built in a later phase.

## 8. Related Documents

- [Platform Data Topology](platform-data-topology.md)
- [Core Distribution Architecture](core-distribution-architecture.md)
- [Core Architecture](core-architecture.md)
- [Project Integration Standard](../standards/project-integration-standard.md)
- [Project Onboarding Checklist](../standards/project-onboarding-checklist.md)
- [Core Data Contract Standard](../standards/core-data-contract-standard.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](../decisions/0041-define-project-integration-classes-and-conformance-levels.md)
- [ADR 0042: Adopt Contract-First SDK Generation](../decisions/0042-adopt-contract-first-sdk-generation.md)
