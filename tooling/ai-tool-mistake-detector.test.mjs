import assert from 'node:assert/strict';
import test from 'node:test';

import { detectAiToolMistakes } from './ai-tool-mistake-detector.mjs';

const hash = (character) => character.repeat(64);

function output(id = 'OUT-1', extra = {}) {
  return {
    id: `EVENT-${id}`,
    type: 'ai-output',
    outputId: id,
    sourceKind: 'ai',
    provider: 'example-provider',
    model: 'example-model',
    tool: 'coding-agent',
    toolVersion: '1.0.0',
    at: '2026-07-17T10:00:00Z',
    promptHash: hash('a'),
    outputHash: hash('b'),
    artifactRefs: ['tooling/example.mjs'],
    generated: true,
    ...extra,
  };
}

function event(id, type, outputId = 'OUT-1', extra = {}) {
  return {
    id,
    type,
    outputId,
    status: 'verified',
    at: '2026-07-17T10:05:00Z',
    effectiveAt: '2026-07-17T09:00:00Z',
    validationRef: 'test:verified-evidence',
    ...extra,
  };
}

function analyze(...events) {
  return detectAiToolMistakes({ phase: 'review', events: [output(), ...events] });
}

function findingOf(analysis, type) {
  return analysis.findings.find((finding) => finding.type === type);
}

test('detects an evidence-backed AI hallucination', () => {
  const analysis = analyze(
    event('EVIDENCE-1', 'authoritative-contradiction', 'OUT-1', {
      expected: 'createServer exists',
      actual: 'createServe does not exist',
      confirmsMistake: true,
    }),
  );
  const finding = findingOf(analysis, 'ai-hallucination');
  assert.equal(finding.state, 'detected');
  assert.equal(finding.confidence, 'high');
  assert.equal(analysis.blockers.length, 1);
});

test('does not block a contradiction when output provenance is incomplete', () => {
  const incomplete = output('OUT-1', { outputHash: '', artifactRefs: [] });
  const analysis = detectAiToolMistakes({
    events: [
      incomplete,
      event('EVIDENCE-1', 'authoritative-contradiction', 'OUT-1', {
        expected: 'real symbol',
        actual: 'invented symbol',
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'ai-hallucination').state, 'suspected');
  assert.equal(analysis.blockers.length, 0);
  assert.ok(analysis.notices.some((notice) => notice.code === 'output-provenance-incomplete'));
});

test('detects wrong framework API for the pinned version', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { framework: 'next', frameworkVersion: '16.2.10', symbol: 'oldApi' }),
      event('API-1', 'framework-api-validation', 'OUT-1', {
        framework: 'next',
        pinnedVersion: '16.2.10',
        symbol: 'oldApi',
        status: 'missing',
        validationKind: 'compiler',
        validationCode: 'TS2339',
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'wrong-framework-api').state, 'detected');
});

test('keeps framework API mismatch suspected when validation targets another version', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { framework: 'next', frameworkVersion: '16.2.10', symbol: 'oldApi' }),
      event('API-1', 'framework-api-validation', 'OUT-1', {
        framework: 'next',
        pinnedVersion: '15.0.0',
        symbol: 'oldApi',
        status: 'missing',
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'wrong-framework-api').state, 'suspected');
  assert.equal(analysis.blockers.length, 0);
});

test('detects materially wrong documentation version', () => {
  const analysis = analyze(
    event('DOC-1', 'documentation-use', 'OUT-1', {
      documentationVersion: 'v5',
      pinnedVersion: 'v4',
      materialImpact: true,
      status: 'confirmed',
    }),
  );
  assert.equal(findingOf(analysis, 'wrong-documentation-version').state, 'detected');
});

test('ignores documentation mismatch without material impact', () => {
  const analysis = analyze(
    event('DOC-1', 'documentation-use', 'OUT-1', {
      documentationVersion: 'v5',
      pinnedVersion: 'v4',
      materialImpact: false,
      status: 'confirmed',
    }),
  );
  assert.equal(findingOf(analysis, 'wrong-documentation-version'), undefined);
});

test('detects package deprecated before selection', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { packageName: 'old-package', packageVersion: '1.0.0' }),
      event('PKG-1', 'package-metadata', 'OUT-1', {
        packageName: 'old-package',
        packageVersion: '1.0.0',
        status: 'deprecated',
        replacement: 'maintained-package',
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'deprecated-package').state, 'detected');
});

test('does not retroactively prove deprecated package selection', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { packageName: 'old-package', packageVersion: '1.0.0' }),
      event('PKG-1', 'package-metadata', 'OUT-1', {
        packageName: 'old-package',
        packageVersion: '1.0.0',
        status: 'deprecated',
        effectiveAt: '2026-07-18T09:00:00Z',
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'deprecated-package').state, 'suspected');
  assert.equal(analysis.blockers.length, 0);
});

test('detects unsafe suggestion only with confirmed policy evidence', () => {
  const analysis = analyze(
    event('SAFE-1', 'policy-violation', 'OUT-1', {
      status: 'confirmed',
      policyId: 'POLICY-AUTH-001',
      validationKind: 'security-review',
      validationRef: 'review:123',
      severity: 'critical',
    }),
  );
  assert.equal(findingOf(analysis, 'unsafe-suggestion').state, 'detected');
});

test('does not treat unsafe-looking prose as a policy violation', () => {
  const analysis = detectAiToolMistakes({
    events: [output('OUT-1', { claim: 'disable validation for debugging' })],
  });
  assert.equal(findingOf(analysis, 'unsafe-suggestion'), undefined);
  assert.equal(analysis.status, 'clear');
});

test('keeps policy concern suspected without a policy and validation reference', () => {
  const analysis = analyze(
    event('SAFE-1', 'policy-violation', 'OUT-1', {
      status: 'confirmed',
      policyId: '',
      validationRef: '',
    }),
  );
  assert.equal(findingOf(analysis, 'unsafe-suggestion').state, 'suspected');
});

test('detects copy-paste bug from provenance and stale context evidence', () => {
  const analysis = analyze(
    event('COPY-1', 'copy-provenance', 'OUT-1', {
      copiedFrom: 'packages/alpha/service.ts',
      status: 'verified',
    }),
    event('COPY-2', 'copy-validation', 'OUT-1', {
      staleIdentifiers: ['AlphaTenant', 'alphaPermission'],
      status: 'confirmed',
    }),
  );
  assert.equal(findingOf(analysis, 'copy-paste-bug').state, 'detected');
});

test('does not infer copy-paste bug from stale identifiers without provenance', () => {
  const analysis = analyze(
    event('COPY-2', 'copy-validation', 'OUT-1', {
      staleIdentifiers: ['AlphaTenant'],
      status: 'confirmed',
    }),
  );
  assert.equal(findingOf(analysis, 'copy-paste-bug'), undefined);
});

test('detects generated dead code from verified static analysis', () => {
  const analysis = analyze(
    event('STATIC-1', 'static-analysis', 'OUT-1', {
      status: 'unreachable',
      generated: true,
      validationKind: 'eslint',
      validationCode: 'no-unreachable',
    }),
  );
  assert.equal(findingOf(analysis, 'generated-dead-code').state, 'detected');
});

test('keeps dead-code concern suspected without generated attribution', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { generated: false }),
      event('STATIC-1', 'static-analysis', 'OUT-1', {
        status: 'unused',
        generated: false,
      }),
    ],
  });
  assert.equal(findingOf(analysis, 'generated-dead-code').state, 'suspected');
});

test('resolves a finding without deleting the occurrence', () => {
  const initial = event('API-1', 'framework-api-validation', 'OUT-1', {
    framework: 'next',
    pinnedVersion: '16.2.10',
    symbol: 'oldApi',
    status: 'missing',
  });
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { framework: 'next', frameworkVersion: '16.2.10', symbol: 'oldApi' }),
      initial,
      event('FIX-1', 'correction', 'OUT-1', {
        findingType: 'wrong-framework-api',
        status: 'confirmed',
        correctionCommit: 'a'.repeat(40),
      }),
    ],
  });
  const finding = findingOf(analysis, 'wrong-framework-api');
  assert.equal(finding.state, 'resolved');
  assert.equal(analysis.blockers.length, 0);
});

test('waives a finding only with reviewer and meaningful reason', () => {
  const analysis = detectAiToolMistakes({
    events: [
      output('OUT-1', { packageName: 'old-package', packageVersion: '1.0.0' }),
      event('PKG-1', 'package-metadata', 'OUT-1', {
        packageName: 'old-package',
        packageVersion: '1.0.0',
        status: 'deprecated',
      }),
      event('WAIVE-1', 'waiver', 'OUT-1', {
        findingType: 'deprecated-package',
        reviewer: 'architect',
        reason: 'Temporary compatibility exception with bounded removal date.',
      }),
    ],
  });
  const finding = findingOf(analysis, 'deprecated-package');
  assert.equal(finding.waived, true);
  assert.equal(analysis.blockers.length, 0);
});

test('reports evidence linked to a missing output', () => {
  const analysis = detectAiToolMistakes({
    events: [event('API-1', 'framework-api-validation', 'MISSING', { status: 'missing' })],
  });
  assert.equal(analysis.findings.length, 0);
  assert.ok(analysis.notices.some((notice) => notice.code === 'referenced-output-missing'));
});

test('rejects duplicate event IDs', () => {
  assert.throws(() => detectAiToolMistakes({ events: [output(), output()] }), /Duplicate event-id/);
});

test('returns clear when attributable output has no mistake evidence', () => {
  const analysis = detectAiToolMistakes({ events: [output()] });
  assert.equal(analysis.status, 'clear');
  assert.equal(analysis.blockers.length, 0);
});
