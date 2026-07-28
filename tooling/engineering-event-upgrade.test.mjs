import assert from 'node:assert/strict';
import test from 'node:test';

import { renderIssueBody } from './engineering-learning-core.mjs';
import { upgradeEngineeringEvent } from './submit-engineering-event.mjs';

function legacyEvent() {
  return {
    schemaVersion: 1,
    sourceType: 'local-command',
    sourceId: 'legacy-command-1',
    occurredAt: '2026-07-16T12:00:00.000Z',
    repository: 'Newax-Technologies/core-newax',
    prNumber: 99,
    commitSha: null,
    workflowRunId: null,
    workflowName: 'External intake: local-command',
    jobId: null,
    jobName: 'local',
    stepName: 'pnpm verify',
    category: 'local-verification',
    symptom: 'Legacy verification failed.',
    rootCauseId: 'ROOT-UNCLASSIFIED-LOCAL_VERIFICATION',
    rootCauseCandidate: 'The legacy event requires evidence-backed confirmation.',
    rootCauseConfidence: 'low',
    rootCauseDeterministic: false,
    matchedSignatures: [],
    unsuccessfulMethod: 'Retry without evidence.',
    successfulMethod: 'Inspect the first failing stage.',
    preventionControl: 'Preserve the queue and review evidence.',
    ledgerEntry: null,
    fingerprint: 'legacy-fingerprint',
    evidenceUrls: [],
    status: 'candidate',
  };
}

test('upgrades schema-one events before root-cause and graph rendering', () => {
  const upgraded = upgradeEngineeringEvent(legacyEvent());
  const body = renderIssueBody(upgraded);

  assert.equal(upgraded.schemaVersion, 3);
  assert.equal(upgraded.rootCauseAssessment.status, 'candidate');
  assert.equal(upgraded.rootCauseAssessment.selected.rootCauseId, legacyEvent().rootCauseId);
  assert.deepEqual(upgraded.relationshipHints, []);
  assert.deepEqual(upgraded.impacts, []);
  assert.match(body, /relationship graph existed/);
  assert.match(body, /ROOT-UNCLASSIFIED-LOCAL_VERIFICATION/);
});

test('upgrades schema-two events without changing their assessment', () => {
  const assessment = { status: 'candidate' };
  const upgraded = upgradeEngineeringEvent({
    ...legacyEvent(),
    schemaVersion: 2,
    rootCauseAssessment: assessment,
  });

  assert.equal(upgraded.schemaVersion, 3);
  assert.equal(upgraded.rootCauseAssessment, assessment);
  assert.deepEqual(upgraded.relationshipHints, []);
  assert.deepEqual(upgraded.impacts, []);
});

test('normalizes current relationship hints and impacts', () => {
  const upgraded = upgradeEngineeringEvent({
    ...legacyEvent(),
    schemaVersion: 3,
    rootCauseAssessment: { status: 'candidate' },
    relationshipHints: [
      {
        parentRootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
        type: 'contributes-to',
        status: 'confirmed',
      },
    ],
    impacts: [
      {
        id: 'deployment-blocked',
        kind: 'deployment-blocked',
        label: 'Deployment blocked',
      },
    ],
  });

  assert.equal(upgraded.relationshipHints[0].referenceType, 'parentRootCauseId');
  assert.equal(upgraded.impacts[0].id, 'deployment-blocked');
});
