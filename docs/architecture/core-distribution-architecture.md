# NEWAX Core Distribution Architecture

## Purpose

This document defines how Central Registry data reaches project databases, and how a project
returns candidate records and telemetry to the core, now that ADR 0035 places them in separate
databases.

This document is for internal NEWAX engineering use. It does not define implementation code,
database migrations, or production modules.

## Core Principle

Core publishes. Projects subscribe. Core never reads a project database.

Data moves outward from the Central Registry as replicated read models, and inward from projects
as explicit contributions. There is no third path, and in particular there is no path in which a
project queries the Core NEWAX Database directly.

## 1. Two Directions, Two Mechanisms

The two directions have different trust properties and therefore different mechanisms.

**Outward, core to project.** Core is authoritative. A project receives a stream of changes and
applies them to its `core_mirror_*` tables. The project has no say in the content. Delivery is
asynchronous and eventually consistent.

**Inward, project to core.** The project is proposing, not asserting. It submits a candidate
record or a telemetry event through a signed inbox. Core decides whether the candidate creates a
record, matches an existing one, or requires review.

Conflating these produces the failure this architecture exists to prevent: a project overwriting
canonical data because the same channel carried both meanings.

## 2. Outward Distribution

### The delivery log

Core writes each change once to an outbox as part of the transaction that made the change. A
separate delivery process moves outbox entries into a delivery log, and each subscribed project
has its own cursor into that log, its own retry state, and its own dead-letter queue.

The property that matters: adding a subscriber adds a row, not a code path.

Point-to-point webhooks, where the producer holds a configured destination per consumer, fail
here. Every new project requires producer configuration, a redeploy, and its own failure
handling, and one slow consumer delays the others. NEWAX already has a producer of that shape and
its limits are the reason this design differs.

### Why the delivery log lives in PostgreSQL

ADR 0011 defines the NEWAX technology baseline, and it contains no message broker. Introducing
one is a baseline change with real operational cost: another system to run, secure, monitor,
back up, and understand during an incident.

A PostgreSQL-backed outbox and delivery log needs none of that. It also gives something a broker
does not: the outbox write is part of the same transaction as the business change, so an event
cannot be published for a change that rolled back, and a change cannot commit without its event.

This follows ADR 0001. Begin with the simpler thing and extract when evidence justifies the
complexity.

### The extraction point

Documenting the exit now is what stops the PostgreSQL log becoming a trap later. It should be
replaced by a dedicated broker when any of the following holds:

- Sustained event throughput exceeds what a single PostgreSQL instance serves without affecting
  operational queries.
- Subscriber count grows to where polling cost is material.
- Delivery latency requirements fall below what a polling loop achieves.
- Replay windows grow beyond what is reasonable to retain in an operational database.

Making that change requires its own ADR. Until one of those conditions is met and measured, the
extra system is complexity without evidence.

### Consumer requirements

A subscribing project must:

- **Be idempotent.** Delivery is at least once. The same event will be delivered twice, and
  applying it twice must produce the same result. Event identity is the deduplication key.
- **Preserve per-aggregate ordering.** Two events about the same core record must apply in the
  order core produced them. Events about unrelated records may apply in any order.
- **Hold a durable cursor.** The cursor records what the project has applied and must survive
  restarts.
- **Handle poison messages.** An event that cannot be applied must move to a dead-letter queue
  after a bounded number of attempts, and must not block the cursor indefinitely.
- **Reconcile.** Periodically compare mirror state against core and report drift as a defect.

### Backfill

A project joining at L2, or adding a new mirrored entity, needs the existing data, not only future
changes. Backfill and streaming must converge without gaps and without a stop-the-world pause:
the project takes a snapshot at a known log position, then applies the log from that position
forward. Because consumers are idempotent, overlap between snapshot and stream is harmless.

### Merges are events

When core merges two records, every project holding the losing identifier holds a stale
reference. A merge that core performs without publishing it silently corrupts every mirror.

Merge is therefore a first-class event carrying both the surviving and the superseded identifier,
and applying it is a mandatory consumer behaviour, not an optimisation.

## 3. Inward Contribution

### The inbox

Core exposes an inbox that accepts signed submissions from registered projects. A submission is
authenticated by project identity, verified by signature, and deduplicated by event identity.

A project sends contributions through its own outbox, for the same reason core does: the
submission must be durable and retryable without being part of the request that triggered it, and
a failed delivery must not break the project's write path.

### Candidates, not assertions

A contributed record is a candidate. Core applies its master-data rules to decide whether it
creates a new canonical record, matches an existing one, or requires human review.

This distinction already exists in practice. A project domain that stages candidate records
separately from canonical ones has the right model, and the platform generalises it rather than
replacing it.

### Telemetry

Analytics and measurement events travel the same inbound path with different handling: they are
appended to the rollup store rather than adjudicated against canonical records. They are never an
operational read of project data by core.

## 4. Synchronous Reads

Not everything should be mirrored. A project reads through the Core API rather than a mirror when:

- The data is needed rarely and a local copy would be mostly stale.
- Freshness matters more than availability, such as a permission check.
- The volume is too large to justify replicating for the queries actually made.

A project reads from a mirror when it needs to join core data against its own data, which is the
case a network call cannot serve.

The rule of thumb: mirror what you join against, call for what you check.

## 5. Failure Behaviour

The system must behave predictably when parts of it are unavailable.

- **Core is down.** Projects continue serving from their mirrors. Writes that require core are
  queued in the project outbox. Reads that require a synchronous core call fail visibly.
- **A project is down.** Its cursor stops advancing. The delivery log retains its events. Other
  subscribers are unaffected.
- **A consumer is slow.** Its own lag grows. It does not delay other subscribers.
- **An event cannot be applied.** It moves to the dead-letter queue after bounded retries and is
  reported. It does not block the cursor forever, and it is not discarded.
- **A mirror is stale.** Reconciliation reports it. Staleness beyond a declared threshold is a
  defect, not a normal state.

Every one of these has a defined outcome. None of them is silent.

## 6. Related Documents

- [Core Integration Platform](core-integration-platform.md)
- [Platform Data Topology](platform-data-topology.md)
- [Core Data Contract Standard](../standards/core-data-contract-standard.md)
- [Project Integration Standard](../standards/project-integration-standard.md)
- [ADR 0001: Use Modular Monolith First](../decisions/0001-use-modular-monolith-first.md)
- [ADR 0005: Use Event-Driven Module Communication](../decisions/0005-use-event-driven-module-communication.md)
- [ADR 0011: Define Technology Stack and Implementation Baseline](../decisions/0011-define-technology-stack-and-implementation-baseline.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](../decisions/0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](../decisions/0040-build-transactional-outbox-and-core-inbox.md)
