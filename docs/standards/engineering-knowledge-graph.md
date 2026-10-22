# Engineering Knowledge Graph

Status: mandatory Engineering Intelligence standard  
Schema version: `1`

## Purpose

The Engineering Knowledge Graph provides one evidence-linked history for an engineering failure:

Requirement → Commit → Pull Request → Review → CI → Bug → Root Cause → Fix → Verification → Lesson → Rule → Future Prevention.

The graph is a provenance and lifecycle record. It does not infer causality from wording, timing, authorship, category, or shared pull-request context.

## One-click history

“One click” means the pull request and related engineering-learning issue contain one link labelled `Complete engineering history`. The link opens one canonical GitHub knowledge-record issue.

That issue contains:

- the ordered twelve-stage history table;
- durable links to GitHub artifacts;
- a Mermaid overview;
- missing stages and missing verified edges;
- additional connected branches;
- candidate links;
- a machine-readable graph marker and digest.

The canonical issue is the history view. An external graph database, dashboard, or new product service is not required by schema version 1.

## Canonical node types

Schema version 1 supports exactly:

1. `requirement`
2. `commit`
3. `pull-request`
4. `review`
5. `ci-run`
6. `bug`
7. `root-cause`
8. `fix`
9. `verification`
10. `lesson`
11. `rule`
12. `prevention`

A commit and a fix may reference the same SHA while remaining distinct nodes because they represent different roles in the engineering history.

## Canonical relationships

- requirement `implemented-by` commit
- commit `included-in` pull-request
- pull-request `reviewed-by` review
- pull-request or commit `validated-by` ci-run
- ci-run or review `revealed` bug
- bug `classified-as` root-cause
- bug or root-cause `resolved-by` fix
- fix `verified-by` verification
- verification or root-cause `captured-as` lesson
- lesson `materialized-as` rule
- rule `enforced-by` prevention

Reference relationships may use:

- `references`
- `supersedes`
- `blocks`
- `relates-to`

Reference relationships may add context but cannot satisfy a missing canonical stage.

## Node evidence contract

Every node includes:

- stable ID;
- canonical kind;
- human-readable label;
- observed status;
- occurrence timestamp when known;
- durable HTTPS URL or bounded source reference;
- evidence references;
- bounded metadata.

Schema version 1 accepts GitHub artifact URLs belonging to the repository and durable source-reference prefixes such as `catalog:`, `ledger:`, `commit:`, `workflow:`, and `verification:`.

A URL must never be guessed. When an exact repository path is not known, use a durable source reference rather than manufacturing a convenient 404.

## Edge evidence contract

Every edge includes:

- stable ID;
- source node;
- target node;
- relationship type;
- `candidate` or `verified` status;
- evidence references;
- creation provenance;
- occurrence timestamp when known.

A verified edge requires an exact GitHub relationship, structured marker, canonical PR field, or explicit durable reference. Similar text, proximity in time, the same author, or the same PR is not enough.

## Candidate links

Candidate links remain visible because uncertainty is part of the history. They do not satisfy a complete-history claim.

Examples:

- an open issue names a possible root cause;
- a fix commit is recorded but resolution remains unverified;
- a verification statement lacks exact workflow, job, and step evidence;
- a lesson exists but the prevention pack has not reached the exact head.

## Completeness

A history is `complete` only when one verified path contains all twelve stages in canonical order.

An incomplete history remains useful. It must display:

- every missing stage;
- missing verified relationships between present stages;
- candidate links;
- additional branches.

The absence of review, CI, root cause, verification, lesson, rule, or prevention must never be filled with an invented node.

## CI and verification boundary

A workflow run linked to the exact PR head is a valid `ci-run` node even when it stops before checkout or exposes no steps.

It is not a `verification` node unless an explicit verification record supplies the required evidence. A failed or pre-step run therefore remains part of history without being misrepresented as proof that source behavior was tested.

## Causal authority

The Error Relationship Graph remains authoritative for causal relationships among root causes, occurrences, and downstream effects.

The Engineering Knowledge Graph may reference those root-cause and occurrence decisions. It must not:

- upgrade candidate causal evidence;
- replace root-cause classification;
- infer a causal edge from chronology;
- reinterpret confidence, explanation, prevention, or detector state.

## Structured markers

### Explicit link

```text
<!-- newax-knowledge-link
from: requirement:123:REQ-1
to: commit:<sha>
type: implemented-by
status: verified
provenance: approved requirement-to-commit record
evidence-refs: issue:123,commit:<sha>
-->
```

### Graph input

`newax-knowledge-graph-input` stores recalculable nodes, edges, focus node, and bounded source metadata.

### Rendered graph

`newax-engineering-knowledge-graph` stores:

- schema version;
- graph digest;
- focus node;
- recalculated history status;
- base64url-encoded normalized graph.

Authors do not supply the digest or completeness status manually.

## Collection boundary

The GitHub collector may automatically verify:

- commit membership in a PR;
- reviews attached to a PR;
- workflow runs associated with the exact head SHA;
- exact commit-to-run head-SHA relationships;
- structured workflow-run links to an occurrence;
- structured root-cause, fix, verification, ledger, rule, and prevention records.

Requirement-to-commit links require an explicit structured marker. Commit-message wording is not accepted as requirement traceability.

## Governance

Review-ready pull requests with linked finding issues require at least one knowledge-record issue.

Governance rejects:

- missing graph records;
- invalid input JSON;
- unsupported schema versions;
- altered graph digests;
- rendered graphs that do not match recalculated input;
- manual complete claims that still contain gaps;
- illegal transitions or cycles;
- unsupported source references;
- URLs outside the repository or unsupported GitHub artifact paths;
- linked finding issues not represented by bug nodes.

Draft pull requests may carry incomplete graphs. Their gaps must remain visible.

## Determinism and privacy

Equivalent normalized inputs produce byte-equivalent graphs and digests.

Graph metadata is bounded by length, depth, array size, and key count. Records must exclude secrets, credentials, raw private prompts, and unnecessary private content.

## Lifecycle preservation

Knowledge Graph enriches existing Engineering Intelligence output. It does not change:

- planning or communication findings;
- AI and tool-quality findings;
- root-cause decisions;
- confidence scoring;
- explanation verification;
- Prevention Engine status;
- detector blockers, waivers, or resolutions;
- dataset or command exit behavior.
