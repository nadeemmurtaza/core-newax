# CLAUDE.md

Repository conventions for `core-newax` are documented in `AGENTS.md` at the repository
root — read it before working in this repo. It covers commands, code-review rules
(including the GitHub Actions commit-SHA pinning convention), and merge policy.

In particular: **do not merge a pull request that has open, unresolved Codex review
threads**, regardless of CI status. Fix the underlying issue or dismiss the finding with
a written justification, then mark the thread resolved, before merging.
