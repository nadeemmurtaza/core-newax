import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzePlanningMistakes } from './planning-mistake-analysis.mjs';
import { planningGovernanceErrors } from './verify-pr-planning.mjs';

function commit(sha, timestamp, files) {
  return {
    sha,
    timestamp,
    files: files.map((filename) => ({ filename, status: 'modified' })),
  };
}

test('governance blocks high-confidence findings and missing review evidence', () => {
  const result = analyzePlanningMistakes({
    phase: 'review',
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/out.md'])],
  });
  const errors = planningGovernanceErrors(
    { phase: 'review', planningIssues: [], tasks: [], declaredScopePaths: [] },
    result,
  );
  assert.ok(errors.some((error) => /planning issue/.test(error)));
  assert.ok(errors.some((error) => /scope-creep/.test(error)));
});

test('governance allows a draft with only suspected findings', () => {
  const result = analyzePlanningMistakes({
    phase: 'draft',
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    requirements: [{ id: 'REQ-1', text: 'Pending requirement', satisfied: false }],
  });
  assert.deepEqual(
    planningGovernanceErrors(
      { phase: 'draft', planningIssues: [1], tasks: [], declaredScopePaths: ['src'] },
      result,
    ),
    [],
  );
});

test('planning CLI exits non-zero for a detected mistake and zero in report-only mode', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newax-planning-cli-'));
  const path = join(directory, 'history.json');
  writeFileSync(
    path,
    JSON.stringify({
      phase: 'review',
      declaredScopePaths: ['src'],
      commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/out.md'])],
    }),
  );
  const script = fileURLToPath(new URL('./analyze-planning.mjs', import.meta.url));
  const blocked = spawnSync(process.execPath, [script, '--file', path], {
    encoding: 'utf8',
  });
  const reportOnly = spawnSync(process.execPath, [script, '--file', path, '--report-only'], {
    encoding: 'utf8',
  });
  assert.equal(blocked.status, 1);
  assert.equal(reportOnly.status, 0, reportOnly.stderr);
  assert.match(reportOnly.stdout, /scope-creep/);
});
