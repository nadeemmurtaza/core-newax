# Engineering Recurrence Detection

Status: mandatory Engineering Intelligence standard  
Schema version: `1`

## Purpose

Recurrence Detection links distinct confirmed occurrences of one exact root cause, lists their earlier PRs, determines whether a prevention rule was already effective, records why the rule was not followed, and generates escalation.

## Authority

- Root Cause Engine owns root-cause identity and confirmation.
- Prevention Engine owns rules, control state, effective time, retirement, and supersession.
- Recurrence Detection aggregates those decisions without rewriting them.
- Wording, category, signatures, author, timing, repository path, or shared PR context never prove recurrence.

## Identity and deduplication

A recurrence series requires the same exact root-cause ID and `confirmed` or `machine-supported` status. Candidate and unclassified causes do not count. Re-ingestion of one exact occurrence does not increase the series. Conflicting content under one occurrence ID is rejected.

Occurrences are ordered by normalized occurrence time and stable ID. Reports show every earlier occurrence and unique previous PR number in chronological order.

## Rule applicability

A rule applies only when it has the same root cause, state `generated` or `enforced`, effective time no later than the occurrence, and no earlier retirement. The latest applicable rule is selected.

Pre-rule occurrences remain history, not control violations. Policy cannot travel backward through time, despite management's occasional optimism.

## Required explanation

A post-rule recurrence must answer why the rule was not followed with one disposition:

- `not-applicable`
- `not-effective-yet`
- `not-integrated`
- `not-executed`
- `bypassed-with-approval`
- `bypassed-without-approval`
- `control-failed`
- `failure-ignored`
- `unknown`

Every explanation requires reason, reviewer, and durable evidence references. `unknown` remains unresolved. An approved bypass additionally requires approver, bounded scope, effective time no later than the occurrence, and approval evidence. Late approval cannot authorize earlier conduct.

## Escalation

- `none`: first confirmed occurrence.
- `observe`: repeated root cause without an applicable effective rule.
- `warning`: first post-rule recurrence.
- `high`: second post-rule recurrence.
- `critical`: third or later post-rule recurrence.

For an enforced rule, `not-executed`, `bypassed-without-approval`, `control-failed`, and `failure-ignored` raise escalation to at least `high`. A new post-rule occurrence becomes `critical` when an earlier high or critical escalation remains unresolved.

## Lifecycle

States are `clear`, `observe`, `detected`, `resolved`, `waived`, and `insufficient-evidence`. Draft PRs expose recurrence but do not block. Review-ready PRs block unresolved attributable `warning`, `high`, or `critical` decisions.

## Records and collection

`newax-recurrence-input` stores occurrences, rules, explanations, current occurrence, and prior escalation state. `newax-recurrence-decision` stores the normalized decision, counts, previous PRs, rule, explanation, missing evidence, blocker, and SHA-256 digest. Authors do not type final counts, state, or escalation.

Collection accepts structured `newax-engineering-event`, `newax-prevention-event`, and `newax-recurrence-event` records from linked issues and comments. Ordinary prose is not verified evidence.

## Governance

Governance recalculates current-PR decisions and rejects missing records, candidate identity, conflicting occurrence IDs, unsupported explanations, incomplete or late approvals, altered digests, and unresolved review-ready post-rule recurrence.

Every root cause represented in the current PR is evaluated independently. An unrelated later occurrence cannot hide another recurring root cause.

## Knowledge Graph and privacy

Recurrence records may be linked as contextual evidence to Knowledge Graph nodes but cannot create or upgrade causal edges. Error Relationship Graph remains authoritative for causality.

Records use bounded metadata and durable references. Secrets, credentials, raw private prompts, and unnecessary source content are prohibited.
