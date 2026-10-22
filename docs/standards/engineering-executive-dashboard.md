# Engineering Executive Dashboard

Status: mandatory Engineering Intelligence reporting standard  
Policy: `EXECUTIVE-DASHBOARD-1.0.0`  
Snapshot schema: `1`

## Purpose

The dashboard turns source-backed engineering evidence into decision-grade quality, cost, time, prevention, AI, and review metrics. It must not reduce engineering health to a total mistake count.

## Authority

The dashboard is a reporting layer. Root Cause, Recurrence, Prevention, Confidence, AI Quality, GitHub review, and workflow-governance systems remain authoritative for their own decisions. Dashboard calculations cannot upgrade candidate evidence or invent causal relationships.

## Metric contract

Every KPI must include:

- formula;
- numerator and denominator where applicable;
- value or `insufficient-evidence`;
- evidence coverage;
- freshness;
- durable source references;
- verified and estimated shares when relevant.

Zero is a valid measured value. Missing evidence is not zero.

## Required panels

1. Top recurring root causes use distinct confirmed occurrences sharing one exact root-cause ID.
2. Most expensive categories use explicit cost records grouped by category and currency. Currencies are never combined without an approved conversion record.
3. Time lost by category uses explicit lost-minute records.
4. Prevention effectiveness is the share of eligible effective rules with no post-rule recurrence after the minimum observation window.
5. Rules frequently ignored count `not-executed`, `bypassed-without-approval`, and `failure-ignored`. `control-failed` is a control defect, not an ignored rule.
6. Mean time to detect is `detectedAt - occurredAt`.
7. Mean time to resolve is `resolvedAt - detectedAt`.
8. Mean time to verify is `verifiedAt - resolvedAt`.
9. Engineering quality trend shows component series for verified resolution, recurrence-free operation, evidence quality, executed-governance pass rate, and human-review effectiveness. No opaque composite score is required.
10. AI accuracy trend uses reviewer-validated outputs only and displays correct, partial, and incorrect rates.
11. Human review effectiveness is valid review findings resolved before merge divided by valid findings, with review coverage and escaped findings shown separately.

## Evidence and eligibility

Cost and time records require durable source references and `verified` or `estimated` status. AI outcomes require an output ID, reviewer, outcome, and references. Review outcomes require PR, finding ID, reviewer, validity, resolution or escape state, and references.

Workflow results count only when repository verification or governance steps executed. A run that stops before checkout or exposes no repository steps is `blocked`, not an engineering failure.

Negative or reversed lifecycle timestamps are invalid. Duplicate stable record identities must be identical or fail validation. Records outside the reporting window are excluded.

## Snapshot and delivery

The canonical normalized input produces one JSON snapshot, one self-contained HTML view, one concise Markdown summary, and one SHA-256 digest. Recalculation must detect altered metrics, formulas, coverage, or digest.

The scheduled workflow runs weekly and may be triggered manually. It uses read-only permissions and uploads HTML and JSON artifacts. It does not commit generated files or modify issues.

## Governance and privacy

Review-ready dashboard changes require a linked recalculable dashboard record and the PR acknowledgement `Manual KPI values supplied: no`. Authors cannot type final KPI values into PR metadata.

Datasets prohibit secrets, credentials, raw private prompts, raw AI output, generated source content, and unnecessary private repository content. Dashboard snapshots may be referenced by Knowledge Graph and Recurrence records as contextual evidence only.
