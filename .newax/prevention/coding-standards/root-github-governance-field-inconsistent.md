<!-- newax-prevention-control
pack-id: PACK-ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT
root-cause-id: ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT
control-id: PREV-ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT-CODING-STANDARD
control-type: coding-standard
revision: 6
state: generated
digest: cf51a9dd0b68c00a429760dd834808abedc5f49fb391ad1791ec699eab7e3084
-->
# Coding Prevention Standard

- Root cause: `ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT`
- Ledger entry: `EL-0023`
- State: `generated`
- Revision: `6`
- Source occurrences: `PREV-EVENT-1738`, `PREV-EVENT-1739`, `PREV-EVENT-1740`, `PREV-EVENT-1741`, `PREV-EVENT-1742`, `PREV-EVENT-1743`

## Rule

When several governance runs have already failed, create complete occurrence records for every outstanding failed run before triggering the next reconciliation.

## Avoid

Correct only the immediately preceding issue while an additional failed reconciliation run is already outstanding.

## Required method

Record runs 1029 and 1030 together, give both complete prevention evidence, and link both in PR 1737 before the next run.
