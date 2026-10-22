# EL-0032 — Engineering Quality Was Reduced to a Mistake Count

## Category

`engineering-executive-reporting-quality`

## Root-cause ID

`ROOT-ENGINEERING-QUALITY-REDUCED-TO-MISTAKE-COUNT`

## Root cause

Engineering reporting emphasized aggregate mistake volume without showing recurrence concentration, cost, lost time, prevention effectiveness, detection and resolution speed, AI accuracy, review effectiveness, or evidence coverage. The count could grow while engineering quality improved, or remain flat while expensive recurring failures worsened.

## Unsuccessful method

Display one total mistake count and ask leadership to infer operational risk, quality movement, and prevention performance from it.

## Successful method

Generate a versioned executive snapshot from normalized source evidence. Show distinct metric families with explicit formulas, denominators, coverage, freshness, verified and estimated shares, and missing-evidence states.

## Prevention control

Trusted governance recalculates linked dashboard snapshots and rejects manually supplied KPI values, altered digests, missing coverage, and unsupported records. A read-only weekly workflow generates HTML and JSON artifacts from current GitHub evidence.

## Required evidence

- exact reporting window and period;
- normalized source records;
- formula, numerator, denominator, and coverage for each KPI;
- separate currency, verified, and estimated values;
- lifecycle timestamps for MTTD, MTTR, and MTTV;
- reviewer-validated AI outcomes;
- valid human-review findings and merge timing;
- executed workflow steps for governance rates;
- deterministic snapshot and digest.

## Regression boundary

Missing values must never become zero. Unexecuted workflows must never become engineering failures. Unvalidated AI output must never enter accuracy. Different currencies must never be silently combined. A total issue or mistake count must not substitute for the required executive metric families.
