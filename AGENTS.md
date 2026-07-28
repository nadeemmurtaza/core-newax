# AGENTS.md

This is `core-newax`, a pnpm/Turborepo monorepo (NestJS, Next.js, Prisma) with a custom
"Engineering Intelligence" governance and CI system layered on top of standard checks.

## Commands

- Format check: `pnpm format:check` (fix with `pnpm format`)
- Lint: `pnpm lint` (fix with `pnpm lint:fix`)
- Type-check: `turbo run typecheck` (via `pnpm typecheck`)
- Tests: `pnpm test` (learning-system tests plus `turbo run test`)
- Full local verification: `pnpm verify`

## Code Review Rules

- **GitHub Actions must be pinned to commit SHAs.** Every `uses:` reference in
  `.github/workflows/*.yml` must reference a full 40-character commit SHA, not a mutable
  version tag or branch (e.g. `actions/checkout@<sha> # v7`, never `actions/checkout@v7`
  or `owner/action@master`). Flag any new or changed `uses:` line that isn't pinned this
  way — see `docs/verification/engineering-learning-ledger/EL-0036-github-actions-mutable-tag-references.md`.
- **No secrets, credentials, or tokens in diffs.** Flag anything that looks like an API
  key, password, or private token, including in workflow YAML, test fixtures, or
  documentation examples.
- **Dependency and lockfile changes must be intentional.** `pnpm-lock.yaml` changes
  should correspond to an actual `package.json` dependency change; flag lockfile-only
  diffs with no accompanying manifest change.
- **New workflows or CI tools should be non-blocking unless explicitly scoped as
  required.** Informational security/lint tooling (e.g. SAST scanners) should not be
  silently promoted to a required, merge-blocking status check.
- **New root-cause or governance-catalog entries need their own pull request.** Changes
  to `docs/verification/engineering-learning-catalog.json` should not be bundled with
  the pull request that also implements the fix referencing that entry — flag if both
  land in the same diff.
- **Prefer existing conventions over new patterns.** Check whether a similar workflow,
  script, or module already exists before introducing a new one; flag unnecessary
  duplication or unused code, dependencies, and abstractions.

## Merge Policy

- **Every Codex review finding must be resolved before a pull request merges.**
  "Resolved" means either the underlying issue is fixed and the review thread marked
  resolved, or the finding is dismissed with a written justification (e.g. a false
  positive) and the thread marked resolved. A pull request with open, unaddressed Codex
  review threads must not merge, regardless of CI status. This applies to every severity
  level Codex reports (P0 through P2), not only the highest-priority findings.
