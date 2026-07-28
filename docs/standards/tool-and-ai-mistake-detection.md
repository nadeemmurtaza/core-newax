# Tool and AI Mistake Detection

## Status

Mandatory for evidence-backed AI and engineering-tool quality records.

## Purpose

NEWAX records attributable AI and tool mistakes so repeated failures can be prevented, corrected and analyzed without treating every bug in AI-assisted work as an AI failure.

## Mistake classes

The controlled vocabulary is:

1. `ai-hallucination`
2. `wrong-framework-api`
3. `wrong-documentation-version`
4. `deprecated-package`
5. `unsafe-suggestion`
6. `copy-paste-bug`
7. `generated-dead-code`

## Attribution boundary

A high-confidence finding requires an `ai-output` record containing:

- a stable output ID;
- occurrence time;
- provider or tool identity;
- output SHA-256 hash;
- affected artifact references; and
- model, tool and version metadata when known.

Commit authorship, prose style, filenames and commit messages do not prove that AI or a tool produced an output.

## Evidence rules

### AI hallucination

Require a generated claim or symbol plus verified authoritative contradiction that was effective when the output was produced, or an explicit confirmed correction.

### Wrong framework API

Require the repository-pinned framework version and verified compiler, type-check, runtime or API-contract evidence for that exact version.

### Wrong documentation version

Require the documentation version used, the repository-pinned version and verified material impact. A harmless version difference is not a finding.

### Deprecated package

Require verified package metadata or approved package policy effective when the package was selected. Later deprecation is not applied retroactively.

### Unsafe suggestion

Require an applicable policy ID plus verified security review, safety review or execution consequence. Keyword matching and discomfort are not proof.

### Copy-paste bug

Require copied-source provenance and verified stale-context evidence, such as the wrong identifier, module, tenant, permission, version or behavior.

### Generated dead code

Require generated-code attribution and verified static-analysis, reachability, usage or review evidence.

## Finding states

The detector preserves:

- `detected`
- `suspected`
- `resolved`
- `waived`
- `clear`
- `insufficient-evidence`

Only unresolved, unwaived, high-confidence detected findings with attributable output may block governance.

## Lifecycle

Corrections, resolutions, regression tests and waivers update the occurrence. They do not erase it. Waivers require a reviewer and a meaningful reason.

## AI quality dataset

Dataset schema version 1 stores bounded classifications, output metadata, hashes, artifact references, evidence IDs and kinds, corrections, regression evidence and lifecycle state.

The initial dataset must not contain:

- raw prompts;
- raw model or tool responses;
- generated code excerpts;
- secrets, credentials or tokens;
- customer data; or
- private repository content.

Repository identity is hashed. Optional sanitized snippets require a separately approved policy and are outside this standard.

## Governance

Review-ready pull requests that contain structured AI or tool output evidence require at least one linked AI quality issue. Pull requests without AI or tool output evidence are not required to fabricate a record.

Trusted governance evaluates structured issue, comment and review records. Pull-request prose cannot override the evidence history.
