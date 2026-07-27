# NEWAX Learning Outcome Rule Engine

## Status

Mandatory engineering-governance control.

## Purpose

The learning outcome for a pull request is calculated by trusted governance. It is not selected by the pull-request author.

A pull request may have no failed test and still create material engineering learning. A new rule, checklist, process, template, or automation changes how future work must be performed. Treating such a change as `none` discards the prevention control the pull request just created, which is bureaucratic self-erasure with nicer Markdown.

## Decisions

The engine returns exactly one of:

- `required`
- `not-required`

The pull-request body must not contain a `Learning outcome` field.

## Mandatory triggers

Learning is `required` when at least one of the following is detected:

1. A new engineering rule, policy, or standard is created.
2. A checklist is created or updated.
3. An engineering process or governance control changes.
4. A pull-request, issue, or operational template changes.
5. Engineering automation is added.
6. A failed pull-request workflow exists.
7. An occurrence-specific engineering-learning issue is linked.
8. A local engineering event is captured.
9. An external-tool engineering event is captured.

These conditions are sufficient. Failure evidence is not required before a prevention control becomes learning.

## Evidence inputs

The rule engine evaluates bounded evidence:

- changed file path;
- changed file status;
- available patch lines;
- failed workflow records;
- linked learning issues;
- local event intake;
- external-tool event intake.

The engine does not rely on the author describing their own change accurately.

## Ledger classification

When learning is required, each referenced ledger entry is classified automatically:

- `new` when the ledger entry is introduced by the pull-request diff;
- `existing` when the entry already exists in the trusted catalog.

An entry that is neither introduced nor catalogued fails governance.

## Required record

A required outcome must include:

- at least one ledger entry;
- at least one occurrence-specific learning issue;
- a confirmed or machine-supported root cause;
- concrete root-cause evidence;
- concrete resolution evidence.

A not-required outcome must use `not-required` for ledger entries, learning issues, and root-cause status.

## Trust boundary

The pull-request template explains the rules but does not decide the result.

The structural verifier rejects a manually supplied `Learning outcome` field. Normal and bootstrap reconciliation independently calculate the outcome from the current pull-request diff and reconciled evidence.

## Output

Governance emits:

- rule-engine version;
- calculated learning outcome;
- matched rule codes;
- files supporting each rule;
- inferred new or existing ledger classifications.

## Limits

Path and patch rules identify governance-significant changes. They do not determine whether the underlying engineering decision is good. Root-cause, explanation, and resolution verification remain separate controls.
