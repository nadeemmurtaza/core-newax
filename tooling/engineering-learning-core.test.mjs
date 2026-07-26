import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyFailure,
  createEngineeringEvent,
  normalizeText,
  parseIssueNumber,
  parseIssueNumbers,
  parseLedgerEntries,
  parseMetadata,
  parsePullRequestField,
  renderIssueBody,
} from './engineering-learning-core.mjs';
import { applyExternalSourceClassification } from './external-event-classification.mjs';

test('classifies an exact pnpm lockfile diagnostic as machine-supported', () => {
  const result = classifyFailure({
    workflowName: 'Continuous Integration',
    jobName: 'Verify monorepo',
    stepName: 'Install dependencies',
    logText: 'ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile',
  });

  assert.equal(result.rootCauseId, 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED');
  assert.equal(result.ledgerEntry, 'EL-0001');
  assert.equal(result.deterministic, true);
});

test('does not promote a heuristic TypeScript match to deterministic truth', () => {
  const result = classifyFailure({
    workflowName: 'Continuous Integration',
    jobName: 'Verify monorepo',
    stepName: 'Type-check',
    logText: 'error TS2559: Type mismatch involving ProcessEnv.',
  });

  assert.equal(result.rootCauseId, 'ROOT-TYPECHECK-PROCESSENV-SHAPE');
  assert.equal(result.deterministic, false);
});

test('falls back to the failed stage when no known signature exists', () => {
  const result = classifyFailure({
    workflowName: 'Continuous Integration',
    jobName: 'Verify monorepo',
    stepName: 'Type-check',
    logText: 'A novel compiler failure occurred.',
  });

  assert.equal(result.category, 'typecheck-compilation');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.deterministic, false);
});

test('normalization removes volatile identifiers from fingerprints', () => {
  const first = normalizeText(
    '2026-07-16T14:00:00.000Z commit abcdef1234567890abcdef1234567890abcdef12 failed',
  );
  const second = normalizeText(
    '2026-07-17T15:00:00.000Z commit 1234567890abcdef1234567890abcdef12345678 failed',
  );

  assert.equal(first, second);
});

test('normalization redacts secret assignments before storing evidence', () => {
  const normalized = normalizeText('Request failed with token=supersecretvalue and status 401.');

  assert.equal(normalized, 'Request failed with token=<redacted> and status 401.');
  assert.equal(normalized.includes('supersecretvalue'), false);
});

test('engineering events redact secrets from metadata and method fields', () => {
  const event = createEngineeringEvent({
    sourceType: 'external-tool',
    sourceId: 'operation password=hunter2',
    stepName: 'Deploy with api_key=secretvalue',
    logText: 'Unknown external failure.',
    unsuccessfulMethod: 'Retried with token=privatevalue',
    successfulMethod: 'Removed password=anothersecret',
    preventionControl: 'Never persist secret=hiddenvalue',
  });

  assert.equal(event.sourceId, 'operation password=<redacted>');
  assert.equal(event.stepName, 'Deploy with api_key=<redacted>');
  assert.equal(event.unsuccessfulMethod, 'Retried with token=<redacted>');
  assert.equal(event.successfulMethod, 'Removed password=<redacted>');
  assert.equal(event.preventionControl, 'Never persist secret=<redacted>');
});

test('creates stable machine-readable issue metadata', () => {
  const event = createEngineeringEvent({
    sourceType: 'ci-workflow',
    sourceId: '100',
    repository: 'Newax-Technologies/core-newax',
    prNumber: 49,
    commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
    workflowRunId: 100,
    workflowName: 'Continuous Integration',
    jobId: 200,
    jobName: 'Verify monorepo',
    stepName: 'Check formatting',
    logText: 'Code style issues found in the above file.',
    evidenceUrls: ['https://example.test/run/100'],
  });
  const body = renderIssueBody(event);
  const metadata = parseMetadata(body);

  assert.equal(metadata['pr-number'], '49');
  assert.equal(metadata['workflow-run-id'], '100');
  assert.equal(metadata['root-cause-id'], 'ROOT-FORMATTING-NOT-APPLIED');
  assert.equal(metadata['root-cause-status'], 'candidate');
});

test('categorizes planning events while preserving root-cause uncertainty', () => {
  const baseEvent = createEngineeringEvent({
    sourceType: 'planning',
    sourceId: 'planning-1',
    stepName: 'External engineering event',
    logText: 'A decision was made without checking branch ancestry.',
  });
  const event = applyExternalSourceClassification(
    baseEvent,
    'planning',
    'A decision was made without checking branch ancestry.',
  );

  assert.equal(event.category, 'planning-decision-quality');
  assert.equal(event.rootCauseId, 'ROOT-UNCLASSIFIED-PLANNING_DECISION_QUALITY');
  assert.equal(event.status, 'candidate');
  assert.equal(event.rootCauseDeterministic, false);
});

test('parses pull-request fields, issue numbers, and ledger entries', () => {
  const body = '- Learning outcome: `existing`\n- Learning issue: `#123`';

  assert.equal(parsePullRequestField(body, '- Learning outcome:'), 'existing');
  assert.equal(parseIssueNumber(parsePullRequestField(body, '- Learning issue:')), 123);
  assert.deepEqual(parseIssueNumbers('#123, #124, #123'), [123, 124]);
  assert.deepEqual(parseLedgerEntries('EL-0018, EL-0019, EL-0018'), ['EL-0018', 'EL-0019']);
});

test('governed command wrapper queues a non-zero local command', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');

  const directory = mkdtempSync(join(tmpdir(), 'newax-learning-'));
  const wrapper = resolve('tooling/run-engineering-command.mjs');
  try {
    const result = spawnSync(process.execPath, [wrapper, 'node', '-e', 'process.exit(7)'], {
      cwd: directory,
      env: { ...process.env, CI: 'false' },
      encoding: 'utf8',
    });

    assert.equal(result.status, 7);
    const queued = readFileSync(join(directory, '.newax/engineering-events.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(queued.length, 1);
    assert.equal(queued[0].sourceType, 'local-command');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('governed command wrapper queues a command launch failure', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');

  const directory = mkdtempSync(join(tmpdir(), 'newax-learning-launch-'));
  const wrapper = resolve('tooling/run-engineering-command.mjs');
  try {
    const result = spawnSync(process.execPath, [wrapper, 'newax-command-that-does-not-exist'], {
      cwd: directory,
      env: { ...process.env, CI: 'false' },
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    const queued = readFileSync(join(directory, '.newax/engineering-events.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(queued.length, 1);
    assert.equal(queued[0].sourceType, 'local-command');
    assert.match(queued[0].symptom, /ENOENT|not found|not recognized/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('operation intent blocks a pull-request target using an issue action', async () => {
  const { validateOperationIntent } = await import('./validate-operation-intent.mjs');

  const errors = validateOperationIntent({
    targetType: 'pull-request-metadata',
    targetIdentifier: 'PR #49',
    action: 'update_issue',
    expectedPostcondition: 'PR body changes.',
    prohibitedSideEffects: 'No issue or repository file changes.',
  });

  assert.deepEqual(errors, [
    'Action update_issue does not match target type pull-request-metadata.',
  ]);
});

test('operation intent accepts the matching pull-request metadata action', async () => {
  const { validateOperationIntent } = await import('./validate-operation-intent.mjs');

  const errors = validateOperationIntent({
    targetType: 'pull-request-metadata',
    targetIdentifier: 'PR #49',
    action: 'update_pull_request',
    expectedPostcondition: 'PR body changes.',
    prohibitedSideEffects: 'No repository file changes.',
  });

  assert.deepEqual(errors, []);
});
