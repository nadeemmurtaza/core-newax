# EL-0034 — Human-Authored Governance Template Blocked Automated Dependency Pull Requests

## Category

`dependency-update-governance-scope`

## Root-cause ID

`ROOT-GOVERNANCE-TEMPLATE-BLOCKS-AUTOMATED-PR`

## Root cause

The pull-request governance job's structural, planning, and evidence checks assumed every pull request was human-authored and filled in the "Pull Request Record" template, with no exemption for automated dependency-update pull requests. Dependabot's own generated body ("Bumps [x] from A to B...") cannot satisfy that template — it has no root cause, no plan, no AI output, and no architecture decision for the governance record to capture — so every Dependabot pull request failed "Verify pull-request governance structure" immediately, before real CI (format, lint, typecheck, test, build, lockfile supply-chain policy) ever had a chance to gate mergeability on its own merits.

## Unsuccessful method

Apply the full human-authored governance record requirement uniformly to every pull request regardless of author, with no path for a routine automated dependency bump to ever pass.

## Successful method

Skip the entire "Verify engineering learning record" job for pull requests authored by `dependabot[bot]`, since those pull requests carry no engineering decision for the record to capture. The separate Continuous Integration workflow (format, lint, typecheck, test, build, lockfile supply-chain policy) still fully gates mergeability for automated dependency pull requests exactly as it does for human-authored ones.

## Prevention control

`.github/workflows/pr-governance.yml`'s `verify-learning-record` job carries a job-level `if: github.event.pull_request.user.login != 'dependabot[bot]'` condition.

## Required evidence

- the pull request's author login;
- confirmation that Continuous Integration (`ci.yml`) still runs unconditionally regardless of author;
- confirmation that a human-authored pull request is not exempted by this condition.

## Regression boundary

An automated dependency-update pull request must never be blocked from merging solely because it cannot satisfy a governance record template meant for human-authored engineering decisions. A human-authored pull request must never be exempted from that same template by this control.
