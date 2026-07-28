# EL-0031 — Repeated Root Causes Were Not Escalated Against Existing Rules

## Category

`engineering-recurrence-quality`

## Root-cause ID

`ROOT-RECURRING-MISTAKE-NOT-ESCALATED`

## Root cause

Engineering learning intake could recognize an exact occurrence and a shared root cause, but it did not build a complete chronological recurrence series, determine whether a prevention rule was already effective, require an evidence-backed explanation for the control gap, or escalate repeated post-rule failures.

## Unsuccessful method

Label the newest issue as a duplicate or recurrence, link one earlier issue, and ask people to remember the existing rule without calculating whether it applied or whether the repeated failure warrants escalation.

## Successful method

Build a deterministic recurrence series from exact confirmed root-cause identity, deduplicate ingestion, preserve every prior PR, resolve the effective prevention rule, require a typed evidence-backed explanation, and escalate by distinct post-rule occurrence count and unresolved prior escalation state.

## Prevention control

Trusted pull-request governance recalculates recurrence history and blocks review-ready unresolved post-rule warnings, high escalations, and critical escalations. Pre-rule history and uncertain root-cause identity remain visible without being falsely labelled as noncompliance.

## Required evidence

- exact root-cause ID;
- confirmed or machine-supported status for every counted occurrence;
- stable occurrence identity and timestamp;
- previous issue and PR references;
- applicable rule ID, state, source, and effective time;
- typed explanation for the control gap;
- evidence references and reviewer;
- approval evidence for an approved bypass;
- deterministic escalation and digest.

## Regression boundary

The same category, signature, wording, author, or nearby occurrence cannot establish recurrence. Repeated ingestion cannot increase the count. A rule effective after an occurrence cannot be used to accuse that occurrence of noncompliance.
