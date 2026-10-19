# Mirrors

## Purpose

The `mirrors/` folder documents the `core_mirror_*` read models this project maintains from Core
events.

Applies to Class A projects at L2 and above.

## What Belongs Inside

- The list of core entities this project mirrors, matching its registry entry.
- The schema of each mirror table.
- The declared staleness threshold for each mirror.
- The documented unresolved-reference behaviour for each core reference.
- Reconciliation scope and frequency.

## What Should Never Be Placed Inside

- A mirror for an entity the project has not declared a subscription to.
- Project business data mixed into a mirror table.
- Additional columns that hold project-owned values.
- Any table prefixed `core_` that is not a mirror.

## Best Practices

- Mirror only what the project joins against. Data that is only read occasionally should be
  fetched through the client library instead.
- Treat mirror tables as read-only to business logic. The consumer is the only writer.
- Declare a staleness threshold and monitor it. Lag beyond the threshold is a defect, not a normal
  state.
- Document what happens when a referenced core record is absent. Rejecting, deferring, or
  recording a data-quality defect are all acceptable. Treating it as absent or valid is not.
