import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAiQualityDataset, serializeAiQualityDatasetJsonl } from './ai-quality-dataset.mjs';
import { detectAiToolMistakes } from './ai-tool-mistake-detector.mjs';

const hash = (character) => character.repeat(64);

function fixture() {
  const events = [
    {
      id: 'OUT-EVENT',
      type: 'ai-output',
      outputId: 'OUT-1',
      sourceKind: 'ai',
      provider: 'example-provider',
      model: 'example-model',
      tool: 'coding-agent',
      toolVersion: '1.0.0',
      at: '2026-07-17T10:00:00Z',
      promptHash: hash('a'),
      outputHash: hash('b'),
      artifactRefs: ['tooling/example.mjs'],
      framework: 'next',
      frameworkVersion: '16.2.10',
      symbol: 'oldApi',
      generated: true,
      prompt: 'THIS MUST NEVER ENTER THE DATASET',
      rawOutput: 'NOR THIS',
    },
    {
      id: 'API-1',
      type: 'framework-api-validation',
      outputId: 'OUT-1',
      framework: 'next',
      pinnedVersion: '16.2.10',
      symbol: 'oldApi',
      status: 'missing',
      effectiveAt: '2026-07-17T09:00:00Z',
      validationKind: 'compiler',
      validationCode: 'TS2339',
      validationRef: 'test:api-contract',
    },
    {
      id: 'FIX-1',
      type: 'correction',
      outputId: 'OUT-1',
      findingType: 'wrong-framework-api',
      status: 'confirmed',
      at: '2026-07-17T11:00:00Z',
      correctionCommit: 'c'.repeat(40),
    },
    {
      id: 'TEST-1',
      type: 'regression-test',
      outputId: 'OUT-1',
      findingType: 'wrong-framework-api',
      status: 'verified',
      at: '2026-07-17T11:30:00Z',
      regressionTest: 'framework API contract',
      regressionRun: 'run:123',
    },
  ];
  const analysis = detectAiToolMistakes({ events });
  return { events, analysis };
}

test('builds a versioned record for every finding', () => {
  const { events, analysis } = fixture();
  const dataset = buildAiQualityDataset({
    analysis,
    events,
    repository: 'Newax-Technologies/core-newax',
  });
  assert.equal(dataset.schemaVersion, 1);
  assert.equal(dataset.recordCount, 1);
  assert.equal(dataset.records[0].mistakeType, 'wrong-framework-api');
  assert.equal(dataset.records[0].state, 'resolved');
});

test('stores hashes and references but never raw prompts or outputs', () => {
  const { events, analysis } = fixture();
  const serialized = JSON.stringify(buildAiQualityDataset({ analysis, events }));
  assert.match(serialized, new RegExp(hash('a')));
  assert.match(serialized, new RegExp(hash('b')));
  assert.doesNotMatch(serialized, /THIS MUST NEVER ENTER THE DATASET/);
  assert.doesNotMatch(serialized, /NOR THIS/);
  assert.doesNotMatch(serialized, /"rawOutput"|"rawPrompt"|"generatedCode"/);
});

test('records correction and regression evidence', () => {
  const { events, analysis } = fixture();
  const [record] = buildAiQualityDataset({ analysis, events }).records;
  assert.equal(record.correction.commit, 'c'.repeat(40));
  assert.equal(record.regression.test, 'framework API contract');
  assert.equal(record.regression.run, 'run:123');
});

test('hashes repository identity instead of storing the private repository name', () => {
  const { events, analysis } = fixture();
  const [record] = buildAiQualityDataset({
    analysis,
    events,
    repository: 'Newax-Technologies/core-newax',
  }).records;
  assert.notEqual(record.repository, 'Newax-Technologies/core-newax');
  assert.equal(record.repository.length, 64);
});

test('serializes one JSON object per line', () => {
  const { events, analysis } = fixture();
  const dataset = buildAiQualityDataset({ analysis, events });
  const jsonl = serializeAiQualityDatasetJsonl(dataset);
  assert.equal(jsonl.split('\n').length, dataset.recordCount);
  assert.equal(JSON.parse(jsonl).findingId, dataset.records[0].findingId);
});
