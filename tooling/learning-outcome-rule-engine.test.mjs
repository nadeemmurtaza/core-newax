import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateLearningRequirement,
  validateLearningRecord,
} from './learning-outcome-rule-engine.mjs';

const cases = [
  [
    'new rule created',
    { filename: 'docs/standards/new-control.md', status: 'added' },
    'new-rule-created',
  ],
  [
    'checklist updated',
    {
      filename: 'docs/review.md',
      status: 'modified',
      patch: '@@\n+- [ ] Verify the exact commit',
    },
    'checklist-updated',
  ],
  [
    'process changed',
    { filename: 'tooling/reconcile-pr-learning.mjs', status: 'modified' },
    'process-changed',
  ],
  [
    'template changed',
    { filename: 'docs/proposal-template.md', status: 'modified' },
    'template-changed',
  ],
  [
    'automation added',
    { filename: '.github/workflows/evidence.yml', status: 'added' },
    'automation-added',
  ],
];

for (const [name, change, reason] of cases) {
  test(`requires learning when ${name}`, () => {
    const result = evaluateLearningRequirement({ changedFiles: [change] });
    assert.equal(result.learningOutcome, 'required');
    assert.ok(result.reasons.some((item) => item.code === reason));
  });
}

test('preserves failure and learning-issue requirements independently of the diff', () => {
  const result = evaluateLearningRequirement({
    changedFiles: [{ filename: 'apps/api/src/example.ts', status: 'modified' }],
    failedWorkflowRuns: [{ id: 1 }],
    linkedLearningIssues: [{ number: 2 }],
  });
  assert.equal(result.learningOutcome, 'required');
  assert.deepEqual(result.reasons.map((reason) => reason.code).sort(), [
    'failed-workflow-run',
    'linked-learning-issue',
  ]);
});

test('allows not-required only when no rule or evidence trigger exists', () => {
  const result = evaluateLearningRequirement({
    changedFiles: [
      {
        filename: 'apps/api/src/example.ts',
        status: 'modified',
        patch: '@@\n+return value;',
      },
    ],
  });
  assert.equal(result.learningOutcome, 'not-required');
  assert.equal(result.required, false);
  assert.deepEqual(result.reasons, []);
});

test('deduplicates reasons while preserving all matched files', () => {
  const result = evaluateLearningRequirement({
    changedFiles: [
      { filename: 'docs/standards/a.md', status: 'added' },
      { filename: 'docs/standards/b.md', status: 'added' },
    ],
  });
  const rule = result.reasons.find((reason) => reason.code === 'new-rule-created');
  assert.deepEqual(rule.files, ['docs/standards/a.md', 'docs/standards/b.md']);
});

test('validates required records and infers new versus existing without an author-selected outcome', () => {
  const result = validateLearningRecord({
    requirement: { learningOutcome: 'required' },
    ledgerEntries: ['EL-0023', 'EL-0014'],
    ledgerEntriesValue: 'EL-0023, EL-0014',
    learningIssueNumbers: [224],
    learningIssuesValue: '#224',
    rootCauseStatus: 'confirmed',
    rootCauseEvidence: 'The pull-request template allowed a manual none value.',
    resolutionEvidence: 'Focused rule-engine tests passed.',
    changedFiles: [
      {
        filename:
          'docs/verification/engineering-learning-ledger/EL-0023-manual-learning-outcome.md',
        status: 'added',
      },
    ],
    catalog: { rootCauses: [{ ledgerEntry: 'EL-0014' }] },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.classifications, [
    { ledgerEntry: 'EL-0023', classification: 'new' },
    { ledgerEntry: 'EL-0014', classification: 'existing' },
  ]);
});

test('rejects not-required metadata when the rule engine requires learning', () => {
  const result = validateLearningRecord({
    requirement: { learningOutcome: 'required' },
    ledgerEntries: [],
    ledgerEntriesValue: 'not-required',
    learningIssueNumbers: [],
    learningIssuesValue: 'not-required',
    rootCauseStatus: 'not-required',
    rootCauseEvidence: 'not-required',
    resolutionEvidence: 'not-required',
    changedFiles: [],
    catalog: { rootCauses: [] },
  });
  assert.ok(result.errors.length >= 3);
});
