# NEWAX Root Cause Catalog

## Format

Each root cause entry identifies a confirmed failure pattern with its unique identifier, description, and applicable ledger entries.

---

## ROOT-GOVERNANCE-MANUAL-LEARNING-OUTCOME

**Description:** Pull-request governance allowed authors to select `Learning outcome: none` and contradicted that choice only after limited failure evidence became visible. The learning requirement was author-controlled instead of derived from pull-request diff and reconciled evidence.

**Affected Systems:** Engineering Learning System, Pull Request Governance

**Ledger Entry:** EL-0023

**Prevention:** Derive required or not-required from changed files and reconciled evidence. Prohibit manual outcome fields.

**First Confirmed:** Issue #225

**Status:** Confirmed

---

## ROOT-ENGINEERING-QUALITY-REDUCED-TO-MISTAKE-COUNT

**Description:** Executive engineering reporting lacked a versioned, source-backed operational view and could collapse engineering quality into a simple mistake count without formulas, denominators, coverage, freshness, or evidence status.

**Affected Systems:** Executive Dashboard, Engineering Intelligence

**Ledger Entry:** EL-0031

**Prevention:** Generate deterministic snapshots from authoritative engineering records. Retain explicit formulas and coverage. Separate verified from estimated values. Preserve currencies. Render missing evidence as `insufficient-evidence`.

**First Confirmed:** Issue #253

**Status:** Confirmed

---

## ROOT-GITHUB-DECLARED-ACTION-DIFFERS-FROM-INVOKED-ACTION

**Description:** The intended full governance record was not reflected in the actual stored PR description. The PR contained a short summary while the trusted validator required the complete structured record, so the declared target state and invoked metadata state differed.

**Affected Systems:** Pull Request Governance, GitHub Metadata

**Ledger Entry:** EL-0020

**Prevention:** Before governance review, execute `verify-pr-governance.mjs` against the exact PR event. Compare every required heading and field with the stored PR body.

**First Confirmed:** Issue #275

**Status:** Confirmed

---

## ROOT-FORMATTING-NOT-APPLIED

**Description:** The source state was pushed without first applying and reviewing the repository's exact Prettier configuration, so `pnpm format:check` found code-style differences before substantive verification could continue.

**Affected Systems:** Code Formatting, CI/CD Pipeline

**Ledger Entry:** EL-0004

**Prevention:** Apply `pnpm format` and `pnpm format:check` as mandatory source-submission preconditions. Review the resulting diff before commit. Never treat a local formatter run as a remote fix before committing and pushing.

**First Confirmed:** Issue #278

**Status:** Confirmed

---
