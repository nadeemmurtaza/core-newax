# EL-0036 — GitHub Actions Referenced by Mutable Tags Instead of Pinned Commits

## Category

`supply-chain-pinning`

## Root-cause ID

`ROOT-GITHUB-ACTIONS-MUTABLE-TAG-REFERENCE`

## Root cause

Workflow steps across `.github/workflows/*.yml` referenced third-party GitHub Actions by mutable version tags (for example `actions/checkout@v7`) or, in one case, by a mutable branch (`snyk/actions/node@master`). A tag or branch can be silently repointed by the action's owner or a compromised maintainer account to a different commit, letting arbitrary code run inside every workflow that references it with the repository's `GITHUB_TOKEN` and secrets — the mechanism behind real incidents such as the `tj-actions/changed-files` and `reviewdog/action-setup` supply-chain compromises.

## Unsuccessful method

Reference third-party actions by human-readable version tag or branch name and trust the publisher never to repoint that reference.

## Successful method

Pin every `uses:` reference across all workflow files to its exact 40-character commit SHA, with a trailing `# vN` comment preserving the human-readable version for readability and for Dependabot's SHA-pinning update support (`actions/checkout@<sha> # v7`).

## Prevention control

Semgrep's `yaml.github-actions.security.github-actions-mutable-action-tag` rule (`.github/workflows/semgrep.yml`, landed in EL-0035) flags any future unpinned `uses:` reference in GitHub's Code Scanning UI, giving an ongoing signal if a new workflow or dependency bump reintroduces a mutable reference.

## Required evidence

- confirmation that every `uses:` line under `.github/workflows/*.yml` is pinned to a 40-character commit SHA;
- confirmation that each pinned SHA resolves to the commit the corresponding version tag (or, for `snyk/actions`, the nearest tagged release) actually points to;
- confirmation that CI (`Verify monorepo`) and CodeQL still pass with the pinned references.

## Regression boundary

A future dependency bump (manual or via Dependabot) that reintroduces an unpinned `uses:` reference is a regression of this root cause, not a new finding — Dependabot's `github-actions` ecosystem update in `.github/dependabot.yml` targets the pinned SHA directly, so routine version bumps update the SHA and its trailing comment together.
