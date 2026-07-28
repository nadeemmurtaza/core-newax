# CLAUDE.md

Repository conventions for `core-newax` are documented in `AGENTS.md` at the repository
root — read it before working in this repo. It covers commands, code-review rules
(including the GitHub Actions commit-SHA pinning convention), and merge policy.

In particular: **do not merge a pull request that has open, unresolved Codex review
threads**, regardless of CI status. Fix the underlying issue or dismiss the finding with
a written justification, then mark the thread resolved, before merging.

**Do not skip, disable, or weaken a test to get real work merged**, and do not bypass a
failing or required check (`--no-verify`, admin-merge override, etc.) to land real
feature/fix work. Fix the underlying issue instead. The only exceptions are pre-existing,
already-tracked infrastructure flakiness unrelated to the change, and this repo's
documented self-referential governance-bookkeeping lag pattern, where an admin-bypass
merge is an accepted, separately-documented exception once "Verify monorepo" and CodeQL
are green.
