# Tests

## Purpose

The `tests/` folder holds this project's integration conformance tests.

## What Belongs Inside

- The Core conformance suite for the project's declared level.
- Consumer idempotency tests, proving that applying an event twice produces one result.
- Ordering tests for events concerning the same record.
- Merge application tests.
- Unresolved-reference behaviour tests.
- Reconciliation tests.
- Outbox transactionality tests, proving no event survives a rolled-back change.

## What Should Never Be Placed Inside

- Tests that reach the Core NEWAX Database directly.
- Tests requiring production credentials.
- Tests that pass by weakening the behaviour they cover.

## Best Practices

- Run the conformance suite on every change, not once at onboarding. A declared level drifts from
  reality unless it is proved continuously.
- Test the failure paths, not only the happy path. Duplicate delivery, out-of-order delivery, a
  missing referenced record, and a poison event are the cases that matter, and they are the ones
  most likely to be untested.
- Never claim a conformance level the suite has not proved.
