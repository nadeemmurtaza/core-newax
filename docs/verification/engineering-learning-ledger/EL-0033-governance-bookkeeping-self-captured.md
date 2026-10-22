# EL-0033 — Governance Bookkeeping Failures Were Self-Captured as New Occurrences

## Category

`engineering-failure-intake-quality`

## Root-cause ID

`ROOT-GOVERNANCE-BOOKKEEPING-SELF-CAPTURED`

## Root cause

The engineering failure-intake workflow captured every failed step of the pull-request governance job as a new engineering-learning issue, including steps that fail only because the pull request's own governance bookkeeping (linked-issue list, planning-issue link, record structure) had not yet caught up with a previous capture from that same job. Fixing the bookkeeping requires a pull-request body update, which reruns the job and can trip the same bookkeeping check again, so a single governance gap could produce an unbounded chain of newly captured issues instead of engineering signal about the change under review.

## Unsuccessful method

Capture every failed step of the governance job identically, treating a bookkeeping-consistency failure caused by the capture mechanism itself the same as a real defect in the code under review.

## Successful method

Exclude the governance job's self-referential bookkeeping steps (pull-request structure validation, workflow/learning-evidence reconciliation, planning-issue-link detection) from automatic capture when they are the only failed steps in a run. Continue capturing real CI failures and every governance check that evaluates evidence about the change itself (AI quality, prevention, confidence, knowledge graph, recurrence, executive dashboard, root-cause decisions).

## Prevention control

`tooling/workflow-failure-capture.mjs` classifies failed steps before capture and skips a job whose only failed steps are self-referential governance bookkeeping, so fixing a bookkeeping gap does not generate a new tracked occurrence.

## Required evidence

- the specific step name that failed;
- whether the step evaluates the pull request's own governance bookkeeping or real evidence about the change;
- confirmation that non-bookkeeping failures in the same job still capture normally.

## Regression boundary

A pull request's own governance-bookkeeping failure must never generate a new engineering-learning issue when it is the only failed step in a governance job run. A real CI failure or a governance check that evaluates evidence about the change (not the PR's own bookkeeping state) must always still be captured.
