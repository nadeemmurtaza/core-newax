import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyGithubExplanationEvidence } from './explanation-evidence-github.mjs';

const runs = new Map([
  [
    10,
    {
      id: 10,
      name: 'Continuous Integration',
      conclusion: 'failure',
      head_sha: 'a'.repeat(40),
    },
  ],
  [
    20,
    {
      id: 20,
      name: 'Continuous Integration',
      conclusion: 'success',
      head_sha: 'b'.repeat(40),
    },
  ],
]);
const commits = new Map([['c'.repeat(40), { sha: 'c'.repeat(40) }]]);
const jobs = new Map([
  [
    10,
    [
      {
        id: 11,
        name: 'Verify monorepo',
        conclusion: 'failure',
        steps: [{ name: 'Install dependencies', conclusion: 'failure' }],
      },
    ],
  ],
  [
    20,
    [
      {
        id: 21,
        name: 'Verify regression',
        conclusion: 'success',
        steps: [{ name: 'Run lockfile mismatch regression', conclusion: 'success' }],
      },
    ],
  ],
]);

async function githubRequest(path) {
  const run = path.match(/^\/actions\/runs\/(\d+)$/);
  if (run) {
    return runs.get(Number(run[1]));
  }
  const commit = path.match(/^\/commits\/([0-9a-f]{40})$/);
  if (commit) {
    return commits.get(commit[1]);
  }
  throw new Error(`unexpected path ${path}`);
}

async function listAll(path) {
  const run = path.match(/^\/actions\/runs\/(\d+)\/jobs$/);
  return run ? (jobs.get(Number(run[1])) ?? []) : [];
}

test('verifies failed log, exact commit, and successful reproducing-test provenance', async () => {
  const result = await verifyGithubExplanationEvidence({
    githubRequest,
    listAll,
    evidence: [
      {
        id: 'log',
        type: 'log',
        workflowRunId: 10,
        jobId: 11,
        stepName: 'Install dependencies',
      },
      { id: 'commit', type: 'commit', commitSha: 'c'.repeat(40) },
      {
        id: 'test',
        type: 'test',
        workflowRunId: 20,
        jobId: 21,
        stepName: 'Run lockfile mismatch regression',
        testName: 'lockfile mismatch regression',
        command: 'pnpm test:learning',
        reproduces: true,
        outcome: 'passed',
      },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.ok(result.evidence.every((item) => item.provenanceVerified === true));
  assert.equal(result.evidence[0].commitSha, 'a'.repeat(40));
  assert.equal(result.evidence[2].commitSha, 'b'.repeat(40));
  assert.equal(result.evidence[2].jobName, 'Verify regression');
});

test('downgrades unverified claims instead of trusting their declared status', async () => {
  const result = await verifyGithubExplanationEvidence({
    githubRequest,
    listAll,
    evidence: [
      {
        id: 'bad-log',
        type: 'log',
        status: 'verified',
        workflowRunId: 10,
        jobId: 11,
      },
      {
        id: 'bad-commit',
        type: 'commit',
        status: 'verified',
        commitSha: 'short',
      },
      {
        id: 'bad-test',
        type: 'test',
        status: 'verified',
        workflowRunId: 20,
        jobId: 21,
        stepName: 'Missing regression step',
        testName: 'test',
        command: 'pnpm test',
        reproduces: true,
        outcome: 'passed',
      },
    ],
  });

  assert.equal(result.errors.length, 3);
  assert.ok(result.evidence.every((item) => item.status === 'unavailable'));
});

test('does not accept a green workflow without the exact successful job and step', async () => {
  const result = await verifyGithubExplanationEvidence({
    githubRequest,
    listAll,
    evidence: [
      {
        id: 'weak-test',
        type: 'test',
        workflowRunId: 20,
        jobId: 999,
        stepName: 'Run lockfile mismatch regression',
        testName: 'lockfile mismatch regression',
        command: 'pnpm test:learning',
        reproduces: true,
        outcome: 'passed',
      },
    ],
  });

  assert.equal(result.evidence[0].status, 'unavailable');
  assert.match(result.errors[0], /not a successful job/);
});
