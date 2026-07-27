# Communication Mistake Detection

## Status

Mandatory engineering operating standard.

## Purpose

NEWAX records communication evidence and evaluates it against dependent engineering work. The system detects evidence-backed communication failures while preserving uncertainty.

## Mistake classes

The system evaluates:

- `requirement-misunderstood`
- `assumption-not-confirmed`
- `ambiguous-specification`
- `decision-undocumented`
- `wrong-interpretation`
- `conflicting-instructions`
- `missing-approval`

## Structured evidence requirement

Automatic findings require structured communication events. Ordinary prose may support human review but cannot independently prove misunderstanding, conflict, approval, or intent.

Each event records:

- stable communication ID;
- event type and topic;
- authority and lifecycle status;
- effective time when known;
- value or interpretation when applicable;
- repository scope or dependent work;
- references, conflicts, supersession, or resolution links when applicable.

Missing timestamps cannot prove a before-or-after violation.

## Authority

Authority is recorded as `observer`, `implementer`, `reviewer`, `architect`, `approver`, or `owner`.

Authority establishes whether a statement may govern dependent work. It does not replace evidence, applicability, timing, or supersession.

## Detection rules

### Requirement misunderstood

Requires an active authoritative requirement before dependent work and a materially different implemented interpretation. A later requirement change is not retroactive evidence.

### Assumption not confirmed

Requires an explicit assumption, an explicit confirmation requirement, and dependent work beginning before authorized confirmation.

### Ambiguous specification

Requires an unresolved question or multiple materially different active interpretations. Before implementation it is suspected. With proven dependent work it may become detected.

### Decision undocumented

Requires an explicit decision requirement and dependent work beginning before a canonical confirmed decision record.

### Wrong interpretation

Requires an implementation interpretation that conflicts with an active authoritative instruction, decision, clarification, or correction that applied before dependent work.

### Conflicting instructions

Requires two active authoritative requirements or instructions for the same topic with different values or an explicit conflict link. Explicit supersession removes the earlier instruction from the active set.

### Missing approval

Requires an explicit approval requirement, dependent work, and no applicable approval before that work.

## Outcomes

- `detected`: evidence proves the rule.
- `suspected`: clarification or timing evidence is incomplete.
- `resolved`: the occurrence remains recorded and an explicit resolution closes it.
- `waived`: an authorized reviewer accepts the risk with a reason.
- `clear`: no unresolved finding or evidence gap exists.
- `insufficient-evidence`: the system cannot safely decide.

Only high-confidence, unwaived, unresolved `detected` findings block governance.

## Resolutions and waivers

A resolution references the finding, its source events, or the exact finding type and topic.

A waiver identifies the finding type, topic when applicable, reviewer, and substantive reason. Waivers do not erase occurrences.

## GitHub sources

The collector evaluates structured events from linked communication issues, issue comments, pull-request descriptions, pull-request comments, inline review comments, review submissions, and commit history.

## Pull-request governance

Review-ready pull requests require:

- at least one linked communication issue;
- structured communication evidence;
- no high-confidence unresolved communication blocker.

Draft pull requests may retain suspected findings and evidence notices.

## Limits

The detector does not infer authority from unstated context, treat recency as supersession, judge whether a business decision was wise, or convert unstructured prose into an automatic finding.
