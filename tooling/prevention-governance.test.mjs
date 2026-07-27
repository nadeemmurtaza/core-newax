import assert from 'node:assert/strict';
import test from 'node:test';

import { renderPreventionFiles } from './prevention-control-renderer.mjs';
import { buildPreventionRegistry } from './prevention-engine.mjs';
import { preventionGovernanceErrors } from './verify-pr-prevention.mjs';

function mistake(overrides = {}) {
  return {
    id: 'ISSUE-1',
    issueNumber: 1,
    rootCauseId: 'ROOT-GOVERNANCE',
    ledgerEntry: 'EL-9003',
    category: 'planning-decision-quality',
    rootCauseStatus: 'confirmed',
    resolutionStatus: 'verified',
    resolvedAt: '2026-07-17T13:00:00Z',
    fixCommit: 'd'.repeat(40),
    reviewer: 'reviewer',
    reviewedAt: '2026-07-17T13:05:00Z',
    verificationRefs: ['workflow:4'],
    regressionRefs: ['test:governance'],
    preventionControl: 'Require current prevention artifacts before review.',
    successfulMethod: 'Generate and compare the exact seven files.',
    unsuccessfulMethod: 'Describe a lesson without changing controls.',
    ...overrides,
  };
}

test('passes when there are no resolved mistakes', () => {
  const history = { phase: 'review', mistakes: [] };
  const registry = buildPreventionRegistry([]);
  assert.deepEqual(preventionGovernanceErrors(history, registry), []);
});

test('reports insufficient resolution evidence', () => {
  const history = { phase: 'review', mistakes: [{ rootCauseId: 'ROOT-X' }] };
  const registry = buildPreventionRegistry(history.mistakes);
  assert.match(preventionGovernanceErrors(history, registry).join('\n'), /confirmed-root-cause/);
});

test('reports all missing generated prevention files', () => {
  const history = { phase: 'review', mistakes: [mistake()] };
  const registry = buildPreventionRegistry(history.mistakes);
  const errors = preventionGovernanceErrors(history, registry, new Map());
  assert.equal(errors.filter((error) => error.startsWith('Missing generated')).length, 7);
});

test('passes when all exact generated files exist at the head', () => {
  const history = { phase: 'review', mistakes: [mistake()] };
  const registry = buildPreventionRegistry(history.mistakes);
  const files = new Map(
    registry.packs.flatMap((pack) =>
      renderPreventionFiles(pack).map((file) => [file.path, file.content]),
    ),
  );
  assert.deepEqual(preventionGovernanceErrors(history, registry, files), []);
});

test('reports stale generated prevention content', () => {
  const history = { phase: 'review', mistakes: [mistake()] };
  const registry = buildPreventionRegistry(history.mistakes);
  const rendered = renderPreventionFiles(registry.packs[0]);
  const files = new Map(rendered.map((file) => [file.path, file.content]));
  files.set(rendered[0].path, '{}\n');
  assert.match(preventionGovernanceErrors(history, registry, files).join('\n'), /Stale generated/);
});
