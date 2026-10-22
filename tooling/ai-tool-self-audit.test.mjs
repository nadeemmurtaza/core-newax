import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAiQualityDataset } from './ai-quality-dataset.mjs';
import { detectAiToolMistakes } from './ai-tool-mistake-detector.mjs';
import { evaluateAiToolGovernance } from './verify-pr-ai-quality.mjs';

const hash = (character) => character.repeat(64);

function output(id, extra = {}) {
  return {
    id: `EVENT-${id}`,
    type: 'ai-output',
    outputId: id,
    sourceKind: 'ai',
    provider: 'example-provider',
    model: 'example-model',
    at: '2026-07-17T10:00:00Z',
    outputHash: hash('a'),
    artifactRefs: ['tooling/example.mjs'],
    generated: true,
    ...extra,
  };
}

function event(id, type, outputId, extra = {}) {
  return {
    id,
    type,
    outputId,
    status: 'verified',
    at: '2026-07-17T10:05:00Z',
    effectiveAt: '2026-07-17T09:00:00Z',
    validationRef: 'test:self-audit',
    ...extra,
  };
}

test('unverified copy provenance cannot create a blocking copy-paste finding', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1'),
      event('COPY-1', 'copy-provenance', 'OUT-1', {
        copiedFrom: 'packages/alpha/service.ts',
        status: 'active',
      }),
      event('COPY-2', 'copy-validation', 'OUT-1', {
        staleIdentifiers: ['AlphaTenant'],
        status: 'confirmed',
      }),
    ],
  });
  const finding = analysis.findings.find((candidate) => candidate.type === 'copy-paste-bug');
  assert.equal(finding.state, 'suspected');
  assert.ok(finding.missingEvidence.includes('verified-copy-provenance'));
  assert.equal(analysis.blockers.length, 0);
});

test('a correction for one output does not resolve another output of the same type', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { framework: 'next', frameworkVersion: '16.2.10', symbol: 'oldApi' }),
      event('API-1', 'framework-api-validation', 'OUT-1', {
        framework: 'next',
        pinnedVersion: '16.2.10',
        symbol: 'oldApi',
        status: 'missing',
      }),
      output('OUT-2'),
      event('FIX-2', 'correction', 'OUT-2', {
        findingType: 'wrong-framework-api',
        status: 'confirmed',
      }),
    ],
  });
  const finding = analysis.findings.find(
    (candidate) => candidate.type === 'wrong-framework-api' && candidate.outputId === 'OUT-1',
  );
  assert.equal(finding.state, 'detected');
});

test('dataset hashes waiver reviewer and reason text', () => {
  const events = [
    output('OUT-1', { framework: 'next', frameworkVersion: '16.2.10', symbol: 'oldApi' }),
    event('API-1', 'framework-api-validation', 'OUT-1', {
      framework: 'next',
      pinnedVersion: '16.2.10',
      symbol: 'oldApi',
      status: 'missing',
    }),
    event('WAIVER-1', 'waiver', 'OUT-1', {
      findingType: 'wrong-framework-api',
      reviewer: 'private-reviewer-name',
      reason: 'Private compatibility detail that must not enter the dataset.',
    }),
  ];
  const analysis = detectAiToolMistakes({ events });
  const dataset = buildAiQualityDataset({ analysis, events });
  const serialized = JSON.stringify(dataset);
  assert.doesNotMatch(serialized, /private-reviewer-name/);
  assert.doesNotMatch(serialized, /Private compatibility detail/);
  assert.equal(dataset.records[0].lifecycle.waiver.reviewerHash.length, 64);
  assert.equal(dataset.records[0].lifecycle.waiver.reasonHash.length, 64);
});

test('review governance rejects linked evidence without output provenance', () => {
  const evaluation = evaluateAiToolGovernance({
    phase: 'review',
    aiQualityIssues: [233],
    events: [
      event('PACKAGE-1', 'package-metadata', 'MISSING', {
        packageName: 'legacy-package',
        status: 'deprecated',
      }),
    ],
  });
  assert.match(evaluation.errors[0], /structured output provenance record/);
});
