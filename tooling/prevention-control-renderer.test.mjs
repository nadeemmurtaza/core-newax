import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { renderPreventionFiles, writePreventionFiles } from './prevention-control-renderer.mjs';
import { buildOrUpdatePreventionPack } from './prevention-engine.mjs';

function pack() {
  return buildOrUpdatePreventionPack({
    id: 'ISSUE-1',
    issueNumber: 1,
    rootCauseId: 'ROOT-RENDER-TEST',
    ledgerEntry: 'EL-9002',
    category: 'formatting',
    rootCauseStatus: 'confirmed',
    resolutionStatus: 'verified',
    resolvedAt: '2026-07-17T11:00:00Z',
    fixCommit: 'c'.repeat(40),
    reviewer: 'reviewer',
    reviewedAt: '2026-07-17T11:05:00Z',
    verificationRefs: ['workflow:3'],
    regressionRefs: ['test:render'],
    preventionControl: 'Run the exact formatter before the formatting check.',
    successfulMethod: 'Format and then verify.',
    unsuccessfulMethod: 'Use CI as the first formatter.',
  }).pack;
}

test('renders exactly seven deterministic files', () => {
  const first = renderPreventionFiles(pack());
  const second = renderPreventionFiles(pack());
  assert.equal(first.length, 7);
  assert.deepEqual(first, second);
});

test('renders three valid JSON control files', () => {
  const files = renderPreventionFiles(pack());
  const jsonFiles = files.filter((file) => file.path.endsWith('.json'));
  assert.equal(jsonFiles.length, 3);
  for (const file of jsonFiles) {
    assert.doesNotThrow(() => JSON.parse(file.content));
  }
});

test('markdown controls retain source attribution', () => {
  const files = renderPreventionFiles(pack());
  const markdown = files.find((file) => file.path.includes('coding-standards'));
  assert.match(markdown.content, /root-cause-id: ROOT-RENDER-TEST/);
  assert.match(markdown.content, /EL-9002/);
  assert.match(markdown.content, /Run the exact formatter/);
});

test('writes all seven files under the selected output root', () => {
  const root = mkdtempSync(join(tmpdir(), 'prevention-engine-'));
  try {
    const paths = writePreventionFiles(pack(), root);
    assert.equal(paths.length, 7);
    for (const path of paths) {
      assert.equal(existsSync(join(root, path)), true);
    }
    const ci = JSON.parse(readFileSync(join(root, paths[0]), 'utf8'));
    assert.equal(ci.pack.rootCauseId, 'ROOT-RENDER-TEST');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
