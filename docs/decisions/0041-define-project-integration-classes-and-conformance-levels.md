# ADR 0041: Define Project Integration Classes and Conformance Levels

## Purpose

Define a fixed vocabulary for how a project domain integrates with the Core NEWAX Database, so
that onboarding a new project is a selection from known options rather than a new architecture
decision.

## 1. Decision Title

ADR 0041: Define Project Integration Classes and Conformance Levels

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0035 through ADR 0040 define the topology, the identity, the reference rules, the connection
model, and the distribution mechanism. Together they describe what a full integration looks like.

They do not describe a partial one, and most projects are partial. A marketing site has no
database to mirror into. A mobile client has a device-local store that cannot hold a durable
platform subscription. A third-party system has no NEWAX repository at all. A reporting tool needs
none of the operational machinery.

Applying the full integration surface to all of them is wrong, and letting each decide for itself
is how the current divergence happened.

## 5. Problem

Without a fixed vocabulary, two costs recur.

Every onboarding restarts the same conversation about which parts apply, and reaches a slightly
different answer, because nothing records what was decided last time.

Nothing can be automated. Provisioning, subscription setup, scaffold selection, and conformance
checking all need to know what a given project is supposed to implement, and none of them can
know if the answer is bespoke.

There is also no vocabulary for partial progress. A project that has core identity working but no
mirrors yet is in a legitimate intermediate state, and without names for these states it is
described as unfinished rather than as conformant at a lower level.

## 6. Decision

Every project domain declares two values in `registry/project-registry.json`.

**An integration class**, describing the shape of the project. Exactly one applies.

| Class | Description                     | Integration surface                                                       |
| ----- | ------------------------------- | ------------------------------------------------------------------------- |
| A     | Service with its own database   | Full: client library, `core_mirror_*` read models, outbox and inbox       |
| B     | Offline-first client            | Client library, sync cursor, declared conflict policy. No server consumer |
| C     | Stateless web property          | Measurement and tag registration, read-only client library calls          |
| D     | External or third-party system  | Core-owned adapter. Never holds a mirror, never holds core credentials    |
| E     | Analytics or reporting consumer | Rollup store access only. No operational reads                            |

**A conformance level**, describing integration depth. Levels are additive within the set the
class supports.

| Level | Grants                                          | Requires                                                       |
| ----- | ----------------------------------------------- | -------------------------------------------------------------- |
| L0    | A `project_key` and a place in the platform map | A project registry entry                                       |
| L1    | Core identity resolution                        | Token validation and trusted context handling                  |
| L2    | Local `core_mirror_*` read models               | An idempotent consumer, a durable cursor, a reconciliation job |
| L3    | The right to submit candidate records           | A signed outbox, dedupe keys, external reference mapping       |
| L4    | Growth attribution and destination forwarding   | Canonical event emission and consent propagation               |
| L5    | Inclusion in cross-project analytics            | Telemetry schema conformance                                   |

Levels available per class:

| Class | L0  | L1  | L2  | L3  | L4  | L5  |
| ----- | --- | --- | --- | --- | --- | --- |
| A     | Y   | Y   | Y   | Y   | Y   | Y   |
| B     | Y   | Y   | -   | -   | Y   | Y   |
| C     | Y   | Y   | -   | -   | Y   | Y   |
| D     | Y   | -   | -   | Y   | Y   | Y   |
| E     | Y   | Y   | -   | -   | -   | Y   |

L2 requires a server-side database and a durable subscription, which classes B, C, D, and E do not
have. A Class D system reaches L3 through its Core-owned adapter rather than through its own code.

**A declared level is a claim.** It is proved by the conformance suite for that level, run in the
project's own continuous integration, and reviewed through
`docs/standards/project-onboarding-checklist.md`. The project registry entry moves from `planned`
to `draft` to `active` on that evidence, following the lifecycle already defined for modules.

**The vocabulary is closed.** A project that fits no class, or needs a capability no level grants,
is evidence of a platform gap. The gap is fixed by amending this ADR, not by carving an exception
into one project.

## 7. Reasoning

Two axes are used rather than one because shape and depth vary independently. A web property and a
mobile client differ in shape but may reach the same measurement depth; two services of identical
shape may integrate at very different depths. Collapsing these into a single scale would force
false equivalences.

Fixing the vocabulary is what makes automation possible. Provisioning, subscription setup, scaffold
selection, and conformance checking can all key off two declared values. None of that works if the
answer is bespoke per project.

Naming intermediate levels gives partial integration a legitimate status. A project at L1 is
conformant at L1, not failing at L3, and it can be governed and trusted accordingly.

Requiring proof rather than accepting the declaration is what keeps the registry truthful as
project count grows. Twenty projects cannot be kept conformant by twenty manual reviews, but they
can each run a suite.

Closing the vocabulary is the load-bearing constraint. An open vocabulary reverts to the current
state within a few projects, because the easiest response to a project that does not fit is always
to make an exception.

## 8. Alternatives Considered

**A single integration level with no classes.** Simpler. Rejected because it either demands
machinery that classes B, C, D, and E cannot provide, or weakens to the least common denominator
and stops describing Class A usefully.

**Per-project bespoke integration descriptions.** Maximum flexibility. Rejected because it is the
current state, prevents automation entirely, and is the direct cause of the divergence across
existing project domains.

**Classes only, with no levels.** Rejected because it cannot express partial progress, so every
project is either fully integrated or undescribed, and incremental adoption becomes invisible.

**Deriving class and level from repository contents.** Attractive because it cannot drift.
Rejected because intent is not inferable: a project with no mirror tables may be Class C by design
or Class A that has not built them yet, and those are different situations.

## 9. Consequences

Positive:

- Onboarding is a selection, not a design exercise.
- Provisioning, subscriptions, scaffolding, and conformance checking can be automated.
- Partial integration has a name and a governed status.
- Platform gaps surface as gaps rather than as per-project exceptions.
- Every project's obligations are knowable from its registry entry.

Cost:

- The vocabulary must be maintained, and amending it is a governance action.
- A conformance suite must exist per level, which is real work deferred to a later phase.
- Projects that predate this decision must be classified retrospectively.
- A project genuinely not fitting any class blocks on an ADR amendment rather than proceeding.

## 10. Impact On NEWAX Core

Core owns the class and level definitions, the conformance suite for each level, and the scaffold
for each class.

The obligation runs both ways: if a class exists, Core must provide what a project of that class
needs. A class with no scaffold and no suite is a promise Core has not kept.

## 11. Impact On Client Systems

A client deployment can be described as the set of projects enabled for that tenant with their
classes and levels, which makes deployment scope and data flow inspectable rather than inferred.

## 12. Security Considerations

Level determines privilege. L3 grants the right to submit candidate records; L2 grants a
subscription to core data. Promotion is therefore a privilege grant and must be reviewed, not
self-asserted.

Class D is the sharpest boundary. A third-party system is outside NEWAX control, holds no core
credentials, and never holds a mirror. Its adapter is owned by Core so that the trust boundary sits
inside code NEWAX governs.

The prohibition on exceptions is a security control as much as an architectural one. Exceptions
accumulate as unreviewed privilege.

## 13. Scalability Considerations

This decision is the primary mechanism keeping per-project onboarding cost flat. Cost per project
is bounded by what its class and level require, and the shared parts are built once in Core.

Growth in project count increases conformance suite runs, which are per-project and parallel, and
subscription count, which ADR 0040 addresses.

## 14. Maintenance Considerations

Declared levels drift from reality unless proved continuously. The conformance suite must run in
each project's continuous integration on every change, not once at onboarding.

Adding a class or level is a governance action with real cost, because each requires a scaffold and
a suite. That cost is the point: it keeps the vocabulary small.

## 15. Related Documents

- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Project Integration Standard](../standards/project-integration-standard.md)
- [Project Onboarding Checklist](../standards/project-onboarding-checklist.md)
- [Module Approval Checklist](../standards/module-approval-checklist.md)
- [ADR 0036: Establish Project Identity and Registry](0036-establish-project-identity-and-registry.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)

## 16. Approved By

NEWAX Engineering and Architecture.
