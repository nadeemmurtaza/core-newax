# EL-0030: Engineering failure history was not linked end to end

## Classification

- Root-cause ID: `ROOT-ENGINEERING-HISTORY-NOT-LINKED`
- Category: `engineering-knowledge-provenance`
- Confidence: high
- Deterministic: true

## Root cause

Engineering evidence existed across requirements, commits, pull requests, reviews, workflow runs, findings, root-cause decisions, corrections, verification, learning records, rules, and prevention controls, but those artifacts were not connected through one versioned, recalculable provenance graph. Reconstructing a failure required searching several systems and could silently omit uncertainty or missing stages.

## Unsuccessful method

Rely on memory, search, prose summaries, commit-message similarity, chronology, or a collection of unrelated links to explain the complete history of a failure.

## Successful method

Build one deterministic twelve-stage provenance graph from exact GitHub objects, structured markers, canonical fields, catalog records, and explicit durable references. Preserve candidate links, expose gaps, retain the Error Relationship Graph as the causal authority, and render one canonical GitHub issue as the one-click history view.

## Prevention control

Trusted pull-request governance recalculates linked knowledge records, validates the schema and digest, checks repository-owned URLs and durable references, rejects illegal transitions and false complete claims, and requires every linked finding issue to appear as a bug node before review.

## Required practices

1. Use the twelve canonical node types and versioned edge contract.
2. Never verify an edge from wording, timing, authorship, or category alone.
3. Preserve candidate links without allowing them to satisfy completeness.
4. Never fabricate a missing review, workflow run, root cause, correction, verification, lesson, rule, or prevention record.
5. Treat pre-step workflow runs as CI history, not successful verification.
6. Use source references instead of guessed URLs.
7. Keep causal classification with the Error Relationship Graph and root-cause engine.
8. Link the PR and learning issue to one canonical knowledge-record issue.
9. Preserve normalized graph inputs and deterministic digests.
10. Keep secrets and unnecessary private content outside graph metadata.

## Verification expectations

Focused verification must cover:

- a complete twelve-stage chain;
- missing review;
- pre-step CI without fabricated verification;
- candidate root cause;
- correction without verification;
- lesson without rule;
- rule without prevention;
- illegal stage transitions;
- missing endpoints and incompatible duplicate nodes;
- verified causal cycles;
- digest and schema tampering;
- guessed or cross-repository URLs;
- review-ready record and finding coverage;
- deterministic rendering and marker round-trip.

Complete verification still requires the repository's exact install, formatting, lint, type-check, complete test, build, and governance pipeline at the final head.
