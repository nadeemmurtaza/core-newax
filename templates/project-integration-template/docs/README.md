# Docs

## Purpose

The `docs/` folder holds this project's integration documentation.

## What Belongs Inside

- Which core entities this project mirrors, and why each is mirrored rather than fetched.
- Which core entities this project contributes.
- The unresolved-reference behaviour for each core reference.
- The declared staleness threshold and what happens when it is exceeded.
- The conflict policy, for Class B projects.
- The operator runbook for dead-letter inspection and requeue.

## What Should Never Be Placed Inside

- Credentials, connection strings, or secrets.
- Copies of Core contract documentation that will drift from the source.

## Best Practices

- Document decisions that a future maintainer would otherwise have to infer from code, especially
  unresolved-reference behaviour, which is the behaviour most likely to be reinvented incorrectly.
- Link to Core documentation rather than restating it.
- Follow the Documentation Standard.
