# NEWAX Engineering Learning System

## Status

Mandatory for all engineering work in this repository.

## Purpose

This standard prevents repeated mistakes from consuming time, compute, tokens,
CI capacity, and reviewer attention.

A failure may occur once. Repeating the same failure without first applying the
recorded prevention control is a process defect.

The engineering system must remember:

- What failed.
- Why it failed.
- Which attempted methods were ineffective.
- Which method resolved the problem.
- Which preventive control was added.
- Whether the control worked on later tasks.

The permanent record is:

- `docs/verification/engineering-learning-ledger.md`

The required pull-request record is defined in:

- `.github/pull_request_template.md`

## 1. Prime Learning Rule

Before starting a task, inspect the learning ledger for applicable entries.

Before repeating a command, patch, dependency change, workflow, or repository
write that previously failed, confirm that the cause has changed or that the
recorded successful method is being used.

Do not retry an unchanged failed method merely because another attempt is
convenient.

## 2. Mandatory Task Sequence

Every engineering task must follow this sequence:

1. Verify the live repository and branch state.
2. Read applicable requirements, ADRs, standards, and ledger entries.
3. Define acceptance criteria.
4. Identify affected files and systems.
5. Identify dependency, formatting, lint, type, test, and build risks.
6. Design the smallest complete change.
7. Implement the change.
8. Generate required artifacts.
9. Run formatting write operations before formatting checks.
10. Run lint and type-check before the complete test suite.
11. Run focused tests before complete tests.
12. Run the production build.
13. Review the complete diff.
14. Freeze repository content.
15. Run CI against the exact frozen commit.
16. Update pull-request metadata without changing repository files.
17. Record new lessons before declaring completion.

## 3. Stop Conditions

Stop and reassess when any of the following occurs:

- The same error appears twice.
- A method already recorded as unsuccessful is about to be repeated.
- More than one speculative fix is being applied at once.
- CI is being used to discover basic formatting, lint, type, or build failures.
- A successful exact-head run would be invalidated by another source edit.
- A documentation edit contains the CI run or commit that verifies that same
  edit.
- A repository file tool is being used to change pull-request metadata.
- Temporary scaffolding is entering the permanent diff.
- Status updates are being produced more frequently than useful engineering
  evidence changes.

When a stop condition occurs:

1. Do not make another repository mutation.
2. Read the latest failure evidence.
3. Identify the root cause.
4. Compare the intended action with the ledger.
5. Select one evidence-backed method.
6. Resume only after the method and expected result are explicit.

## 4. Failure Classification

Each new failure must be classified into one primary category:

- Requirements or scope.
- Repository state or branch ancestry.
- Dependency installation or lockfile.
- Generated artifacts.
- Formatting.
- ESLint or static analysis.
- Type-check or compilation.
- Unit or integration tests.
- Database migration or live behavior.
- Production build.
- Runtime or workflow behavior.
- GitHub or tool-operation error.
- Documentation or evidence management.
- Process, communication, or polling waste.

## 5. Learning Record Requirements

Create a new ledger entry when a task reveals:

- A new root cause.
- A previously unknown failed method.
- A new successful resolution method.
- A prevention control that should apply to future work.
- A repeated mistake that proves an earlier control was insufficient.

Do not create duplicate entries for the same root cause. Update the existing
entry with additional evidence when appropriate.

Every ledger entry must contain:

- Entry ID.
- Date.
- Pull request or task.
- Category.
- Symptom.
- Root cause.
- Unsuccessful method.
- Successful method.
- Prevention control.
- Verification evidence.
- Recurrence status.

## 6. Successful Method Rule

A method may be marked successful only when:

- It addresses the identified root cause.
- The affected focused check passes.
- The complete applicable verification sequence passes.
- CI passes against the exact latest commit when CI is applicable.
- No later change invalidates the evidence.

A method is not successful merely because it changed the error message.

## 7. Unsuccessful Method Rule

A method must be recorded as unsuccessful when:

- It does not address the root cause.
- It creates a different failure without resolving the original failure.
- It depends on brittle text, indentation, timing, or generated output.
- It weakens strictness to hide a compatibility problem.
- It bypasses a required gate.
- It creates temporary scaffolding in the permanent branch.
- It changes repository files only to describe existing verification evidence.
- It repeats a failed tool action with unchanged arguments or intent.

An unsuccessful method must not be retried without a written explanation of
what materially changed.

## 8. Dependency Gate

Before changing a dependency:

1. Check framework, runtime, and plugin compatibility.
2. Inspect peer dependencies.
3. Inspect required install or build scripts.
4. Update manifests, lockfile, and build approvals atomically.
5. Generate the lockfile with pnpm.
6. Run `pnpm install --frozen-lockfile` before other checks.

Never hand-edit `pnpm-lock.yaml`.

## 9. Formatting Gate

Formatting is a write operation followed by a verification operation.

Use this order:

```bash
pnpm format
pnpm format:check
```

Do not push known unformatted files and wait for CI to list them.

Do not mix repository-wide formatting noise with an unrelated feature unless
normalization is the explicit scope of the pull request.

## 10. ESLint Gate

Before pushing:

- Run `pnpm lint` with zero warnings.
- Inspect framework-specific rules for changed UI files.
- Prefer framework-supported components and patterns.
- Do not disable rules to silence a correct finding.
- Confirm generated or temporary files are excluded or removed.

A warning is a failure when CI uses `--max-warnings 0`.

## 11. Type and Build Gate

Before pushing:

- Run `pnpm typecheck`.
- Run focused tests.
- Run `pnpm test`.
- Run `pnpm build`.

Do not use production build failures as the first proof that changed source
compiles.

## 12. Repository Freeze Rule

After the final source change:

1. Record the exact head commit.
2. Make no further repository-content changes.
3. Run the complete verification sequence.
4. Run CI against that exact head.
5. Update only pull-request metadata after verification.

Do not place the exact verifying workflow run ID inside a repository file that
would require another commit. Store immutable evidence in the pull-request body,
review, comment, or release record.

## 13. GitHub Tool Boundary

Repository-content actions and pull-request metadata actions are different.

Use repository file actions only for:

- Creating files.
- Updating files.
- Deleting files.

Use pull-request actions only for:

- Updating the pull-request title or body.
- Changing draft status.
- Requesting review.
- Recording review or approval.
- Merging after authorization.

Before every write action, state the intended target as one of:

- Repository content.
- Pull-request metadata.
- Pull-request review state.
- Branch reference.

If the selected action does not match the target, do not call it.

## 14. Communication and Polling Control

Status updates must be evidence-based.

Send a status update only when:

- The root cause is identified.
- A meaningful fix is implemented.
- A verification stage changes state.
- A blocker is discovered.
- The task reaches a controlled completion state.

Do not poll workflow state more frequently than needed to observe meaningful
progress. Do not narrate unchanged states repeatedly.

## 15. Pull-Request Learning Record

Every pull request must state:

- Whether a new mistake or failed method was discovered.
- Which ledger entry records it, or why no entry was required.
- Which known unsuccessful method was avoided.
- Which successful method was used.
- Which exact-head verification will prove completion.

The pull-request governance workflow validates that this record exists.

## 16. Completion Standard

A task is complete only when:

- Requirements are satisfied.
- The relevant ledger was consulted.
- New lessons are recorded.
- Formatting, lint, type-check, tests, and build pass.
- The complete diff is reviewed.
- Temporary files are removed.
- CI is green against the exact latest commit when applicable.
- No known unresolved issue remains.

The purpose is not to eliminate every possible mistake. The purpose is to make
known mistakes expensive to repeat and easy to avoid.
