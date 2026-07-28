# EL-0018: Process PR Opened Before Formatting Write

- Date: 2026-07-16
- Pull request or task: PR 49
- Category: Formatting and process control
- Symptom: Continuous Integration passed dependency installation, schema
  validation, migrations, and migration status, then failed at
  `pnpm format:check`.
- Root cause: The process branch was opened before the changed JavaScript file
  was run through the repository's exact Prettier configuration.
- Unsuccessful method: Assume manually written source matches Prettier and let CI
  become the first formatting check.
- Successful method: Load the repository's `.prettierrc.json`, run the pinned
  Prettier version against the changed file, apply the exact formatted output,
  and rerun the complete pipeline.
- Prevention control: A pull request must not be opened until formatting write
  and formatting check have run against the changed source. When the working
  environment cannot execute the repository formatter, the task is Blocked for
  source submission rather than delegated to CI by optimism.
- Verification evidence: Pending exact-head CI after commit
  `4bb1691d91929a56bb508acff48f3712a6bc0be5` and this learning record.
- Recurrence status: Repeated form of EL-0004 and EL-0009; the new control makes
  availability of an executable formatter a precondition for opening a PR.

## Amendment rule

This entry is stored as an individual ledger record because the original ledger
file was already present on the branch. Future learning records may use one file
per entry under this directory while the master ledger remains the summary and
retrospective index.
