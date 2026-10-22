# EL-0023: Learning-Outcome Field Set Inconsistently With Its Dependent Fields

## Category

GitHub tool operation.

## Symptom

`tooling/verify-pr-governance.mjs` failed with "A learning outcome requires at least one ledger entry such as EL-0019" and "A learning outcome requires at least one linked learning issue such as #123" on a PR record that set `Learning outcome: existing`.

## Root cause

The PR record set `Learning outcome` to `existing` while leaving `Ledger entries`, `Learning issues`, and `Root-cause status` as `not-required` — the placeholder values that are only valid for a `none` outcome. `existing`/`new` outcomes always require a real ledger entry and a linked, resolved learning issue.

An automated root-cause classifier initially misclassified the resulting CI failure as `ROOT-GITHUB-STALE-CONTENT-SHA` (candidate confidence, not machine-supported) — a pattern about reusing a stale blob SHA in a repository-content write, unrelated to this failure. The classification was corrected after the actual log output was reviewed directly.

## Unsuccessful method

Copy the `not-required` placeholder row from the `none`-outcome template while using a non-`none` Learning outcome.

## Successful method

Set `Learning outcome: none` with `not-required` for `Ledger entries`, `Learning issues`, and `Root-cause status` whenever no ledger entry or tracked issue actually applies. Reserve `existing`/`new` for cases with a real ledger entry (`EL-XXXX`) and a linked learning issue that has its own resolution record fully filled in (confirmed root cause, verified resolution, reviewer confirmation).

## Resolution

The PR record was corrected to `Learning outcome: none` first; when the resulting reconciliation check (`tooling/reconcile-pr-learning.mjs`) still found a linked failure-intake issue for the same commit, the outcome was corrected again to `existing`/`new` with this ledger entry and the linked issue's resolution record completed.

## Prevention control

Before submitting a PR record, confirm the Learning-outcome value and its dependent fields (`Ledger entries`, `Learning issues`, `Root-cause status`) are set consistently per the `none` vs `existing`/`new` rule enforced by `tooling/verify-pr-governance.mjs` and `tooling/reconcile-pr-learning.mjs` — not copied from a template row for the other case.

## Evidence

- Pull request: `#1134`
- Initial failed run: `https://github.com/nadeemmurtaza/core-newax/actions/runs/30209346765/job/89812841838`
- Linked learning issue: `#1135`
- Corrected root-cause classification: `ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT`
