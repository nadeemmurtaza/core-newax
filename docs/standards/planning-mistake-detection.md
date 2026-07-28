# NEWAX Planning Mistake Detection

## Status

Mandatory Engineering Intelligence control.

## Purpose

Planning mistakes must be detected from evidence preserved in commit history, issue history, and task sequencing. A plausible accusation is not a finding. Missing planning metadata is reported as insufficient evidence rather than converted into certainty.

## Decisions

The detector returns one overall state:

- `clear`: no finding or material evidence gap exists;
- `detected`: at least one unwaived high-confidence planning mistake exists;
- `review-required`: one or more suspected findings require human review;
- `insufficient-evidence`: the available history cannot support a required decision.

Each finding remains separate and records:

- stable finding ID;
- mistake type;
- state;
- confidence;
- severity;
- affected tasks or requirements;
- supporting evidence;
- missing evidence;
- recommendation;
- any explicit waiver.

## Evidence sources

The detector consumes bounded evidence from:

1. Pull-request commit history, including commit order, timestamp, message, and changed files.
2. Linked planning issues, including declared requirements, scope, estimates, and ordered tasks.
3. Planning events recorded in issue comments, including task completion, architecture approval, estimate revision, scope approval, requirement satisfaction, and finding waiver.
4. Pull-request review state. Draft work may remain suspected; review-ready work must provide complete planning evidence.

## Required pull-request field

Every governed pull request links its planning record:

```text
- Planning issues: #123
```

A review-ready pull request must provide at least one planning issue, a declared task sequence, and declared scope paths.

## Task sequence format

Each task uses one line:

```text
- TASK-1 | order=1 | depends=none | estimate=60 | scope=tooling/example.mjs,docs/example.md | architecture-review=yes | migration=no | dependency=no | requirements=REQ-1,REQ-2
```

Fields:

- `order`: intended sequence position;
- `depends`: prerequisite task IDs or `none`;
- `estimate`: expected elapsed minutes;
- `scope`: repository path prefixes or `*` and `**` patterns;
- `architecture-review`: whether approval is required before implementation;
- `migration`: whether migration evidence is mandatory;
- `dependency`: whether manifest and lockfile evidence are mandatory;
- `requirements`: requirement IDs delivered by the task.

## Requirement format

Planning issues record testable requirements:

```text
- [ ] REQ-1 Add the migration paths=apps/api/prisma/migrations/**
```

A checked requirement is satisfied by the issue record. An unchecked requirement requires a matching path or a `requirement-satisfied` event before review.

## Planning event format

Planning events are stored in issue comments:

```text
<!-- newax-planning-event
event: task-completed
task-id: TASK-1
status: completed
-->
```

Supported events:

- `task-started`
- `task-completed`
- `architecture-reviewed`
- `estimate-revised`
- `scope-approved`
- `requirement-satisfied`
- `finding-waived`

The GitHub comment creation time is used when the event does not supply an explicit timestamp.

## Detection rules

### Forgotten migration

A finding is detected when migration evidence is explicitly required and:

- the task is complete or review-ready but no migration file exists;
- the migration was added after task completion; or
- a later commit explicitly identifies itself as correcting a missing migration.

Schema changes appearing before a migration in an unfinished task are not automatically treated as a mistake.

### Forgotten dependency

A finding is detected when dependency evidence is explicitly required and:

- the task is complete or review-ready but the manifest or lockfile is absent;
- dependency metadata was completed after task completion; or
- a later commit explicitly identifies itself as correcting missing dependency metadata.

The detector does not infer that every new import is an external dependency because the package may already exist in the base branch.

### Wrong implementation order

A finding is detected when the first implementation commit for a task occurs before a declared prerequisite task is complete. Unknown task dependencies are reported as insufficient evidence.

### Ignored requirement

A review-ready or fully completed plan fails when a required item has no checked state, requirement-satisfaction event, or required-path evidence. An unfinished draft receives a suspected finding rather than a proven failure.

### Skipped architecture review

A finding is detected when a task explicitly requires architecture review and implementation begins before an approved review event or architecture-decision commit.

### Wrong estimate

A finding is reported when explicit start and completion evidence shows that actual elapsed time is more than twice or less than one quarter of the current estimate, with at least sixty minutes of absolute deviation. The latest recorded estimate revision before completion is used.

This is elapsed-time evidence, not a claim about individual productivity. Pauses, external blockers, and working-hour calendars require separate evidence.

### Scope creep

A finding is detected when a changed file is outside all declared scope paths and no scope approval covering that path existed before the first change. Approval after implementation does not rewrite history.

## Waivers

A high-confidence finding may be waived only through an issue event containing:

- finding type;
- optional task ID;
- reviewer identity;
- reason of at least twelve characters;
- event timestamp.

The finding remains visible and is marked waived. A waiver removes the governance blocker; it does not erase the evidence.

## Governance

`tooling/verify-pr-planning.mjs`:

1. collects the pull-request commit history;
2. loads linked planning issues and comments;
3. reconstructs requirements, scope, tasks, and events;
4. runs the pure detector;
5. prints machine-readable findings;
6. fails when an unwaived high-confidence detected mistake exists;
7. requires complete planning evidence before a pull request is ready for review.

Draft pull requests may retain suspected findings while work is still underway. High-confidence historical mistakes remain visible immediately.

## CLI

Analyze a saved history record:

```bash
pnpm learning:planning --file planning-history.json
```

Analyze a GitHub pull request:

```bash
pnpm learning:planning --pr 123
```

Use `--report-only` to preserve a zero exit code while collecting findings for investigation.

## Limits

The detector can only evaluate evidence that exists. It does not infer business requirements, architecture approval, working time, or scope authorization from silence. Commit timestamps prove ordering, not causality. Issue prose remains untrusted unless it follows the structured planning contract or is independently supported by repository history.
