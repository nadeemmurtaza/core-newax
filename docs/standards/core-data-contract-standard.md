# NEWAX Core Data Contract Standard

## Purpose

Define the contract that carries data between the Core NEWAX Database and NEWAX project domains,
including the event envelope, its signing scheme, its versioning rules, and the compatibility
obligations that let core evolve without breaking projects.

This document is a standard only. It does not create production code, actual environment files,
secrets, deployment scripts, or infrastructure automation.

## Scope

This standard applies to:

- Events published by Core and consumed by project domains.
- Submissions sent by project domains to the Core inbox.
- The synchronous Core API surface that project domains consume.

It applies equally in both directions. One envelope, one signing scheme, one set of versioning
rules.

## 1. Why One Contract

Project domains are written in different languages and maintained by different work streams. The
only thing that keeps them able to exchange data correctly is a single definition that all of them
are generated from.

NEWAX has already seen what the absence of this produces. Two project domains independently built
outbound delivery with different envelopes, different retry semantics, and different field naming,
each reasonable alone and mutually incompatible.

## 2. Building On What Exists

One NEWAX project domain already ships a signed, versioned outbound envelope with a durable
outbox, deliberately written against a future Core inbox. It carries a schema version, a stable
event identifier reused across retries, an event type, an occurrence timestamp, and a typed
payload, and it is signed with an HMAC signature accompanied by a timestamp header.

That shape is correct and this standard adopts it rather than replacing it. Three changes are
required to make it a platform contract rather than one project's integration:

1. **Vendor-neutral transport headers.** Signature and timestamp headers must not be named after
   any single project. The platform names are `X-Newax-Signature` and `X-Newax-Timestamp`.
2. **Explicit producer identity.** The envelope must state which project produced the event, using
   the `project_key` established by ADR 0036, so the receiver authenticates rather than infers.
3. **A declared envelope version.** The existing per-payload schema version is retained, and an
   envelope version is added, because envelope and payload evolve independently.

Because these change the wire format, the resulting envelope is **version 2**. Version 1 is the
existing project implementation. Migration is a deliberate, documented step and must not be
performed by silently altering the meaning of version 1.

## 3. The Envelope

Every message, in both directions, carries the same envelope. Field naming follows
`docs/standards/api-design-standard.md`.

Required fields:

| Field             | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `envelopeVersion` | Version of the envelope structure itself                                   |
| `eventId`         | Globally unique identifier for this event, stable across every retry       |
| `eventType`       | The event name, in `entity.action` form                                    |
| `schemaVersion`   | Version of the payload schema for this `eventType`                         |
| `occurredAt`      | When the fact happened, not when it was delivered                          |
| `producer`        | The `project_key` of the producing system, or the core system identifier   |
| `tenantId`        | The tenant boundary the event belongs to, where the event is tenant-scoped |
| `payload`         | The typed body, defined per `eventType`                                    |

Rules:

- `eventId` identifies the event, not the delivery attempt. Every retry of the same logical event
  carries the same `eventId`. This is what makes idempotent consumption possible, and a producer
  that mints a new identifier per attempt breaks every consumer's deduplication.
- `occurredAt` is the time of the fact. Delivery time is transport metadata and does not belong in
  the envelope.
- `eventType` is stable. Renaming an event type is a breaking change.
- `tenantId` is present on every tenant-scoped event, so a consumer can enforce the ADR 0027
  boundary without parsing the payload.
- The envelope carries no credentials, no connection details, and no secrets.

## 4. Event Naming

Event types use `entity.action` in lower snake case for the entity and past tense for the action:
`person.created`, `organization.updated`, `person.merged`, `membership.revoked`.

Rules:

- Events describe facts that have happened, never commands or requests.
- The entity is the core entity the event concerns.
- Merge and delete are first-class event types, not variants of update.
- An event type belongs to exactly one owning module, matching the `exposed_events` declared in
  `registry/module-registry.json`.

## 5. Signing and Authentication

Every message in both directions is signed.

Rules:

- The signature is carried in `X-Newax-Signature` and the signing timestamp in
  `X-Newax-Timestamp`.
- The signature is computed over the exact bytes transmitted. A receiver verifies against the raw
  received body, never against a re-serialised form, because re-serialisation changes bytes and
  breaks verification for reasons that are hard to diagnose.
- Signing keys are issued per project and per environment, so revocation is bounded and complete.
- Receivers reject messages whose timestamp falls outside an accepted window, bounding replay.
- Receivers deduplicate on `eventId`, so a replay inside the window is harmless rather than
  merely rejected.
- Signature comparison uses a constant-time comparison.
- Keys are held as secret references and resolved at runtime. They are never committed to a
  repository, in line with `docs/standards/environment-standard.md`.

## 6. Delivery Semantics

- Delivery is at least once. Consumers must be idempotent, keyed on `eventId`.
- Events concerning the same core record are delivered in production order. Events concerning
  unrelated records carry no ordering guarantee.
- Retries use bounded exponential backoff.
- A message that cannot be applied after a bounded number of attempts moves to a dead-letter
  queue. Dead-lettering is terminal and requires operator action to requeue.
- A dead-lettered message is never silently discarded.

Exactly-once delivery is not offered, because it does not exist. Exactly-once effect is achieved
by idempotent consumers, and that obligation sits with the consumer.

## 7. Versioning and Compatibility

Two versions travel independently: `envelopeVersion` for the envelope structure, and
`schemaVersion` for each event type's payload.

**Additive changes are compatible** and do not increment a version:

- Adding an optional payload field.
- Adding a new event type.
- Widening an accepted value range.

Consumers must ignore payload fields they do not recognise. A consumer that fails on an unknown
field makes every additive change breaking.

**Breaking changes require a version increment**:

- Removing or renaming a field.
- Changing a field's type or meaning.
- Narrowing an accepted value range.
- Making an optional field required.
- Renaming an event type.

Rules for breaking changes:

- Both versions are served during a deprecation window.
- The window is set by the slowest consuming project, not by core's convenience.
- Deprecation is announced through the changelog before the window opens, not when it closes.
- A version is removed only once no registered project consumes it, verified against the project
  registry rather than assumed.

## 8. Payload Rules

- Payloads carry identifiers and data, never credentials or secrets.
- A payload references core records by their core UUID, matching the reference rules in ADR 0037.
- A payload contains only what a consumer needs. Publishing an entire record because it is
  convenient widens exposure across every subscriber.
- Sensitive fields require a review before they may be published, because publication copies them
  into every subscribing project database.
- Merge events carry both the surviving and the superseded identifier.

## 9. The Contract Artefact

The contract is a published, versioned artefact covering the synchronous API and the event stream,
including the envelope, the signing scheme, and the payload schema of every event type.

Rules:

- The contract is the source of truth. Client libraries are generated from it, per ADR 0042.
- The contract is verified against the running implementation in continuous integration. A
  contract that drifts from its implementation is worse than none, because consumers trust it.
- Contract changes are reviewed as contract changes, so a breaking change is visible in a diff
  rather than discovered by a consumer.

## 10. What Must Never Happen

- A producer must never mint a new `eventId` per delivery attempt.
- A consumer must never assume exactly-once delivery.
- A consumer must never fail on an unrecognised payload field.
- A receiver must never verify a signature over a re-serialised body.
- A breaking change must never ship without a version increment and a deprecation window.
- A credential, connection string, or secret must never appear in an envelope, a payload, or the
  contract artefact.
- A dead-lettered message must never be silently discarded.
- An event type must never be renamed in place.

## 11. Related Documents

- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Project Integration Standard](project-integration-standard.md)
- [API Design Standard](api-design-standard.md)
- [Environment Standard](environment-standard.md)
- [Security Baseline Standard](security-baseline-standard.md)
- [ADR 0036: Establish Project Identity and Registry](../decisions/0036-establish-project-identity-and-registry.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](../decisions/0040-build-transactional-outbox-and-core-inbox.md)
- [ADR 0042: Adopt Contract-First SDK Generation](../decisions/0042-adopt-contract-first-sdk-generation.md)
