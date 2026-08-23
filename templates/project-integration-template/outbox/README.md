# Outbox

## Purpose

The `outbox/` folder holds this project's durable outbound delivery ledger for submissions to the
Core inbox.

Applies to projects at L3, and to any project submitting telemetry at L5.

## What Belongs Inside

- The outbox table definition.
- The enqueue path, written in the same transaction as the change that caused it.
- The delivery process, with bounded exponential backoff.
- Dead-letter handling and the operator requeue path.

## What Should Never Be Placed Inside

- Fire-and-forget delivery with no retry. A lost delivery is a silent divergence between this
  project and Core.
- A new identifier minted per delivery attempt.
- Signing key values.

## Best Practices

- Write the outbox row inside the transaction that made the change. If the change rolls back the
  event must roll back with it, and if the change commits the event must exist.
- Reuse the same `eventId` across every retry of a logical submission. This is what makes the
  Core inbox able to deduplicate.
- Never let a failed submission break the project's write path.
- Treat submitted records as candidates. Core adjudicates whether a candidate creates a record,
  matches an existing one, or requires review.
- Dead-letter after a bounded number of attempts, and make requeue an operator action. A
  dead-letter queue nobody inspects is data loss with extra steps.
