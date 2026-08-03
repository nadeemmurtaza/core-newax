<!-- newax-prevention-control
pack-id: PACK-ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT
root-cause-id: ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT
control-id: PREV-ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT-CODING-STANDARD
control-type: coding-standard
revision: 7
state: generated
digest: 7916c4a00e57b5259e14d5c6d27a9b336bac3c93dd2958e111093321e037b151
-->
# Coding Prevention Standard

- Root cause: `ROOT-GITHUB-GOVERNANCE-FIELD-INCONSISTENT`
- Ledger entry: `EL-0023`
- State: `generated`
- Revision: `7`
- Source occurrences: `PREV-EVENT-1738`, `PREV-EVENT-1739`, `PREV-EVENT-1740`, `PREV-EVENT-1741`, `PREV-EVENT-1742`, `PREV-EVENT-1743`, `PREV-EVENT-1744`

## Rule

Generate and commit every prevention-pack target produced by the trusted prevention renderer whenever governance reports missing generated controls, then link the occurrence before rerunning.

## Avoid

Complete issue metadata and rerun governance while the prevention pack's generated source files are still absent.

## Required method

Reconstruct the prevention pack from the trusted parser, engine, and renderer; commit all seven required controls; and use the final generated-control commit as the fix anchor.
