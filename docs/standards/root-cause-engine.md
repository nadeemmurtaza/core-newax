# NEWAX Evidence-Backed Root Cause Engine

## Status

Mandatory Engineering Intelligence control. Runtime enforcement is active only when the protected base contains the engine and governance gate.

## Purpose

The root-cause engine converts captured failure evidence into an explainable assessment without pretending that a machine can infer semantic truth from an error message alone.

The engine must:

- Rank plausible catalog causes.
- Preserve observed facts separately from explanation.
- Record evidence for and against the selected cause.
- Identify missing evidence.
- Preserve competing hypotheses.
- Promote only deterministic, contradiction-free evidence to `machine-supported`.
- Keep heuristic or ambiguous assessments as `candidate`.
- Decide whether two occurrences are identical, share a verified root cause, are verified as unrelated, or lack enough evidence.
- Verify that a written resolution is consistent with the selected cause and supporting records.
- Block `Learning outcome: none` when observable failure evidence exists.

## Evidence hierarchy

The engine uses evidence in this order:

1. Exact deterministic catalog signatures.
2. Partial or heuristic catalog signatures.
3. Failed workflow, job, step, source, and environment facts.
4. Classified root-cause IDs from prior occurrences.
5. Verified resolution records and reviewer confirmation.
6. Human explanatory prose.

Human prose never overrides contradictory machine evidence merely because it is written confidently.

## Assessment output

Every assessment contains:

- Selected root-cause ID.
- Category.
- Score and confidence.
- Deterministic status.
- Observed facts.
- Matched signatures.
- Evidence supporting the selection.
- Evidence contradicting the selection.
- Missing evidence.
- Up to five ranked hypotheses.
- Ambiguity status.
- Successful and unsuccessful methods.
- Prevention control.
- Ledger entry when classified.

## Classification states

### Candidate

Evidence suggests a cause, but deterministic proof is absent, incomplete, contradicted, or ambiguous.

### Machine-supported

All deterministic catalog signatures match, the selected hypothesis is not tied with a competing cause, and no contradiction is present.

### Confirmed

A reviewer has connected the evidence to a specific cause and a verified resolution record containing:

- Confirmed cause.
- Verified resolution status.
- Fix commit or explicit non-code explanation.
- Successful verification.
- Reviewer confirmation.

## Shared-root-cause decisions

The engine returns one of four relationships.

### Exact occurrence

Fingerprint, source occurrence, and pull-request context are identical.

### Shared root cause

Both occurrences carry the same classified root-cause ID and both are `confirmed` or `machine-supported`.

### Unrelated

Both occurrences carry different classified root-cause IDs and both are `confirmed` or `machine-supported`.

### Insufficient evidence

One or both occurrences remain unclassified or candidate. A shared category, similar wording, or matching unverified catalog ID is not sufficient to merge them. Different candidate IDs are also not sufficient to declare the occurrences unrelated.

This prevents unrelated `ROOT-UNCLASSIFIED-UNKNOWN` issues from being grouped merely because the machine lacked evidence for both, and it prevents unconfirmed guesses from becoming recurrence facts.

## Written explanation verification

The explanation verifier checks:

- The written root-cause ID matches the selected hypothesis.
- `machine-supported` is used only with deterministic evidence and no contradiction.
- `confirmed` includes a specific cause, verified resolution, fix reference, successful verification, and reviewer confirmation.
- An ambiguous hypothesis cannot be confirmed until the competing cause is resolved.
- Referenced evidence exists when an evidence inventory is supplied.
- Unknown causes are not presented as confirmed.

The verifier returns:

- `supported`
- `partially-supported`
- `unsupported`

It also returns:

```text
semanticTruthVerified: false
```

That field is deliberate. The engine verifies evidence consistency and machine-supported classifications. Independent technical review remains responsible for semantic truth when causality is not deterministic.

## False-none prevention

The learning outcome evaluator counts:

- Failed workflow runs.
- Linked engineering-learning issues.
- External and local failure events supplied to the decision.

A declaration of `none` is rejected whenever the count is greater than zero.

## Command

Analyze one evidence object:

```bash
pnpm learning:analyze --file failure.json
```

Or:

```bash
cat failure.json | pnpm learning:analyze
```

Compare the resulting occurrence with a prior machine-readable occurrence:

```bash
pnpm learning:analyze --file failure.json --compare prior-occurrence.json
```

## Governance

Pull Request Governance runs the existing historical reconciliation first and then the root-cause decision verifier.

The verifier checks:

- False `none` declarations.
- Catalog membership.
- Root-cause status consistency.
- Confirmed resolution evidence.
- Deterministic catalog status and complete signature evidence for `machine-supported` decisions.

Candidate pull requests cannot weaken this control because governance executes from the protected base.

## Catalog requirements

The machine-readable catalog must contain unique:

- Root-cause IDs.
- Ledger entries.

Each root cause must define:

- Category.
- Confidence.
- Deterministic flag.
- One or more signatures.
- Root-cause statement.
- Failed method.
- Successful method.
- Prevention control.

Invalid or duplicate catalog records fail analysis rather than silently producing unstable classifications.

## Internal boundaries

The engine is separated into:

- Hypothesis analysis.
- Occurrence relationships.
- Explanation and learning-outcome verification.
- A stable public index consumed by existing tooling.

This keeps scoring, recurrence, and governance rules independently reviewable while preserving the repository's existing import surface.

## Limitations

The engine cannot observe an event that no connected source records.

It cannot independently prove semantic causality for:

- Planning decisions.
- Communication failures.
- Tool-selection mistakes.
- Complex production incidents.
- Multi-system failures with incomplete telemetry.

It can rank evidence, expose contradictions, prevent unsupported certainty, and require verified resolution. It cannot turn missing evidence into knowledge. Software already has enough confidence problems without manufacturing another one.
