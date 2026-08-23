# Contract

## Purpose

The `contract/` folder holds the project's pinned reference to the Core contract and the generated
client library it consumes.

## What Belongs Inside

- The pinned contract version this project is built against.
- The generated client library dependency declaration.
- Notes on which contract capabilities this project uses.
- A record of the last contract upgrade and what it required.

## What Should Never Be Placed Inside

- A hand-written Core API client.
- A hand-written event envelope or signature implementation.
- A modified, forked, or patched copy of a generated client.
- Environment-specific endpoints or credentials.

## Best Practices

- Pin the contract version. A floating version turns a compatible core change into an unannounced
  local change.
- Upgrade deliberately, and record the upgrade in `CHANGELOG.md`.
- If a needed capability is missing, add it to the Core contract rather than working around it
  here. A local workaround is a platform gap that stops being visible.
