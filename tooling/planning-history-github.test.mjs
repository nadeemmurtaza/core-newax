import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectPlanningHistory,
  parsePlanningIssue,
  parsePlanningIssueNumbers,
} from './planning-history-github.mjs';

test('parses task sequence, requirements, scope, and planning events', () => {
  const issue = {
    number: 7,
    created_at: '2026-01-01T08:00:00Z',
    body: `<!-- newax-planning-plan
plan-id: PLAN-7
declared-scope: src,docs
architecture-review-required: yes
-->
## Requirements
- [ ] REQ-1 Add audit evidence paths=src/audit/**
- [x] REQ-2 Keep compatibility
## Task sequence
- TASK-1 | order=1 | depends=none | estimate=60 | scope=src | architecture-review=yes | migration=no | dependency=no | requirements=REQ-1
- TASK-2 | order=2 | depends=TASK-1 | estimate=30 | scope=docs | architecture-review=no | migration=no | dependency=no | requirements=REQ-2`,
  };
  const comments = [
    {
      created_at: '2026-01-01T09:00:00Z',
      body: `<!-- newax-planning-event
event: architecture-reviewed
task-id: TASK-1
status: approved
reviewer: architect
-->`,
    },
  ];
  const plan = parsePlanningIssue(issue, comments);
  assert.equal(plan.planId, 'PLAN-7');
  assert.deepEqual(plan.declaredScopePaths, ['src', 'docs']);
  assert.equal(plan.tasks[1].dependsOn[0], 'TASK-1');
  assert.equal(plan.requirements[0].requiredPaths[0], 'src/audit/**');
  assert.equal(plan.requirements[1].satisfied, true);
  assert.equal(plan.events[0].type, 'architecture-reviewed');
  assert.equal(plan.events[0].at, '2026-01-01T09:00:00Z');
});

test('parses issue-form headings when metadata is absent', () => {
  const plan = parsePlanningIssue({
    number: 9,
    body: `### Declared scope paths
src/**
docs/plan.md

### Requirements
- [ ] REQ-9 Deliver the plan

### Task sequence
- TASK-9 | order=1 | depends=none | estimate=15 | scope=docs/plan.md | architecture-review=no | migration=no | dependency=no | requirements=REQ-9`,
  });
  assert.deepEqual(plan.declaredScopePaths, ['src/**', 'docs/plan.md']);
  assert.equal(plan.tasks[0].id, 'TASK-9');
});

test('parses planning issue references from the PR field and fallback prose', () => {
  assert.deepEqual(parsePlanningIssueNumbers('- Planning issues: `#7, #9`'), [7, 9]);
  assert.deepEqual(parsePlanningIssueNumbers('Planning issue #12'), [12]);
});

test('collects commit and issue history through a bounded GitHub adapter', async () => {
  const responses = new Map([
    [
      '/pulls/11/commits',
      [
        {
          sha: 'abc',
          commit: {
            message: 'Implement',
            author: { date: '2026-01-01T10:00:00Z' },
          },
        },
      ],
    ],
    [
      '/commits/abc',
      {
        commit: {
          message: 'Implement',
          author: { date: '2026-01-01T10:00:00Z' },
          committer: { date: '2026-01-01T10:01:00Z' },
        },
        files: [{ filename: 'src/a.ts', status: 'added', patch: '+export const a = 1;' }],
      },
    ],
    [
      '/issues/7',
      {
        number: 7,
        body: `<!-- newax-planning-plan
declared-scope: src
-->
## Requirements
- [x] REQ-1 Implement
## Task sequence
- TASK-1 | order=1 | depends=none | estimate=30 | scope=src | architecture-review=no | migration=no | dependency=no | requirements=REQ-1`,
      },
    ],
    ['/issues/7/comments', []],
  ]);
  const request = async (path) => {
    if (!responses.has(path)) throw new Error(`Unexpected path ${path}`);
    return responses.get(path);
  };
  const result = await collectPlanningHistory({
    pullRequest: { number: 11, draft: false, body: '- Planning issues: #7' },
    request,
  });
  assert.equal(result.phase, 'review');
  assert.equal(result.commits[0].files[0].filename, 'src/a.ts');
  assert.equal(result.tasks[0].id, 'TASK-1');
  assert.deepEqual(result.declaredScopePaths, ['src']);
});
