import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { detectCommunicationMistakes } from './communication-mistake-detector.mjs';
import { communicationGovernanceErrors } from './verify-pr-communication.mjs';

function event(id, type, topic, extra = {}) {
  return {
    id,
    type,
    topic,
    authority: 'reviewer',
    status: 'active',
    at: '2026-01-01T09:00:00Z',
    appliesTo: ['src'],
    ...extra,
  };
}

const commit = {
  sha: 'a',
  timestamp: '2026-01-01T10:00:00Z',
  files: [{ filename: 'src/a.ts' }],
};

test('governance blocks review-ready PRs with missing evidence and high findings', () => {
  const result = detectCommunicationMistakes({
    phase: 'review',
    commits: [commit],
    events: [event('AR', 'approval-request', 'schema', { requiresApproval: true })],
  });
  const errors = communicationGovernanceErrors(
    { phase: 'review', communicationIssues: [], events: [] },
    result,
  );
  assert.ok(errors.some((error) => /communication issue/.test(error)));
  assert.ok(errors.some((error) => /missing-approval/.test(error)));
});

test('governance allows draft PRs with suspected findings', () => {
  const result = detectCommunicationMistakes({
    phase: 'draft',
    events: [event('Q', 'question', 'retention', { status: 'open', appliesTo: [] })],
  });
  assert.deepEqual(
    communicationGovernanceErrors(
      { phase: 'draft', communicationIssues: [1], events: [{ id: 'Q' }] },
      result,
    ),
    [],
  );
});

test('communication CLI exits non-zero for a blocker and zero in report-only mode', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newax-communication-cli-'));
  const path = join(directory, 'history.json');
  writeFileSync(
    path,
    JSON.stringify({
      phase: 'review',
      commits: [commit],
      events: [event('AR', 'approval-request', 'schema', { requiresApproval: true })],
    }),
  );
  const script = fileURLToPath(new URL('./analyze-communication.mjs', import.meta.url));
  const blocked = spawnSync(process.execPath, [script, '--file', path], { encoding: 'utf8' });
  const reportOnly = spawnSync(process.execPath, [script, '--file', path, '--report-only'], {
    encoding: 'utf8',
  });
  assert.equal(blocked.status, 1, blocked.stderr);
  assert.equal(reportOnly.status, 0, reportOnly.stderr);
  assert.match(reportOnly.stdout, /missing-approval/);
});
