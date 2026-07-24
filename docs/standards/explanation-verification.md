# NEWAX Explanation Verification

## Status

Mandatory Engineering Intelligence control.

## Purpose

Explanation Verification challenges every engineering explanation before it can be accepted as a confirmed cause.

A plausible sentence is not evidence. A familiar failure pattern is not proof. A confident reviewer is still a person standing near a keyboard.

The system asks:

1. Does verified evidence support the explanation?
2. Does verified evidence contradict it?
3. Is another explanation more strongly supported?
4. Which failed log and step prove the observed failure?
5. Which exact commit introduced the cause?
6. Which passing test reproduces the failure condition?
7. What evidence remains missing?
8. What is the evidence-confidence score?

## Decisions

### `accepted`

The selected cause, evidence references, proving log, introducing commit, reproducing test, and alternative review pass all mandatory gates. The evidence-confidence score is at least 80.

### `challenged`

The explanation may be plausible, but required evidence is missing, unavailable, weak, ambiguous, or not yet reviewed.

A challenged explanation must not be presented as confirmed.

### `rejected`

Verified evidence contradicts the explanation, the written cause differs from the selected evidence-backed hypothesis, or another explanation is more strongly supported.

## Evidence records

Each evidence item has:

```json
{
  "id": "log:123:456:Install dependencies",
  "type": "log",
  "status": "verified",
  "supports": ["ROOT-DEPENDENCY-LOCKFILE-OUTDATED"],
  "contradicts": [],
  "workflowRunId": 123,
  "jobId": 456,
  "stepName": "Install dependencies"
}
```

Supported evidence types are:

- `log`
- `commit`
- `test`
- `artifact`
- `issue`
- `runtime`
- `review`

A record marked `verified` in issue prose is not trusted merely because it says so. Trusted governance rechecks GitHub provenance for required log, commit, and test evidence.

## Required evidence roles

### Proving log

The log record must identify a failed workflow run, failed job, and exact named failed step. If GitHub does not expose the step metadata, the evidence remains unavailable and the explanation stays challenged.

Raw logs and secrets must not be copied into the issue. The record stores bounded identifiers and links.

### Introducing commit

The explanation must identify a full 40-character commit SHA and a verified commit evidence record matching that SHA.

The commit where the failure appeared is not automatically the commit that introduced the cause.

### Reproducing test

The test evidence must identify:

- the test name;
- the command;
- a successful workflow run;
- the exact successful job;
- the exact successful test step;
- `reproduces: true`;
- `outcome: passed`.

A green general pipeline without a named regression test and a successful job-and-step path does not prove reproducibility.

## Evidence-backed exceptions

Some production incidents cannot be reproduced safely, and some inherited defects cannot be attributed to one surviving commit.

An exception is permitted only when:

- it is explicitly approved;
- its reason is specific;
- it cites verified evidence supporting the selected cause;
- the exception is visible in the report;
- the reduced evidence lowers the confidence score.

An exception is not permission to replace missing evidence with imagination.

## Alternative explanations

The verifier evaluates the strongest competing catalog hypothesis.

Evidence supporting or contradicting each cause adjusts the comparison. A competing cause that is more strongly supported rejects the selected explanation. A near-equal or unreviewed alternative keeps the explanation challenged.

## Confidence score

The score is calculated from:

- selected-hypothesis strength;
- verified supporting-evidence coverage;
- cited-reference availability;
- proving-log evidence;
- introducing-commit evidence;
- reproducing-test evidence;
- alternative separation;
- contradictions and missing evidence.

The score is an **evidence-support score**, not a statistical probability that the explanation is true.

A score cannot override a failed mandatory gate.

## Issue integration

Every new engineering-learning issue receives:

- a machine-readable `newax-explanation-evidence` record;
- an explicit review state;
- the current explanation decision;
- evidence support;
- strongest alternative;
- proving-log status;
- introducing-commit status;
- reproducing-test status;
- confidence score;
- missing evidence.

Initial intake normally remains `challenged` because the introducing commit and regression test are not yet proven.

Generated records begin as `unreviewed`. Later graph evidence may refresh an unreviewed record so the issue does not preserve a stale explanation. A record is protected from automatic replacement only after it is explicitly marked `reviewed` with a reviewer identity and review timestamp.

## Governance

A linked engineering-learning issue cannot pass final trusted governance unless:

1. its explanation-evidence record exists and parses;
2. required evidence provenance is verified;
3. the recalculated explanation decision is `accepted`;
4. the existing root-cause and resolution controls also pass.

## Command

```bash
pnpm learning:verify-explanation --file explanation.json
```

The command exits non-zero unless the report is `accepted`.

## Limits

The system verifies evidence structure, provenance, consistency, coverage, alternatives, and reproducibility records.

It does not automatically prove semantic truth merely because a workflow run, commit, or test exists. Reviewer judgment remains required for non-deterministic causes, but judgment must cite verifiable evidence and survive contradiction checks.
