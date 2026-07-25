import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzePlanningMistakes } from './planning-mistake-analysis.mjs';

function commit(sha, timestamp, files) {
  return {
    sha,
    timestamp,
    files: files.map((filename) => ({ filename, status: 'modified' })),
  };
}

test('reports missing prerequisite completion time as insufficient evidence', () => {
  const result = analyzePlanningMistakes({
    declaredScopePaths: ['src/a', 'src/b'],
    commits: [
      commit('a', '2026-01-01T10:00:00Z', ['src/a/index.ts']),
      commit('b', '2026-01-01T11:00:00Z', ['src/b/index.ts']),
    ],
    tasks: [
      { id: 'TASK-A', scope: ['src/a'] },
      { id: 'TASK-B', scope: ['src/b'], dependsOn: ['TASK-A'] },
    ],
  });
  assert.equal(
    result.findings.some((finding) => finding.type === 'wrong-implementation-order'),
    false,
  );
  assert.ok(result.notices.some((notice) => notice.code === 'sequence-timestamp-missing'));
  assert.equal(result.status, 'insufficient-evidence');
});

test('reports undated architecture approval as insufficient evidence', () => {
  const result = analyzePlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/index.ts'])],
    tasks: [{ id: 'TASK-1', scope: ['src'], architectureReviewRequired: true }],
    events: [
      {
        event: 'architecture-reviewed',
        taskId: 'TASK-1',
        status: 'approved',
        reviewer: 'architect',
      },
    ],
  });
  assert.equal(
    result.findings.some((finding) => finding.type === 'skipped-architecture-review'),
    false,
  );
  assert.ok(
    result.notices.some((notice) => notice.code === 'architecture-review-timestamp-missing'),
  );
});

test('reports undated scope approval as insufficient evidence', () => {
  const result = analyzePlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/index.ts', 'docs/plan.md'])],
    events: [
      {
        event: 'scope-approved',
        path: 'docs',
        status: 'approved',
        reviewer: 'architect',
      },
    ],
  });
  assert.equal(
    result.findings.some((finding) => finding.type === 'scope-creep'),
    false,
  );
  assert.ok(result.notices.some((notice) => notice.code === 'scope-approval-timestamp-missing'));
});
