# Confidence Scoring

Status: mandatory Engineering Intelligence standard  
Policy version: `CONFIDENCE-1.0.0`

## Purpose

Every supported Engineering Intelligence finding must expose one recalculable confidence envelope. The envelope separates five questions that must not be collapsed into one attractive but ambiguous number:

1. How strongly does the evidence support the selected root-cause classification?
2. How strongly does the evidence support that two findings are the same occurrence or share one verified root cause?
3. How complete and trustworthy is the evidence set itself?
4. How strongly does the verified evidence support the written causal explanation?
5. How strongly does the evidence support that prevention automation is complete, current, enforceable, verified, and governed?

## Non-probability rule

A score such as `92%` means policy `CONFIDENCE-1.0.0` assigned 92 evidence-support points. It does not mean there is a 92 percent real-world probability that the claim is true.

Scores must always include:

- policy version;
- input digest;
- score and display value;
- band and status;
- metric meaning;
- evidence references;
- missing evidence;
- applied caps.

Historical scores retain the policy version under which they were calculated. A future policy must not silently reinterpret them.

## Canonical envelope

Every envelope contains:

- `rootCauseConfidence`;
- `duplicateConfidence`;
- `evidenceQuality`;
- `explanationConfidence`;
- `automationConfidence`.

Each percentage score is an integer from 0 through 100. Rounding occurs only after weighted components are combined and caps are applied.

A high score in one metric cannot replace missing evidence in another. Missing subsystem evidence produces `insufficient-evidence` with score zero for that metric.

## Bands

- High: 80 through 100.
- Medium: 60 through 79.
- Low: 0 through 59.
- Insufficient: the required subsystem input does not exist.

Evidence Quality displays `High`, `Medium`, `Low`, or `Insufficient` in addition to its numeric score.

## Evidence Quality

Evidence Quality evaluates the evidence set, not the claim.

Maximum components:

- verified-record coverage: 35 points;
- verified source-type diversity: 20 points;
- primary and durable evidence: 15 points;
- provenance completeness: 15 points;
- required-role coverage: 15 points.

Penalties:

- each contradictory record: 20 points, up to 40;
- each unavailable record: 10 points, up to 20.

If no record is verified, the metric is capped at 49. Required evidence roles must remain visible in `missingEvidence`.

## Root Cause Confidence

Root Cause Confidence combines:

- selected root-cause assessment score: 75 percent weight;
- Evidence Quality score: 25 percent weight.

Caps:

- absent or unclassified root cause: 49;
- absent canonical root-cause evidence set: 49;
- ambiguous competing cause: 59;
- explicit contradictory evidence: 39;
- candidate non-deterministic classification: 69;
- declared missing root-cause evidence: 79.

A catalog confidence label does not override observed evidence or the caps.

## Duplicate Confidence

Duplicate Confidence uses the evidence-backed occurrence relation:

- exact occurrence evidence may score 100;
- verified shared root cause may score 95 or another policy-supported value;
- verified different root causes may score zero with relation `unrelated`;
- incomplete classification evidence remains `insufficient-evidence` and is capped at 60.

Shared wording, category, timestamp, pull request, or signature overlap alone cannot establish a duplicate.

## Explanation Confidence

Explanation Confidence starts from the Evidence-Backed Explanation Verification score. It preserves the explanation decision.

Caps:

- challenged explanation: 79;
- rejected explanation: 39;
- unresolved contradictory explanation evidence: 39.

Missing proof-log, introducing-commit, reproducing-test, alternative-review, or evidence references remain visible. An accepted root-cause classification cannot substitute for a missing explanation.

## Automation Confidence

Automation Confidence evaluates one Prevention Engine pack.

Maximum components:

- all seven controls present: 35 points;
- pack validation succeeds: 20 points;
- exact generated files are current: 15 points;
- CI and static-analysis controls are enforced: 15 points;
- control verification references are complete: 10 points;
- exact Prevention Engine governance succeeds: 5 points.

Caps:

- incomplete or invalid pack: 49;
- executable controls remain candidates: 79;
- generated files are not verified current: 89;
- exact governance has not succeeded: 94.

Confidence metadata must not be inserted into the generated prevention artifacts it scores. Doing so would change the artifact and create recursive verification drift.

## Structured records

A confidence record has two distinct parts:

1. `newax-confidence-input`, containing recalculable normalized inputs.
2. `newax-confidence-score`, containing the generated envelope, policy version, and input digest.

Issue-form fields may create the input record. Final percentages and quality labels must never be supplied manually.

Governance recalculates every linked record and rejects:

- missing score records;
- stale policy versions;
- input-digest mismatches;
- altered metric output;
- manually entered final scores or quality labels;
- review-ready pull requests whose linked finding issues lack source coverage.

## Supported analysis surfaces

The confidence envelope is added to:

- planning findings;
- communication findings;
- AI and engineering-tool findings;
- root-cause and duplicate analysis output;
- explanation verification output;
- Prevention Engine analysis output.

Existing finding lifecycle, blocker, waiver, resolution, dataset, and exit-code decisions remain authoritative. Confidence Scoring enriches them; it does not replace them.

## Calibration and policy changes

`CONFIDENCE-1.0.0` is deterministic and rule-based. Empirical probability calibration is outside this policy version.

A future calibrated policy requires:

- labeled historical outcomes;
- documented sampling and class balance;
- calibration-error measurement;
- drift monitoring;
- a new policy version;
- preservation of old inputs and scores;
- explicit migration or side-by-side comparison.

No statistical language may be introduced merely because the display contains a percentage sign.
