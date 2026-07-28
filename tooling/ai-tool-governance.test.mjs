import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeAiToolHistory } from './analyze-ai-tool-mistakes.mjs';
import { evaluateAiToolGovernance } from './verify-pr-ai-quality.mjs';

const hash = (character) => character.repeat(64);

function output(extra = {}) {
  return {
    id: 'OUT-EVENT',
    type: 'ai-output',
    outputId: 'OUT-1',
    sourceKind: 'ai',
    provider: 'example-provider',
    model: 'example-model',
    at: '2026-07-17T10:00:00Z',
    outputHash: hash('a'),
    artifactRefs: ['tooling/example.mjs'],
    ...extra,
  };
}

function deprecatedPackage() {
  return {
    id: 'PACKAGE-EVIDENCE-1',
    type: 'package-metadata',
    outputId: 'OUT-1',
    status: 'deprecated',
    packageName: 'legacy-package',
    packageVersion: '1.0.0',
    effectiveAt: '2026-07-17T09:00:00Z',
    validationRef: 'registry:legacy-package-1.0.0',
  };
}

test('review-ready PR without AI evidence does not require a fabricated record', () => {
  const evaluation = evaluateAiToolGovernance({
    phase: 'review',
    aiQualityIssues: [],
    events: [],
  });
  assert.deepEqual(evaluation.errors, []);
  assert.equal(evaluation.dataset.recordCount, 0);
});

test('review-ready PR with AI output requires a linked AI quality issue', () => {
  const evaluation = evaluateAiToolGovernance({
    phase: 'review',
    aiQualityIssues: [],
    events: [output()],
  });
  assert.match(evaluation.errors[0], /requires a linked quality issue/);
});

test('linked issue without structured evidence fails review governance', () => {
  const evaluation = evaluateAiToolGovernance({
    phase: 'review',
    aiQualityIssues: [233],
    events: [],
  });
  assert.match(evaluation.errors[0], /structured output provenance record/);
});

test('high-confidence unresolved finding blocks and enters the dataset', () => {
  const evaluation = evaluateAiToolGovernance({
    phase: 'review',
    aiQualityIssues: [233],
    events: [
      output({ packageName: 'legacy-package', packageVersion: '1.0.0' }),
      deprecatedPackage(),
    ],
  });
  assert.equal(evaluation.result.blockers.length, 1);
  assert.equal(evaluation.dataset.recordCount, 1);
  assert.match(evaluation.errors.at(-1), /deprecated-package/);
});

test('CLI analysis returns the same blocker and dataset decisions', () => {
  const history = {
    phase: 'review',
    aiQualityIssues: [233],
    events: [
      output({ packageName: 'legacy-package', packageVersion: '1.0.0' }),
      deprecatedPackage(),
    ],
  };
  const analysis = analyzeAiToolHistory(history, 'private/repository');
  assert.equal(analysis.result.blockers.length, 1);
  assert.equal(analysis.dataset.recordCount, 1);
  assert.equal(analysis.dataset.records[0].repository.length, 64);
});
