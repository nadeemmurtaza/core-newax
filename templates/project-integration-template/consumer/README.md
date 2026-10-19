# Consumer

## Purpose

The `consumer/` folder holds the process that applies Core events to this project's mirror tables.

For Class A projects this consumes the Core delivery log. For Class B projects this performs
cursor-based synchronisation instead, and must declare a conflict policy.

## What Belongs Inside

- The event application logic.
- Cursor persistence.
- Dead-letter handling and the operator requeue path.
- Reconciliation logic.
- Backfill logic.

## What Should Never Be Placed Inside

- Business logic that belongs in the project's own services.
- Writes to project-owned tables driven by core events, unless that behaviour is documented and
  intentional.
- Silent discard of an event that cannot be applied.

## Best Practices

- Be idempotent, keyed on `eventId`. Delivery is at least once, and the same event will arrive
  twice.
- Preserve per-record ordering. Events about the same core record must apply in production order.
- Persist the cursor durably. A cursor lost on restart means a replay or a gap.
- Apply merge events. A project that ignores merges accumulates stale references that nothing will
  correct.
- Apply delete and archive events.
- Bound retries, then dead-letter. A poison event must not block the cursor forever.
- Converge backfill with the stream by snapshotting at a known log position and applying forward
  from it. Idempotency makes the overlap harmless.
- Monitor lag. A stalled cursor is indistinguishable from a quiet period without it.
