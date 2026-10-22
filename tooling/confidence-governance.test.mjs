import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderConfidenceInputRecord,
  renderConfidenceScoreRecord,
  collectConfidenceRecords,
} from './confidence-record.mjs';
import { confidenceGovernanceErrors } from './verify-pr-confidence.mjs';

const input = { evidenceRecords: [{ id: 'E-1', type: 'log', status: 'verified' }] };

function pairs() {
  return collectConfidenceRecords(
    {
      body: renderConfidenceInputRecord({
        findingId: 'F-1',
        sourceType: 'test',
        sourceRef: 'issue:10',
        input,
      }),
    },
    [{ body: renderConfidenceScoreRecord({ findingId: 'F-1', input }) }],
  );
}

test('draft with no linked findings does not require a confidence record', () => {
  assert.deepEqual(confidenceGovernanceErrors({ pullRequest: { draft: true, body: '' } }), []);
});

test('review-ready pull request with a learning issue requires confidence records', () => {
  const errors = confidenceGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10`\n- Confidence records: `not-required`',
    },
  });
  assert.match(errors.join('\n'), /requires at least one confidence record/);
});

test('valid recalculable confidence records pass governance', () => {
  const errors = confidenceGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10`\n- Confidence records: `#20`',
    },
    recordPairs: pairs(),
  });
  assert.deepEqual(errors, []);
});

test('manual percentages in the pull request are rejected', () => {
  const errors = confidenceGovernanceErrors({
    pullRequest: { draft: true, body: '- Root Cause Confidence: 99%' },
  });
  assert.match(errors.join('\n'), /non-authoritative/);
});

test('stale or altered score records fail governance', () => {
  const [pair] = pairs();
  pair.scoreRecord.envelope.policyVersion = 'CONFIDENCE-0.0.0';
  const errors = confidenceGovernanceErrors({
    pullRequest: { draft: true, body: '' },
    recordPairs: [pair],
  });
  assert.match(errors.join('\n'), /policy version/);
});

test('every linked finding issue requires source coverage', () => {
  const errors = confidenceGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10, #11`\n- Confidence records: `#20`',
    },
    recordPairs: pairs(),
  });
  assert.match(errors.join('\n'), /issue #11 lacks/);
});

test('manual evidence-quality labels are rejected', () => {
  const errors = confidenceGovernanceErrors({
    pullRequest: { draft: true, body: '**Evidence Quality:** High' },
  });
  assert.match(errors.join('\n'), /non-authoritative/);
});
