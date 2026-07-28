import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeErrorRelationshipGraph,
  buildErrorRelationshipGraph,
  causeNodeIdForRootCause,
  findCommonErrorRootAncestors,
  findLowestCommonErrorAncestors,
  impactNodeIdForEvent,
  occurrenceNodeIdForEvent,
} from './error-relationship-graph.mjs';

function event(overrides = {}) {
  return {
    fingerprint: 'event-one',
    sourceType: 'package-manager',
    sourceId: 'source-one',
    repository: 'Newax-Technologies/core-newax',
    prNumber: 101,
    commitSha: 'a'.repeat(40),
    workflowRunId: null,
    workflowName: 'Dependency check',
    stepName: 'Install dependencies',
    category: 'dependency-installation-lockfile',
    symptom: 'Dependency installation failed.',
    rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
    rootCauseCandidate: 'Package manifests and lockfile are inconsistent.',
    rootCauseDeterministic: true,
    rootCauseAssessment: {
      observedFacts: ['Step: Install dependencies'],
      evidenceFor: ['Observed ERR_PNPM_OUTDATED_LOCKFILE'],
    },
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    status: 'machine-supported',
    relationshipHints: [],
    impacts: [],
    ...overrides,
  };
}

test('builds a cause, occurrence, CI failure, and deployment-blocked chain', () => {
  const peer = event({
    fingerprint: 'peer-event',
    sourceType: 'ci-workflow',
    sourceId: 'run-1:job-1:step-1',
    workflowRunId: 42,
    workflowName: 'Continuous Integration',
    rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE',
    rootCauseCandidate: 'Peer dependency graph is incompatible.',
    matchedSignatures: ['ERR_PNPM_PEER_DEP_ISSUES'],
    relationshipHints: [
      {
        parentRootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
        type: 'contributes-to',
        status: 'confirmed',
        evidence: ['Dependency review confirmed the lockfile mismatch upstream.'],
      },
    ],
    impacts: [
      {
        id: 'deployment-blocked',
        kind: 'deployment-blocked',
        label: 'Deployment blocked',
        parentImpactId: 'ci-failure-42',
        type: 'blocks',
        status: 'confirmed',
        evidence: ['Release policy blocks deployment after failed CI.'],
      },
    ],
  });
  const graph = buildErrorRelationshipGraph([event(), peer]);
  const deploymentId = impactNodeIdForEvent(peer, 'deployment-blocked');
  const analysis = analyzeErrorRelationshipGraph(graph, [deploymentId]);

  assert.ok(
    graph.nodes.some(
      (node) => node.id === causeNodeIdForRootCause('ROOT-DEPENDENCY-LOCKFILE-OUTDATED'),
    ),
  );
  assert.deepEqual(analysis.commonRootAncestorIds, [
    causeNodeIdForRootCause('ROOT-DEPENDENCY-LOCKFILE-OUTDATED'),
  ]);
});

test('identifies one root cause across dozens of downstream failures', () => {
  const impacts = Array.from({ length: 30 }, (_, index) => ({
    id: `blocked-${index}`,
    kind: 'blocked-check',
    label: `Blocked check ${index}`,
    status: 'machine-supported',
    evidence: [`Check ${index} was blocked by dependency installation.`],
  }));
  const source = event({ impacts });
  const graph = buildErrorRelationshipGraph([source]);
  const focus = impacts.map((impact) => impactNodeIdForEvent(source, impact.id));

  assert.deepEqual(findCommonErrorRootAncestors(graph, focus), [
    causeNodeIdForRootCause(source.rootCauseId),
  ]);
});

test('reports the nearest common ancestor separately from the canonical root', () => {
  const source = event({
    impacts: [
      {
        id: 'ci-failure',
        kind: 'workflow-failure',
        label: 'CI failure',
        status: 'machine-supported',
      },
      {
        id: 'deployment-one',
        parentImpactId: 'ci-failure',
        kind: 'deployment-blocked',
        label: 'Deployment one blocked',
        status: 'confirmed',
      },
      {
        id: 'deployment-two',
        parentImpactId: 'ci-failure',
        kind: 'deployment-blocked',
        label: 'Deployment two blocked',
        status: 'confirmed',
      },
    ],
  });
  const graph = buildErrorRelationshipGraph([source]);
  const first = impactNodeIdForEvent(source, 'deployment-one');
  const second = impactNodeIdForEvent(source, 'deployment-two');

  assert.deepEqual(findLowestCommonErrorAncestors(graph, [first, second]), [
    impactNodeIdForEvent(source, 'ci-failure'),
  ]);
  assert.deepEqual(findCommonErrorRootAncestors(graph, [first, second]), [
    causeNodeIdForRootCause(source.rootCauseId),
  ]);
});

test('does not use candidate edges as verified causality', () => {
  const child = event({
    fingerprint: 'child',
    rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE',
    relationshipHints: [
      {
        parentRootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
        type: 'causes',
        status: 'candidate',
      },
    ],
  });
  const graph = buildErrorRelationshipGraph([event(), child]);
  const childId = occurrenceNodeIdForEvent(child);

  assert.deepEqual(
    findCommonErrorRootAncestors(graph, [occurrenceNodeIdForEvent(event()), childId]),
    [],
  );
});

test('rejects causal cycles with the exact cycle path', () => {
  const first = event({
    fingerprint: 'first',
    relationshipHints: [{ parentFingerprint: 'second', type: 'causes', status: 'confirmed' }],
  });
  const second = event({
    fingerprint: 'second',
    relationshipHints: [{ parentFingerprint: 'first', type: 'causes', status: 'confirmed' }],
  });

  assert.throws(() => buildErrorRelationshipGraph([first, second]), /causal cycle/);
});

test('rejects an impact whose parent impact does not exist', () => {
  assert.throws(
    () =>
      buildErrorRelationshipGraph([
        event({
          impacts: [
            {
              id: 'deployment-blocked',
              parentImpactId: 'missing-ci',
              kind: 'deployment-blocked',
              label: 'Deployment blocked',
            },
          ],
        }),
      ]),
    /missing parent node/,
  );
});

test('correlation edges do not create common causal ancestors', () => {
  const first = event({ fingerprint: 'first', rootCauseId: 'ROOT-ONE' });
  const second = event({ fingerprint: 'second', rootCauseId: 'ROOT-TWO' });
  const graph = buildErrorRelationshipGraph([first, second], {
    explicitEdges: [
      {
        from: occurrenceNodeIdForEvent(first),
        to: occurrenceNodeIdForEvent(second),
        type: 'correlates-with',
        status: 'confirmed',
      },
    ],
  });

  assert.deepEqual(
    findCommonErrorRootAncestors(graph, [
      occurrenceNodeIdForEvent(first),
      occurrenceNodeIdForEvent(second),
    ]),
    [],
  );
});
