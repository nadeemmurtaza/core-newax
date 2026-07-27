# NEWAX Engineering Learning Ledger

## Status

Append-only operational record for recurring engineering failures, successful
resolutions, and prevention controls.

Before starting a task, search this ledger for the affected tool, command,
framework, error, or workflow.

## Registry Rules

- Do not delete historical entries.
- Correct factual errors through a dated amendment.
- Reuse an existing entry when the root cause is the same.
- Create a new entry when the root cause or prevention control is materially
  different.
- A method is successful only after complete applicable verification passes.
- A failed method must not be repeated without recording what changed.

## Known Successful Methods

### Dependencies

- Treat package manifests, `pnpm-lock.yaml`, workspace settings, and build-script
  approvals as one atomic change.
- Check peer compatibility before selecting versions.
- Generate lockfiles with pnpm, then verify with
  `pnpm install --frozen-lockfile`.
- Keep `strictPeerDependencies: true` and fix compatibility instead of hiding it.

### Formatting

- Run `pnpm format` before `pnpm format:check`.
- Format the changed scope before pushing.
- Separate repository-wide normalization from feature work.

### ESLint

- Run `pnpm lint` before pushing.
- Treat warnings as failures because CI uses `--max-warnings 0`.
- Use framework-native components, such as `next/link` for internal navigation.
- Export named configuration values instead of anonymous default arrays.

### Type-check and tests

- Model environment inputs with the same index signature as `process.env` when
  the whole environment object is accepted.
- Test observable behavior rather than proxy-heavy implementation identity.
- Run focused tests before the complete suite.
- Use live database transactions when database behavior is the requirement.

### Build and completion

- Run the complete local sequence before pushing:

  ```bash
  pnpm install --frozen-lockfile
  pnpm format
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

- Freeze repository content before exact-head CI.
- Store final verification evidence in pull-request metadata, not in a source
  file that would move the head.
- Remove temporary generator, formatter, and diagnostic workflows before final
  verification.

### GitHub operations

- Match the intended target to the action before every write:
  repository content, pull-request metadata, review state, or branch reference.
- Use `update_pull_request` for pull-request body or title changes.
- Use file actions only for repository files.
- Stop after the first wrong-action result and reassess before another write.

## Known Unsuccessful Methods

- Changing package manifests without regenerating the lockfile.
- Selecting dependency versions without checking the full peer graph.
- Adding packages without checking required build scripts.
- Running formatting checks before formatting writes.
- Waiting for CI to discover local formatting or lint problems.
- Silencing peer or lint failures by weakening strictness.
- Using plain HTML anchors for internal Next.js routes.
- Exporting ESLint configuration anonymously under zero-warning CI.
- Treating `process.env` as a narrow named-property interface.
- Using `toBeInstanceOf` against Prisma proxy-heavy clients.
- Testing SQL text when live database behavior is the requirement.
- Using brittle exact-whitespace or indentation patches for generated files.
- Keeping generator or diagnostic workflows in the permanent diff.
- Hardcoding optimistic version values in a working UI.
- Calling a repository file action when the target is pull-request metadata.
- Embedding the verifying commit or workflow run inside a file that requires a
  new verifying commit.
- Repeating unchanged workflow polls and status messages.
- Declaring a correction complete before the full pipeline passes.

---

## EL-0001: Dependency Manifest Changed Without Lockfile

- Date: 2026-07 retrospective
- Pull request or task: Early repository foundation work
- Category: Dependency installation or lockfile
- Symptom: `ERR_PNPM_OUTDATED_LOCKFILE`
- Root cause: Dependency declarations changed without regenerating
  `pnpm-lock.yaml` in the same change.
- Unsuccessful method: Commit the manifest and rely on CI to repair or explain
  the lockfile mismatch.
- Successful method: Generate the lockfile with pnpm and verify with
  `pnpm install --frozen-lockfile`.
- Prevention control: Dependency changes are atomic and lockfiles are never
  hand-edited.
- Verification evidence: Frozen-lockfile installation passed after regeneration.
- Recurrence status: Prevented by current workspace and CI policy.

## EL-0002: Incompatible ESLint Major Version

- Date: 2026-07 retrospective
- Pull request or task: Repository quality foundation
- Category: Dependency installation or lockfile
- Symptom: `ERR_PNPM_PEER_DEP_ISSUES`
- Root cause: ESLint 10 was selected while Next.js-related plugins supported
  ESLint 9.
- Unsuccessful method: Select the newest package versions independently.
- Successful method: Inspect the complete peer graph and use mutually
  compatible ESLint 9 packages.
- Prevention control: Peer compatibility is checked before version selection;
  strict peer enforcement remains enabled.
- Verification evidence: Frozen install and lint passed with compatible versions.
- Recurrence status: No recurrence after version correction.

## EL-0003: Unapproved Dependency Build Script

- Date: 2026-07 retrospective
- Pull request or task: Repository quality foundation
- Category: Dependency installation or lockfile
- Symptom: `ERR_PNPM_IGNORED_BUILDS`
- Root cause: `unrs-resolver` required a build script but was not added to the
  explicit pnpm `allowBuilds` list.
- Unsuccessful method: Add a dependency without inspecting transitive install
  behavior.
- Successful method: Inspect the resolved dependency graph and explicitly
  approve only the required package.
- Prevention control: Every dependency change includes a build-script audit.
- Verification evidence: Frozen installation passed with the explicit approval.
- Recurrence status: Controlled by `pnpm-workspace.yaml`.

## EL-0004: Formatting Gate Enabled Before Normalization

- Date: 2026-07 retrospective
- Pull request or task: Repository quality foundation
- Category: Formatting
- Symptom: `prettier --check .` failed on 35 files.
- Root cause: Repository-wide formatting enforcement was enabled before the
  repository was normalized.
- Unsuccessful method: Push unformatted files and use CI as the formatter report.
- Successful method: Run Prettier write mode, review the normalization diff, and
  then run the formatting check.
- Prevention control: Formatting write precedes formatting check; broad
  normalization is separated from feature work.
- Verification evidence: Formatting check passed after normalization.
- Recurrence status: Formatting remains a recurring risk when local preflight is
  skipped.

## EL-0005: Internal Next.js Navigation Used HTML Anchors

- Date: 2026-07 retrospective
- Pull request or task: Web application foundation
- Category: ESLint or static analysis
- Symptom: `@next/next/no-html-link-for-pages`
- Root cause: Internal navigation used `<a href="/">` instead of `next/link`.
- Unsuccessful method: Treat internal and external navigation as equivalent.
- Successful method: Use `Link` from `next/link` for internal routes.
- Prevention control: Review framework-specific lint rules for changed UI files.
- Verification evidence: ESLint passed after replacement.
- Recurrence status: No known recurrence.

## EL-0006: Anonymous ESLint Configuration Export

- Date: 2026-07 retrospective
- Pull request or task: Repository quality foundation
- Category: ESLint or static analysis
- Symptom: `import/no-anonymous-default-export` warning failed zero-warning CI.
- Root cause: The configuration array was exported anonymously.
- Unsuccessful method: Treat lint warnings as non-blocking.
- Successful method: Assign the configuration to `const config` and export the
  named value.
- Prevention control: Run lint locally and treat every warning as a failure.
- Verification evidence: `pnpm lint` passed with zero warnings.
- Recurrence status: Current configuration uses a named export value.

## EL-0007: Environment Interface Was Narrower Than ProcessEnv

- Date: 2026-07 retrospective
- Pull request or task: Web environment validation
- Category: Type-check or compilation
- Symptom: TypeScript `TS2559`
- Root cause: A custom environment interface listed only named optional fields,
  while `process.env` provides a string index signature.
- Unsuccessful method: Pass `process.env` to a structurally narrower type.
- Successful method: Add a readonly string index signature to the accepted
  environment source.
- Prevention control: Model boundary types from the actual runtime object shape.
- Verification evidence: Type-check passed after the type correction.
- Recurrence status: No known recurrence.

## EL-0008: Prisma Proxy Inspected Through Instance Assertion

- Date: 2026-07 retrospective
- Pull request or task: Prisma service tests
- Category: Unit or integration tests
- Symptom: `RangeError: Maximum call stack size exceeded`
- Root cause: `toBeInstanceOf` recursively inspected Prisma proxy internals.
- Unsuccessful method: Test construction through prototype identity.
- Successful method: Verify construction and observable behavior without proxy
  hierarchy inspection.
- Prevention control: Prefer behavioral assertions for generated and proxy-based
  clients.
- Verification evidence: Test suite passed after assertion replacement.
- Recurrence status: No known recurrence.

## EL-0009: CI Used as the First Complete Preflight

- Date: 2026-07 retrospective
- Pull request or task: Multiple PRs before PR 48
- Category: Process, communication, or polling waste
- Symptom: CI exposed installation, formatting, lint, type, test, and build
  failures one stage at a time.
- Root cause: Changes were pushed before running the complete local-equivalent
  verification sequence.
- Unsuccessful method: Fix only the first CI error and push again.
- Successful method: Run the complete applicable sequence before pushing and
  reserve CI for independent confirmation.
- Prevention control: Pull-request template requires command-by-command evidence.
- Verification evidence: Later PR heads passed complete CI after disciplined
  preflight.
- Recurrence status: Recurrence remains possible until the new governance check
  is integrated.

## EL-0010: Brittle Generated-File Patch Matched Indentation

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Generated artifacts
- Symptom: The implementation generator failed before type-check because the
  fixer expected source indentation that changed after dedenting.
- Root cause: The patch depended on exact whitespace instead of source structure.
- Unsuccessful method: Match a generated block using indentation-sensitive text.
- Successful method: Use a structural pattern and then remove the generator from
  the permanent branch.
- Prevention control: Prefer direct source edits or AST-aware changes; temporary
  generators require deterministic tests and must not ship.
- Verification evidence: The structural correction allowed generation to finish,
  and permanent scaffolding was later removed.
- Recurrence status: Method prohibited for permanent implementation.

## EL-0011: Temporary Construction Workflows Entered the PR Diff

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Generated artifacts
- Symptom: Generator and diagnostic files remained after implementation files
  were produced.
- Root cause: Construction tooling was treated as part of the feature branch.
- Unsuccessful method: Leave temporary workflows for convenience after use.
- Successful method: Remove all construction debris before final diff review and
  rerun verification on the clean branch.
- Prevention control: Final diff review explicitly rejects temporary workflows,
  builders, diagnostics, and bypasses.
- Verification evidence: PR 48 permanent diff was reduced to product files.
- Recurrence status: Must be checked on every generated change.

## EL-0012: Database Test Verified SQL Text Instead of Behavior

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Database migration or live behavior
- Symptom: A test claimed database coverage while only searching SQL text.
- Root cause: Static presence was substituted for executable integrity evidence.
- Unsuccessful method: Assert that trigger or constraint text exists.
- Successful method: Add transaction-backed PostgreSQL tests for organization
  isolation, immutability, lifecycle, reviewer separation, optimistic versions,
  and post-application protection.
- Prevention control: Database behavior requirements require live database tests.
- Verification evidence: Complete CI passed the live PostgreSQL test suite.
- Recurrence status: Static SQL checks may supplement but never replace behavior.

## EL-0013: UI Shell Did Not Implement the Governed Workflow

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Runtime or workflow behavior
- Symptom: The workspace omitted Organization context, CSRF headers, current
  optimistic versions, review, and apply operations.
- Root cause: Visual presence was mistaken for workflow completion.
- Unsuccessful method: Accept a UI because the screen existed and built.
- Successful method: Trace every required operation through the actual HTTP
  contract and implement the complete governed workflow.
- Prevention control: Test the actual user workflow, not merely rendering or
  component existence.
- Verification evidence: Type-check, tests, build, and live workflow tests passed.
- Recurrence status: Acceptance criteria must include end-to-end behavior.

## EL-0014: Verification Evidence Created a Self-Referential Commit Loop

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Documentation or evidence management
- Symptom: Recording an exact CI run or commit in ADR 0027 created a new commit,
  invalidating the just-recorded exact-head evidence.
- Root cause: Mutable repository content was used to store evidence about the
  commit containing that content.
- Unsuccessful method: Update the ADR after every green exact-head run.
- Successful method: Make repository documentation independent of ephemeral run
  identifiers and store final evidence in pull-request metadata.
- Prevention control: Freeze source before CI; no exact verifying run ID is added
  to source after the freeze.
- Verification evidence: Later exact-head runs passed after the ADR became
  independent of commit hashes.
- Recurrence status: Prohibited by the repository freeze rule.

## EL-0015: Repository File Action Used for PR Metadata

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: GitHub or tool-operation error
- Symptom: Repeated `update_file` calls created documentation-only commits while
  the intended target was the pull-request body.
- Root cause: The action was selected without validating the target type.
- Unsuccessful method: Retry the same repository-write action while describing an
  intention to use `update_pull_request`.
- Successful method: Stop all writes, verify the latest head, and use the explicit
  pull-request metadata action for future metadata changes.
- Prevention control: Before each write, classify the target and compare it with
  the selected action. One wrong write triggers an immediate stop condition.
- Verification evidence: PR 48 was eventually marked ready without merging.
- Recurrence status: Severe recurrence on PR 48; new governance control required.

## EL-0016: Excessive Polling and Repeated Status Narration

- Date: 2026-07-16
- Pull request or task: PR 48
- Category: Process, communication, or polling waste
- Symptom: Many unchanged workflow polls and status messages consumed time and
  conversation space.
- Root cause: Polling cadence was driven by activity rather than meaningful state
  changes.
- Unsuccessful method: Poll every few seconds and narrate unchanged stages.
- Successful method: Poll at a reasonable interval and report only root-cause,
  fix, stage-transition, blocker, or completion events.
- Prevention control: Communication and polling rules are mandatory.
- Verification evidence: Not yet proven on a later PR.
- Recurrence status: Open prevention item.

## EL-0017: Completion Language Used Before Full Verification

- Date: 2026-07 retrospective
- Pull request or task: Multiple PRs
- Category: Documentation or evidence management
- Symptom: A source correction was described as complete before the full pipeline
  passed.
- Root cause: Changed source state was confused with verified repository state.
- Unsuccessful method: Declare completion after one focused correction.
- Successful method: Use precise states: Changed, Integrated, Verified Locally,
  CI Green, and Complete.
- Prevention control: Completion claims require exact-head CI and no unresolved
  issue.
- Verification evidence: Defined by the NEWAX Engineering Accuracy and
  Verification Protocol.
- Recurrence status: Must be checked in every final report.

## Next Entry

Use the next identifier:

```text
EL-0028
```
