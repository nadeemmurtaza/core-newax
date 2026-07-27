# EL-0027: Resolved lessons must materialize prevention controls

## Root cause

Engineering learning could document a confirmed mistake and a prevention sentence without creating durable repository controls. The issue might close while the same failure mode remained operationally possible.

## Failed method

Close a learning issue, describe what should happen next time, and depend on future authors or reviewers to remember the lesson manually.

## Successful method

For every confirmed and verified resolved mistake:

1. require exact resolution, review, verification, and regression evidence;
2. build or update one deterministic pack identified by the root-cause ID;
3. generate exactly seven attributed controls;
4. keep CI and static-analysis records declarative;
5. require ownership, implementation, review, and successful verification before executable controls become enforced;
6. protect enforced controls from unapproved replacement or downgrade; and
7. compare every expected control with the exact pull-request head.

## Prevention control

Trusted pull-request governance rejects resolved learning evidence unless the complete current seven-control prevention pack exists at the exact head.

## Required controls

- CI check
- Pull-request checklist
- Review checklist
- Coding standard
- Verification rule
- Static-analysis rule
- Test template

## Evidence boundaries

Issue closure is not resolution evidence. Missing root-cause confirmation, exact fix commit, reviewer, timestamps, verification, regression, or prevention-control evidence produces `insufficient-evidence`.

Arbitrary executable fields are prohibited at every nesting level in declarative CI and static-analysis records. Enforced definitions and implementation ownership remain unchanged until an explicit supersession approval exists.

## Implementation evidence

- Planning and architecture record: issue `#236`
- Implementation branch: `engineering/prevention-engine`
- Focused pre-publication verification: prevention engine, renderer, parser, collector, CLI and governance suites
- Exact repository-wide verification: pending

## Status

The prevention method and controls are implemented in the candidate branch. This ledger entry remains unverified for final completion until exact-head formatting, lint, type-check, complete tests, build, and trusted governance succeed.
