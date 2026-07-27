import assert from 'node:assert/strict';
import test from 'node:test';

import { detectPlanningMistakes, pathMatchesScope } from './planning-mistake-detector.mjs';

function commit(sha, timestamp, files, message = '') {
  return {
    sha,
    timestamp,
    message,
    files: files.map((filename) => ({ filename, status: 'modified' })),
  };
}

function find(result, type) {
  return result.findings.find((finding) => finding.type === type);
}

test('matches exact, prefix, and wildcard scope paths', () => {
  assert.equal(pathMatchesScope('tooling/a/b.mjs', ['tooling']), true);
  assert.equal(pathMatchesScope('apps/api/src/a.ts', ['apps/**/src/*.ts']), true);
  assert.equal(pathMatchesScope('docs/a.md', ['tooling']), false);
});

test('detects a forgotten migration when a completed task required one', () => {
  const result = detectPlanningMistakes({
    phase: 'review',
    declaredScopePaths: ['apps/api/prisma/schema.prisma'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['apps/api/prisma/schema.prisma'])],
    tasks: [
      {
        id: 'TASK-1',
        scope: ['apps/api/prisma/schema.prisma'],
        migration: 'yes',
        completedAt: '2026-01-01T11:00:00Z',
      },
    ],
  });
  assert.equal(find(result, 'forgot-migration').state, 'detected');
  assert.equal(result.status, 'detected');
});

test('detects a migration added after task completion', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['apps/api/prisma'],
    commits: [
      commit('schema', '2026-01-01T10:00:00Z', ['apps/api/prisma/schema.prisma']),
      commit('migration', '2026-01-01T13:00:00Z', ['apps/api/prisma/migrations/001/migration.sql']),
    ],
    tasks: [
      {
        id: 'TASK-1',
        scope: ['apps/api/prisma'],
        migrationRequired: true,
        completedAt: '2026-01-01T12:00:00Z',
      },
    ],
  });
  assert.match(find(result, 'forgot-migration').title, /marked complete/);
});

test('detects an explicit corrective migration commit', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['apps/api/prisma'],
    commits: [
      commit('schema', '2026-01-01T10:00:00Z', ['apps/api/prisma/schema.prisma']),
      commit(
        'migration',
        '2026-01-01T11:00:00Z',
        ['apps/api/prisma/migrations/001/migration.sql'],
        'Add missing migration',
      ),
    ],
    tasks: [{ id: 'TASK-1', scope: ['apps/api/prisma'], migrationRequired: true }],
  });
  assert.match(find(result, 'forgot-migration').title, /corrective commit/);
});

test('detects a forgotten dependency when manifest or lockfile evidence is absent', () => {
  const result = detectPlanningMistakes({
    phase: 'review',
    declaredScopePaths: ['apps/api/src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['apps/api/src/service.ts'])],
    tasks: [
      {
        id: 'TASK-1',
        scope: ['apps/api/src'],
        dependencyRequired: true,
        completedAt: '2026-01-01T11:00:00Z',
      },
    ],
  });
  const finding = find(result, 'forgot-dependency');
  assert.deepEqual(finding.missingEvidence.sort(), ['dependency-manifest', 'lockfile']);
});

test('detects dependent implementation before prerequisite completion', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src/a', 'src/b'],
    commits: [
      commit('b', '2026-01-01T10:00:00Z', ['src/b/index.ts']),
      commit('a', '2026-01-01T11:00:00Z', ['src/a/index.ts']),
    ],
    tasks: [
      { id: 'TASK-A', scope: ['src/a'], completedAt: '2026-01-01T12:00:00Z' },
      { id: 'TASK-B', scope: ['src/b'], dependsOn: ['TASK-A'] },
    ],
  });
  assert.match(find(result, 'wrong-implementation-order').title, /before prerequisite/);
});

test('detects an ignored required item at review', () => {
  const result = detectPlanningMistakes({
    phase: 'review',
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    requirements: [
      {
        id: 'REQ-1',
        text: 'Add audit event',
        requiredPaths: ['src/audit/**'],
        satisfied: false,
      },
    ],
  });
  assert.equal(find(result, 'ignored-requirement').state, 'detected');
});

test('does not accuse an unfinished draft requirement as proven', () => {
  const result = detectPlanningMistakes({
    phase: 'draft',
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    requirements: [{ id: 'REQ-1', text: 'Add audit event', satisfied: false }],
  });
  assert.equal(find(result, 'ignored-requirement').state, 'suspected');
  assert.equal(result.status, 'review-required');
});

test('detects architecture review skipped before implementation', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    tasks: [{ id: 'TASK-1', scope: ['src'], architectureReviewRequired: true }],
  });
  assert.equal(find(result, 'skipped-architecture-review').confidence, 'high');
});

test('accepts architecture approval recorded before implementation', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    tasks: [{ id: 'TASK-1', scope: ['src'], architectureReviewRequired: true }],
    events: [
      {
        event: 'architecture-reviewed',
        taskId: 'TASK-1',
        status: 'approved',
        at: '2026-01-01T09:00:00Z',
      },
    ],
  });
  assert.equal(find(result, 'skipped-architecture-review'), undefined);
});

test('detects a materially wrong estimate from explicit timing evidence', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    tasks: [
      {
        id: 'TASK-1',
        scope: ['src'],
        estimateMinutes: 60,
        startedAt: '2026-01-01T09:00:00Z',
        completedAt: '2026-01-01T13:00:00Z',
      },
    ],
  });
  const finding = find(result, 'wrong-estimate');
  assert.equal(finding.confidence, 'medium');
  assert.equal(finding.evidence[1].minutes, 240);
});

test('uses an approved estimate revision before completion', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
    tasks: [
      {
        id: 'TASK-1',
        scope: ['src'],
        estimateMinutes: 60,
        startedAt: '2026-01-01T09:00:00Z',
        completedAt: '2026-01-01T13:00:00Z',
      },
    ],
    events: [
      {
        event: 'estimate-revised',
        taskId: 'TASK-1',
        estimateMinutes: 240,
        at: '2026-01-01T10:30:00Z',
      },
    ],
  });
  assert.equal(find(result, 'wrong-estimate'), undefined);
});

test('detects scope creep without prior approval', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/unplanned.md'])],
  });
  const finding = result.findings.find(
    (candidate) =>
      candidate.type === 'scope-creep' && candidate.evidence[0].filename === 'docs/unplanned.md',
  );
  assert.ok(finding);
});

test('accepts scope expansion approved before the first change', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/unplanned.md'])],
    events: [
      {
        event: 'scope-approved',
        path: 'docs',
        at: '2026-01-01T09:00:00Z',
        reviewer: 'reviewer',
      },
    ],
  });
  assert.equal(find(result, 'scope-creep'), undefined);
});

test('reports insufficient evidence instead of inventing scope creep', () => {
  const result = detectPlanningMistakes({
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],
  });
  assert.equal(result.status, 'insufficient-evidence');
  assert.ok(result.notices.some((notice) => notice.code === 'declared-scope-missing'));
});

test('allows an explicit reviewer waiver while preserving the finding', () => {
  const result = detectPlanningMistakes({
    declaredScopePaths: ['src'],
    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/unplanned.md'])],
    events: [
      {
        event: 'finding-waived',
        findingType: 'scope-creep',
        reviewer: 'architect',
        reason: 'The documentation file is required for regulated release evidence.',
        at: '2026-01-01T11:00:00Z',
      },
    ],
  });
  const finding = find(result, 'scope-creep');
  assert.equal(finding.waived, true);
  assert.equal(result.blockers.length, 0);
});
