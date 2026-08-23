# NEWAX Core Convergence Map

## Purpose

This document records where NEWAX project domains currently duplicate Central Registry concepts,
and defines what happens to each duplicate table: whether it becomes a mirror, stays project-owned,
or is retired.

It exists because the surrounding architecture documents describe a target state, and a target
state with no migration path is a description of a system nobody will build.

This document is for internal NEWAX engineering use. It does not define implementation code,
database migrations, or production modules.

## Core Principle

Nothing is retired before its replacement is proved.

Convergence follows the conformance levels defined by ADR 0041. A project cannot retire a local
table until it holds a working mirror, and it cannot hold a working mirror until it is at L2.

## 1. Current Duplication

The following concepts exist in more than one place today. None of these project implementations
was a mistake: there was no contract to follow, and each project needed the concept to function.

| Concept        | Core NEWAX Database           | Other project domains                                                                    |
| -------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| User and auth  | `CoreUser`, `CoreUserSession` | A commerce project holds its own user and refresh token model                            |
| Address        | `CoreAddress`                 | A commerce project holds its own address model; a lead project holds branch addresses    |
| Audit log      | `CoreAuditLog`                | Three project domains each hold their own audit model                                    |
| Person         | `CorePerson`                  | A lead project holds person candidates; a messaging project holds contacts               |
| Contact method | `CoreContactMethod`           | A lead project holds contact points; a messaging project holds contacts                  |
| Organization   | `CoreOrganization`            | A lead project holds canonical institutions and branches                                 |
| Lead           | Not yet in core               | Three project domains hold their own lead or candidate models                            |
| Segment        | Not yet in core               | A commerce project holds segments and tags                                               |
| Consent        | Not yet in core               | A messaging project holds consent; a lead project holds compliance and complaint records |
| Outbox         | Not yet in core               | Two project domains hold independent outbox implementations                              |

Two observations matter more than the list itself.

The duplication is not static. Each project continues to develop its copy, so the definitions
diverge further with every release until a contract exists.

The core is behind its own spokes in one place: two projects have working outbox implementations
and the core has none. Convergence there means the core adopting a proven pattern, not projects
adopting an unproven one.

## 2. Disposition Categories

Every duplicated table falls into exactly one category.

**Becomes a mirror.** The concept is core-owned. The project keeps a `core_mirror_*` read model
and retires its local table once the mirror is proved.

**Stays project-owned as staging.** The concept looks like a core concept but is genuinely
different: it holds candidates, not canonical records. It stays, and its relationship to the core
record is made explicit.

**Stays project-owned outright.** The concept is domain-specific despite a similar name.

**Converges into core.** The concept belongs in core, core does not yet have it, and the project
implementation is the input to the core design.

**Retired.** The concept is replaced with no successor in the project.

## 3. Disposition By Concept

### Identity and access

| Concept               | Disposition         | Notes                                                                                                                                              |
| --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| User, refresh token   | Becomes a mirror    | Authentication moves to core at L1. The local user table becomes a mirror, then retires. Highest-risk item in this map: it changes the login path. |
| Person                | Becomes a mirror    | Requires L2.                                                                                                                                       |
| Person candidate      | Stays as staging    | A candidate is not a person. This distinction is already correct and must survive convergence.                                                     |
| Contact method        | Becomes a mirror    | Requires L2. Contribution of new contact methods requires L3.                                                                                      |
| Organization          | Becomes a mirror    | Requires L2.                                                                                                                                       |
| Canonical institution | Stays as staging    | The project's canonical record is the input to a core organization, not the organization.                                                          |
| Address               | Becomes a mirror    | Requires L2.                                                                                                                                       |
| Branch address        | Stays project-owned | A branch is a lead-domain concept until modelled as a core organization relationship.                                                              |

### Audit

| Concept   | Disposition         | Notes                                                                                                                                                                                 |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit log | Stays project-owned | Each project keeps its own audit of its own actions. Core audits core actions. These are different records and merging them would be wrong. Core audit is not mirrored into projects. |

### Growth

| Concept                      | Disposition         | Notes                                                                                                        |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Lead                         | Converges into core | Three implementations are the input to the core Growth design. None is adopted wholesale.                    |
| Segment                      | Converges into core | Includes tags and audience definitions.                                                                      |
| Interaction, touchpoint      | Converges into core | Required for cross-project attribution.                                                                      |
| Consent                      | Converges into core | Highest priority in this map. Consent split across databases is a compliance exposure, not an inconsistency. |
| Suppression, complaint       | Converges into core | Follows consent.                                                                                             |
| Sequence, delivery mechanics | Stays project-owned | How a message is sent is domain-specific. Whether it may be sent is core.                                    |

### Distribution

| Concept | Disposition         | Notes                                                                                                                                                                                              |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outbox  | Stays project-owned | Every contributing project needs its own outbox. The two existing implementations converge on the shared envelope rather than being replaced. Core builds its own outbox; it does not inherit one. |

#### Specific divergence between the two existing outbox implementations

Recorded from current source rather than from memory, because these are the gaps convergence has
to close.

| Property         | Lead project implementation                         | Commerce project implementation                     |
| ---------------- | --------------------------------------------------- | --------------------------------------------------- |
| Event identifier | UUID, reused across every retry                     | Generated identifier, not tied to an envelope       |
| Event type field | `event_type`, carried in a versioned envelope       | `name`, no envelope                                 |
| Backoff field    | `next_attempt_at`                                   | `availableAt`                                       |
| Attempt counter  | `attempt_count`                                     | `attempts`                                          |
| Terminal failure | Dead letter, terminal, requires an operator requeue | Failed, with no distinct terminal dead-letter state |
| Signed envelope  | Yes, with timestamp and signature headers           | No                                                  |

Two gaps matter more than the naming differences.

The commerce implementation has no terminal dead-letter state, so a permanently failing event has
no defined resting place and no operator requeue path. The contract standard requires one.

The commerce implementation has no envelope, so its events carry no stable identifier across
retries. Without that the core inbox cannot deduplicate its submissions, which is the property that
makes at-least-once delivery safe.

Convergence for both is adopting the shared envelope and delivery semantics, not rewriting the
storage. The lead project's implementation is already close to the target and needs the transport
header rename and the added envelope fields described in the contract standard.

## 4. Convergence Order

Order is chosen by risk and by dependency, not by convenience.

**Stage 1: consent.** Consent converges first because the cost of delay is regulatory rather than
technical, and because it does not depend on any mirror being in place.

**Stage 2: identity at L1.** Projects resolve tenant, person, and user identity through core.
This unblocks everything else, because a shared person identifier is the prerequisite for every
later stage.

**Stage 3: mirrors at L2.** Person, organization, contact method, and address mirrors are built and
proved. Local duplicates continue to operate in parallel and are not yet retired.

**Stage 4: retirement.** Local duplicates are retired only after reconciliation reports no
unexplained drift between the mirror and core over a sustained period.

**Stage 5: contribution at L3.** Projects submit candidate records through the contract. The
existing project producer converges on the shared envelope.

**Stage 6: growth and measurement.** Lead, segment, touchpoint, and attribution converge, followed
by measurement containers and destinations.

Stages 1 and 2 are independent and may run in parallel. Stage 4 must not begin before Stage 3 is
proved for the entity in question.

## 5. Rules For Every Convergence

- The mirror runs in parallel with the local table before the local table is retired.
- Reconciliation must report no unexplained drift before retirement.
- Retirement is a separate change from mirror introduction, so it can be reverted independently.
- No project retires a table because another project did. Each proves its own mirror.
- Identifier mapping between local and core identifiers is retained after retirement. Discarding it
  makes historical records unresolvable.
- A concept that turns out to be genuinely domain-specific stops converging and is reclassified.
  Discovering this is a legitimate outcome, not a failure.

## 6. What This Map Is Not

It is not a schedule. It records order and dependency, not dates.

It is not a commitment that every listed concept converges. A disposition may change when the core
design for that domain is written, and this document is updated when it does.

## 7. Related Documents

- [Growth and Measurement Architecture](growth-and-measurement-architecture.md)
- [Platform Data Topology](platform-data-topology.md)
- [Core Integration Platform](core-integration-platform.md)
- [Project Integration Standard](../standards/project-integration-standard.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](../decisions/0041-define-project-integration-classes-and-conformance-levels.md)
- [ADR 0044: Establish Master Data Governance](../decisions/0044-establish-master-data-governance.md)
- [ADR 0045: Establish Growth Domain](../decisions/0045-establish-growth-domain.md)
