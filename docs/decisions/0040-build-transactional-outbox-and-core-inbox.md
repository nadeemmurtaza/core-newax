# ADR 0040: Build Transactional Outbox and Core Inbox

## Purpose

Define the delivery mechanism that carries Central Registry changes outward to project databases
and carries candidate records and telemetry inward to the core.

## 1. Decision Title

ADR 0040: Build Transactional Outbox and Core Inbox

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0005 accepted event-driven communication between modules. `registry/module-registry.json`
declares `exposed_events` and `consumed_events` for every registered module.

None of it is implemented. There is no outbox, no delivery mechanism, no publisher, and no
consumer anywhere in the repository. The declared events are intent, not behaviour.

Meanwhile, project domains have built their own. One project domain ships a durable outbox with
retry, backoff, and dead-lettering, and emits a signed, versioned envelope addressed to core.
Another ships an independent outbox of its own design. The first was written against a core inbox
that does not exist, and its author documented that gap explicitly rather than assuming it away.

ADR 0039 now makes this mechanism load-bearing: with direct database access prohibited, projects
have no fallback if events do not arrive.

## 5. Problem

Core must publish every change to subscribed entities, reliably, to a growing number of
subscribers, without the publisher knowing who they are.

Core must accept submissions from projects without allowing a project to overwrite canonical
data.

Two specific failure modes must be designed out.

**Dual write.** If the business change commits and the event publish fails, the change exists and
no one is told. If the publish succeeds and the change rolls back, subscribers learn about a
change that never happened. Any design where the change and its event are separate operations has
this defect.

**Fan-out by configuration.** If the producer holds a destination per consumer, every new project
requires producer configuration and a redeploy, one slow consumer delays others, and failure
handling is duplicated per destination. This is the shape of the existing point-to-point emitter,
and it does not survive project growth.

## 6. Decision

**Core writes an outbox row in the same transaction as the change.**

Every change to a published entity writes its event to a core outbox table within the transaction
that made the change. The change and its event commit or roll back together. This eliminates dual
write by construction.

**Delivery is a log with per-subscriber cursors.**

A delivery process moves outbox entries into a delivery log. Each subscribed project has its own
cursor, its own retry state, and its own dead-letter queue. The publisher does not know its
subscribers. Adding a subscriber adds a row, not a code path.

**Delivery is at least once, with per-aggregate ordering.**

Consumers must be idempotent, keyed on event identity. Events concerning the same core record are
delivered in the order core produced them. Events concerning unrelated records carry no ordering
guarantee.

**Core exposes an inbox for inbound submissions.**

The inbox accepts signed submissions from registered projects, authenticated by project identity
and deduplicated by event identity. Submitted records are candidates adjudicated by core
master-data rules, never direct writes to canonical records. Telemetry submitted through the same
path is appended to the rollup store rather than adjudicated.

**Both directions use one envelope.**

The envelope, its signature scheme, and its versioning rules are defined once in
`docs/standards/core-data-contract-standard.md` and apply to core-to-project and project-to-core
traffic alike.

**Merge and delete are published events.**

A record merge publishes both the surviving and the superseded identifier. Applying merges is a
mandatory consumer behaviour. A merge core performs without publishing leaves every mirror
holding a stale reference.

**The mechanism is built on PostgreSQL, with a documented extraction point.**

No message broker is introduced. ADR 0011's baseline contains none, and the transactional outbox
property specifically requires the outbox to share a transaction with the business change. The
conditions under which a broker becomes justified are recorded in
[Core Distribution Architecture](../architecture/core-distribution-architecture.md), and adopting
one requires its own ADR.

## 7. Reasoning

The transactional outbox is chosen because it is the only design that makes the change and its
event atomic without a distributed transaction. Everything else in this decision follows from
needing that property.

The delivery log with per-subscriber cursors is chosen for fan-out. It is the difference between
onboarding a project costing a registry row and costing a producer change, and that difference
compounds with every project.

At-least-once with idempotent consumers is chosen over exactly-once because exactly-once delivery
does not exist in a distributed system; what exists is exactly-once effect, achieved by idempotent
consumers. Requiring idempotency states the real obligation rather than an impossible guarantee.

Treating inbound submissions as candidates preserves the authority rule from ADR 0037. Without
it, the inbox becomes a way for any project to write canonical data, and the Central Registry
stops being authoritative.

Using PostgreSQL rather than a broker follows ADR 0001: begin simply and extract on evidence. The
outbox must be transactional with the business change regardless of what carries events later, so
this is not a decision that gets rewritten if a broker arrives.

An existing project already implements this envelope and these retry semantics against a core
inbox that was never built. Building the inbox to that shape completes a contract already half
implemented, rather than obsoleting working code.

## 8. Alternatives Considered

**Direct publish at the point of change.** Simple and immediate. Rejected because it has the dual
write defect: no transaction spans the database change and the network publish.

**Point-to-point signed webhooks per consumer.** Already implemented in one project and known to
work for one destination. Rejected as the platform mechanism because fan-out requires producer
configuration per consumer, one slow consumer delays others, and failure handling duplicates per
destination.

**A message broker such as Kafka, NATS, or RabbitMQ.** The conventional answer and genuinely
better at high fan-out and throughput. Rejected now because it adds a system to run, secure,
monitor, and back up, sits outside the ADR 0011 baseline, and still requires a transactional
outbox to avoid dual write. Deferred with documented trigger conditions rather than refused.

**Logical replication from the core database.** Efficient and requires no publisher. Rejected
because it exposes the physical core schema as the contract, cannot express domain events such as
a merge, and offers no way to bound what a subscriber receives.

**Polling the Core API for changes.** Requires no publisher machinery. Rejected because it scales
poorly with subscriber count, cannot express deletions or merges reliably, and produces latency
proportional to poll interval.

## 9. Consequences

Positive:

- A change and its event are atomic.
- Subscribers are added without touching the publisher.
- One slow or failed consumer does not affect others.
- Poison events are isolated rather than blocking or being discarded.
- Merges propagate correctly instead of silently corrupting mirrors.
- One envelope serves both directions.

Cost:

- Core must operate a delivery process and monitor per-subscriber lag.
- Every consumer must be idempotent, which is a real design constraint.
- The delivery log grows and requires retention and pruning policy.
- Existing project producers must converge on the shared envelope.
- Polling delivery adds latency that a broker would not.

## 10. Impact On NEWAX Core

Core gains a Platform Operations responsibility: the outbox, the delivery log, subscriptions,
cursors, dead-letter queues, and the inbox.

Every core module publishing events must write them transactionally. The `exposed_events` already
declared in the Module Registry become implementable rather than aspirational, and the registry
entries become verifiable against real behaviour.

## 11. Impact On Client Systems

Client deployments gain a background delivery process that must be running for project mirrors to
stay current. Its health is an operational concern with client-visible consequences, since a
stalled cursor eventually shows as stale data.

## 12. Security Considerations

Every submission to the inbox is authenticated by project identity and verified by signature.
Signing keys are issued per project and per environment, so revocation is bounded.

Signatures must be verified over the exact received bytes, and timestamps must be checked to bound
replay. Event identity deduplication additionally makes a replayed submission harmless.

The inbox accepts candidates only. A project cannot write canonical records, so a compromised
project cannot corrupt the Central Registry, only submit candidates that core adjudicates.

Event payloads carry Central Registry data and must be treated as sensitive in transit, at rest in
the delivery log, and in dead-letter queues, which are the most likely place for payloads to sit
unexamined.

## 13. Scalability Considerations

Fan-out is the dimension that grows. Per-subscriber cursors mean core writes once regardless of
subscriber count, but polling cost grows with subscriber count and poll frequency.

The delivery log is append-mostly with per-subscriber sequential reads, which PostgreSQL serves
well. Retention must be bounded, and the retention window must exceed the longest expected
consumer outage or a recovering consumer will find its position gone.

The extraction conditions to a dedicated broker are documented rather than discovered under load.

## 14. Maintenance Considerations

Per-subscriber lag is the primary health signal and must be monitored, because a stalled cursor is
indistinguishable from a quiet period without it.

Dead-letter queues need an operator path. An event that cannot be applied requires human
inspection and requeue, and a dead-letter queue nobody inspects is data loss with extra steps.

Consumer logic is identical across projects of a class and belongs in the generated client and the
integration scaffold rather than being reimplemented per project.

## 15. Related Documents

- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Core Data Contract Standard](../standards/core-data-contract-standard.md)
- [Project Integration Standard](../standards/project-integration-standard.md)
- [ADR 0001: Use Modular Monolith First](0001-use-modular-monolith-first.md)
- [ADR 0005: Use Event-Driven Module Communication](0005-use-event-driven-module-communication.md)
- [ADR 0011: Define Technology Stack and Implementation Baseline](0011-define-technology-stack-and-implementation-baseline.md)
- [ADR 0037: Define Cross-Database Reference Rules](0037-define-cross-database-reference-rules.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)

## 16. Approved By

NEWAX Engineering, Architecture, and Security.
