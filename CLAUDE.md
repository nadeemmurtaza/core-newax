# CLAUDE.md

Repository conventions for `core-newax` are documented in `AGENTS.md` at the repository
root — read it before working in this repo. It covers commands, code-review rules
(including the GitHub Actions commit-SHA pinning convention), and merge policy.

## Prototype build mode (default for new work)

For new feature/module work in this repo, prioritize speed over polish — this is a raw
prototype that gets finalized, formatted, and linted later in Cursor:

- Focus on core business logic, API routing, database schemas/migrations, and overall
  architectural structure.
- Skip inline comments, strict formatting, and defensive boilerplate unless it's critical
  to the core logic.
- A focused test for new/changed logic is enough — a comprehensive test suite and doc
  updates for every module are no longer required by default (previously always required
  per module in this repo's earlier build-out).
- When outputting multi-file structures, present them plainly (clear file paths, full
  contents) so they're easy to copy into a local directory.

This does **not** relax the merge-safety rules below: CI must still be green (or a real
blocker explained, not silently ignored), and unresolved Codex review threads still block
merging.

In particular: **do not merge a pull request that has open, unresolved Codex review
threads**, regardless of CI status. Fix the underlying issue or dismiss the finding with
a written justification, then mark the thread resolved, before merging.

**Do not skip, disable, or weaken a test to get real work merged**, and do not bypass a
failing or required check (`--no-verify`, admin-merge override, etc.) to land real
feature/fix work. Fix the underlying issue instead. The one narrow, named exception: the
`Verify engineering learning record` job's own pull-request-bookkeeping validation step
(see `tooling/workflow-failure-capture.mjs`'s self-referential-bookkeeping classification
and `docs/verification/engineering-learning-ledger/EL-0033-governance-bookkeeping-self-captured.md`)
can fail purely because fixing it requires editing the pull request body, which reruns
the job and can trip the same bookkeeping check again. When that is the job's only
failing step, an admin-bypass merge is acceptable once "Verify monorepo" and CodeQL are
green — never for a failing test, a real CI job, or an unresolved review finding.
