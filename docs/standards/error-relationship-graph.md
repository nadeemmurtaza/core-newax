# NEWAX Error Relationship Graph

## Status

Mandatory Engineering Intelligence control.

## Purpose

The Error Relationship Graph connects individual engineering failures into an evidence-backed causal structure. It prevents one upstream defect from being investigated repeatedly as dozens of unrelated downstream failures.

A typical chain may look like:

```text
Lockfile mismatch
  └─ contributes to peer-dependency resolution failure
       └─ causes CI failure
            └─ blocks deployment
```

The graph does not treat timing, shared wording, or proximity as proof of causality. Those signals may create a candidate relationship, but they cannot become a verified ancestor without deterministic machine evidence or reviewer confirmation.

## Graph model

The graph is a directed acyclic graph containing three primary node classes.

### Root-cause nodes

A canonical root-cause ID from the Engineering Learning Catalog.

Example:

```text
cause:ROOT-DEPENDENCY-LOCKFILE-OUTDATED
```

### Occurrence nodes

One captured engineering event identified by its fingerprint.

Example:

```text
occurrence:3c4f...
```

### Impact nodes

An observable consequence such as:

- CI failure.
- Test stage blocked.
- Build blocked.
- Deployment blocked.
- Release delayed.
- Runtime outage.

Impact nodes remain distinct so their evidence is never erased merely because they share an ancestor.

## Edge types

### `causes`

The parent is a direct causal predecessor.

### `contributes-to`

The parent materially contributed but may not be sufficient by itself.

### `blocks`

The parent prevented a downstream operation from proceeding.

### `correlates-with`

The occurrences are associated, but causality is not established. Correlation edges are excluded from ancestor calculations.

## Relationship status

Every edge is one of:

- `candidate`
- `machine-supported`
- `confirmed`

Candidate edges are visible but excluded from verified root and common-ancestor decisions.

Machine-supported edges require deterministic source evidence.

Confirmed edges require reviewer confirmation and resolution evidence.

## Automatic graph construction

Every submitted engineering event automatically produces:

1. A root-cause node.
2. An occurrence node.
3. A root-cause-to-occurrence edge.
4. A CI failure impact when the event comes from a failed CI workflow.
5. Any explicitly supplied operational impacts.
6. Any explicitly supplied upstream relationship hints.

Existing issue metadata is loaded before the new or repeated occurrence is written. The graph engine then identifies:

- Direct verified parents.
- Verified root ancestors.
- The nearest shared ancestor.
- The canonical shared root ancestor.
- Related ledger issues sharing that verified root.
- Verified causal paths from root to downstream impact.

The result is written back into the engineering-learning issue automatically.

## Common ancestor rules

The ledger reports two different concepts because humans have spent centuries confusing “nearest” with “original.”

### Lowest common ancestor

The nearest shared verified predecessor of the selected nodes.

For two deployments blocked by the same failed CI run, the lowest common ancestor may be the CI failure node.

### Common root ancestor

The earliest verified cause shared by all selected nodes.

For the same example, the common root ancestor may be the lockfile mismatch.

The ledger uses the verified common root ancestor as the primary consolidation key while retaining the nearest shared ancestor for investigation sequencing.

## Explicit relationship input

External failure intake may provide bounded relationship hints:

```json
{
  "relationshipHints": [
    {
      "parentRootCauseId": "ROOT-DEPENDENCY-LOCKFILE-OUTDATED",
      "type": "contributes-to",
      "status": "confirmed",
      "evidence": ["Dependency review confirmed the upstream mismatch."]
    }
  ]
}
```

Exactly one parent reference is permitted per hint:

- `parentNodeId`
- `parentFingerprint`
- `parentRootCauseId`

Operational impacts may be chained:

```json
{
  "impacts": [
    {
      "id": "ci-failure",
      "kind": "workflow-failure",
      "label": "CI failure",
      "status": "machine-supported"
    },
    {
      "id": "deployment-blocked",
      "kind": "deployment-blocked",
      "label": "Deployment blocked",
      "parentImpactId": "ci-failure",
      "type": "blocks",
      "status": "confirmed"
    }
  ]
}
```

## Cycle prevention

Causal edges must form a directed acyclic graph.

Any cycle fails graph construction and reports the exact path, for example:

```text
A -> B -> C -> A
```

Correlation edges are non-causal and do not participate in cycle or ancestor calculations.

## Ledger persistence

Each engineering-learning issue receives a durable graph section containing:

- Current graph node ID.
- Verified root ancestors.
- Primary common ancestor.
- Related issue numbers.
- Encoded relationship hints.
- Encoded impacts.
- Human-readable causal chains.

The encoded fields allow future occurrences to reconstruct the graph without trusting issue prose.

## Command

Analyze an event collection:

```bash
pnpm learning:graph --file events.json
```

Select specific nodes:

```bash
pnpm learning:graph --file events.json --focus occurrence:a,occurrence:b
```

Include candidate edges for exploratory analysis:

```bash
pnpm learning:graph --file events.json --include-candidates
```

Candidate-inclusive output must never be presented as verified causality.

## Compatibility

Schema-version-1 and schema-version-2 queued events are upgraded to schema version 3 at submission.

Legacy events retain their historical root-cause assessment while receiving empty relationship and impact collections unless later evidence supplies them.

## Limits

The graph cannot infer a relationship that no connected source records and no deterministic rule supports.

It must not infer causality from:

- Timestamp order alone.
- Shared category alone.
- Similar text alone.
- The same pull request alone.
- The same commit alone.
- The fact that one stage appears earlier in a pipeline.

Those facts can guide investigation. They cannot convict an ancestor.
