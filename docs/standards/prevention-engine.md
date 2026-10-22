# Prevention Engine

## Purpose

A resolved engineering mistake must change the operating system of the repository. A lesson that remains only in prose is incomplete.

The Prevention Engine converts confirmed, verified resolutions into deterministic prevention control packs and verifies those packs against the exact pull-request head.

## Resolution eligibility

A learning occurrence qualifies only when all of the following exist:

- a stable root-cause ID;
- a confirmed or machine-supported root-cause decision;
- a resolved or verified resolution state;
- an exact forty-character fix commit;
- a reviewer identity and review timestamp;
- a resolution timestamp;
- successful verification evidence;
- regression evidence; and
- a specific prevention control.

Closing an issue does not prove resolution. Missing evidence produces `insufficient-evidence` and no authoritative pack.

## One pack per root cause

The stable pack identity is the root-cause ID. Every recurrence updates the same pack instead of creating a competing control set.

A pack records:

- schema version;
- root-cause and ledger identity;
- category;
- unsuccessful and successful methods;
- prevention control;
- ordered occurrence history;
- revision; and
- content digest.

Repeated processing of the same evidence must be idempotent. Retrieval order must not change the resulting pack.

## Seven required controls

Every valid pack contains exactly these control types:

1. CI check.
2. Pull-request checklist.
3. Review checklist.
4. Coding standard.
5. Verification rule.
6. Static-analysis rule.
7. Test template.

The renderer writes the controls to stable paths under `.newax/prevention/`.

## Generated paths

For root cause `<root-cause-id>`:

- `.newax/prevention/ci/<root-cause-id>.json`
- `.newax/prevention/pr-checklists/<root-cause-id>.md`
- `.newax/prevention/review-checklists/<root-cause-id>.md`
- `.newax/prevention/coding-standards/<root-cause-id>.md`
- `.newax/prevention/verification-rules/<root-cause-id>.json`
- `.newax/prevention/static-analysis/<root-cause-id>.json`
- `.newax/prevention/test-templates/<root-cause-id>.md`

Generation uses a temporary directory before destination replacement so a partial generation cannot appear complete.

## Declarative execution boundary

CI and static-analysis controls are declarative records. Definitions must not contain arbitrary executable fields, including nested `command`, `script`, `shell`, `exec`, `run`, `code`, or `source` keys.

The Prevention Engine does not write arbitrary workflow or linter code from lesson prose.

## Candidate and enforced states

CI and static-analysis controls begin as `candidate` unless the structured record contains:

- an accountable owner;
- a reviewer;
- an implementation reference; and
- successful verification references.

Only then may the control become `enforced`.

Checklist, standard, verification-rule, and test-template controls are generated artifacts and remain attributable to their source occurrences.

## Protection of enforced controls

An enforced control retains its definition, owner, reviewer, and implementation reference during recurrences.

It may be replaced, downgraded, or redirected only when a supersession record contains:

- an approver;
- a meaningful reason; and
- an effective timestamp.

Additional verification evidence may be appended without weakening the existing control.

## Structured evidence

Prevention records may use the Engineering Prevention Record issue form or a `newax-prevention-event` block.

The record may also provide bounded CI and static-analysis ownership, implementation, and verification references. Ordinary prose is not machine evidence.

Open or unresolved learning issues do not generate prevention packs.

## Governance

Pull-request governance:

1. collects linked resolved learning records;
2. reads an existing base pack when one exists;
3. applies structured control ownership evidence;
4. generates the expected revision;
5. renders exactly seven expected files; and
6. compares each file with the exact pull-request head.

Missing or stale prevention files fail governance. GitHub Actions verifies controls but never commits them back to the branch.

## Prohibited shortcuts

The following are prohibited:

- treating issue closure as verified resolution;
- creating fewer than seven controls;
- creating duplicate packs for one root cause;
- inferring executable rules from prose;
- placing arbitrary executable code inside declarative definitions;
- changing enforced definitions without supersession approval;
- allowing CI to write the files it reviews;
- hiding missing evidence behind a checklist statement; and
- claiming prevention complete before exact-head repository verification succeeds.

## Verification

The minimum focused suite must prove eligibility boundaries, seven-control completeness, deterministic rendering, idempotence, recurrence updates, nested executable rejection, enforced-control protection, issue-form parsing, ownership propagation, missing and stale file detection, and exact-file acceptance.

Repository-wide formatting, lint, type-check, complete tests, build, and trusted governance remain separately required before the module is complete.
