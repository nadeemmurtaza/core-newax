import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createErrorGraphContext,
  parseErrorGraphMetadata,
  renderErrorGraphSection,
  replaceErrorGraphSection,
} from './engineering-issue-error-graph.mjs';
import { impactNodeIdForEvent } from './error-relationship-graph.mjs';

function event(overrides = {}) {
  return {
    fingerprint: 'new-event',
    sourceType: 'ci-workflow',
    sourceId: 'run:job:step',
    repository: 'Newax-Technologies/core-newax',
    prNumber: 99,
    commitSha: 'a'.repeat(40),
    workflowRunId: 44,
    workflowName: 'Continuous Integration',
    stepName: 'Install dependencies',
    category: 'dependency-installation-lockfile',
    symptom: 'Install failed.',
    rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
    rootCauseCandidate: 'Lockfile mismatch.',
    rootCauseDeterministic: true,
    rootCauseAssessment: {
      observedFacts: ['CI failed.'],
      evidenceFor: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    },
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    status: 'machine-supported',
    relationshipHints: [],
    impacts: [
      {
        id: 'deployment-blocked',
        kind: 'deployment-blocked',
        label: 'Deployment blocked',
        parentImpactId: 'ci-failure-44',
        type: 'blocks',
        status: 'confirmed',
        evidence: ['Release policy blocked deployment.'],
      },
    ],
    ...overrides,
  };
}

function issue(number, fingerprint, rootCauseId = 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED') {
  return {
    number,
    title: `Issue ${number}`,
    body: `<!-- newax-engineering-event
fingerprint: ${fingerprint}
source-type: ci-workflow
source-id: source-${number}
pr-number: 99
commit-sha: ${'a'.repeat(40)}
workflow-run-id: ${number}
job-id: ${number}
step-name: Install dependencies
failure-category: dependency-installation-lockfile
matched-signatures: ERR_PNPM_OUTDATED_LOCKFILE
root-cause-id: ${rootCauseId}
root-cause-confidence: high
root-cause-status: machine-supported
duplicate-of: none
-->`,
  };
}

test('identifies the common ancestor across the current and existing ledger occurrence', () => {
  const current = event();
  const context = createErrorGraphContext(current, [issue(10, 'old-event')]);

  assert.equal(context.primaryCommonAncestorId, 'cause:ROOT-DEPENDENCY-LOCKFILE-OUTDATED');
  assert.deepEqual(context.relatedIssueNumbers, [10]);
  assert.deepEqual(context.lowestCommonAncestorIds, [
    impactNodeIdForEvent(current, 'ci-failure-44'),
  ]);
  assert.ok(context.rootAncestorIds.includes('cause:ROOT-DEPENDENCY-LOCKFILE-OUTDATED'));
});

test('renders durable graph metadata and verified chains', () => {
  const current = event();
  const context = createErrorGraphContext(current, [issue(10, 'old-event')]);
  const section = renderErrorGraphSection(current, context);
  const metadata = parseErrorGraphMetadata(section);

  assert.equal(metadata['graph-common-ancestor-id'], 'cause:ROOT-DEPENDENCY-LOCKFILE-OUTDATED');
  assert.match(section, /Nearest verified common ancestor/);
  assert.match(section, /Verified causal chains/);
  assert.match(section, /Deployment blocked/);
  assert.equal(
    impactNodeIdForEvent(current, 'deployment-blocked').includes('deployment-blocked'),
    true,
  );
});

test('replaces an existing graph section without duplicating it', () => {
  const first = `Body

<!-- newax-error-relationship-graph
graph-node-id: old
-->
## Error relationship graph
old
<!-- /newax-error-relationship-graph -->`;
  const second = `<!-- newax-error-relationship-graph
graph-node-id: new
-->
## Error relationship graph
new
<!-- /newax-error-relationship-graph -->`;
  const result = replaceErrorGraphSection(first, second);

  assert.equal((result.match(/## Error relationship graph/g) ?? []).length, 1);
  assert.match(result, /graph-node-id: new/);
});

test('does not claim a common ancestor for unrelated causes', () => {
  const context = createErrorGraphContext(event(), [issue(10, 'old-event', 'ROOT-OTHER')]);

  assert.equal(context.primaryCommonAncestorId, null);
  assert.deepEqual(context.relatedIssueNumbers, []);
});
