# EL-0022: Nearest and Root Ancestors Were Collapsed

## Category

Unit and integration tests.

## Symptom

The Error Relationship Graph correctly returned the CI-failure impact as the nearest common ancestor and the dependency cause as the canonical common root, but the ledger integration test expected the canonical root in both fields.

## Root cause

The test treated “nearest shared predecessor” and “original shared root cause” as interchangeable concepts even though they represent different levels of the causal graph.

## Unsuccessful method

Use one expected ancestor value for both nearest-common-ancestor and common-root-ancestor assertions.

## Successful method

Construct a multi-level causal chain and assert the two outputs independently:

- the nearest common ancestor is the lowest verified shared predecessor;
- the common root ancestor is the earliest verified cause shared by all selected nodes.

## Resolution

The test now expects the CI-failure impact node as the nearest common ancestor while retaining the lockfile root-cause node as the canonical common root. Exact-head CI then verifies the complete suite and production build.

## Prevention control

Every multi-level relationship-graph test must assert nearest and canonical-root ancestry separately. A test may use the same expected value only when the graph structure proves those two levels are genuinely identical.

## Evidence

- Pull request: `#193`
- Initial failed test run: `29532290723`
- Corrected test commit: `64c440ec36dd254834a424a88b74166ee3c1392a`
- Successful verification: pending final exact-head run after this ledger and catalog update
