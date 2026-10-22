# EL-0029: Finding confidence was not recalculable across systems

## Classification

- Root-cause ID: `ROOT-FINDING-CONFIDENCE-NOT-CALCULATED`
- Category: `confidence-evidence-quality`
- Confidence: high
- Deterministic: true

## Root cause

Engineering Intelligence findings exposed categorical confidence or subsystem-specific scores without one versioned envelope that separated root-cause support, duplicate support, evidence quality, explanation support, and prevention-automation support. The values could not be compared or recalculated consistently across analysis surfaces.

## Unsuccessful method

Display a confident label or percentage without its scoring policy, input evidence, missing evidence, caps, metric meaning, and deterministic input digest.

## Successful method

Use one versioned rule policy to calculate five independent evidence-support metrics from existing subsystem decisions. Preserve missing inputs as `insufficient-evidence`, expose all caps, retain the policy version, and validate structured records by recalculation.

## Prevention control

Trusted pull-request governance recalculates linked confidence records, rejects manually entered final scores, detects stale policy versions or altered output, and requires source coverage for every linked finding issue before review.

## Required practices

1. Every supported finding includes all five canonical metrics.
2. Percentages are described as evidence-support points, not probabilities of truth.
3. One metric never fills missing evidence in another.
4. Structured input and generated score records remain separate.
5. Historical scores preserve their policy version.
6. Policy changes require a new version and explicit calibration evidence.
7. Existing blocker, lifecycle, resolution, waiver, dataset, and exit-code behavior remains unchanged.

## Verification expectations

Focused verification must cover:

- high and low confidence;
- ambiguous and contradictory evidence;
- verified unrelated and insufficient duplicate relations;
- missing and challenged explanations;
- candidate and verified automation;
- deterministic record round trips;
- stale policy versions;
- manual-score alteration;
- review-ready linked-finding coverage.

Complete verification still requires the repository's exact install, formatting, lint, type-check, complete test, build, and governance pipeline at the final head.
