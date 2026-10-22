import assert from 'node:assert/strict';
import test from 'node:test';
import { collectExecutiveDashboardGithub } from './executive-dashboard-history-github.mjs';

function request(routes) {
  return async (path) =>
    routes[path.replace(/([?&])per_page=100&page=\d+/, '').replace(/\?$/, '')] ?? [];
}

test('pre-step workflow is blocked rather than failed engineering', async () => {
  const result = await collectExecutiveDashboardGithub({
    request: request({
      '/issues?state=all': [],
      '/pulls?state=all': [],
      '/actions/runs': [
        {
          id: 10,
          name: 'Pull Request Governance',
          conclusion: 'failure',
          updated_at: '2026-07-03T00:00:00Z',
          pull_requests: [],
        },
      ],
      '/actions/runs/10/jobs?per_page=100': { jobs: [{ steps: null }] },
    }),
  });
  assert.equal(result.governanceRecords[0].conclusion, 'blocked');
  assert.equal(result.governanceRecords[0].executed, false);
});

test('unrelated workflows are excluded', async () => {
  const result = await collectExecutiveDashboardGithub({
    request: request({
      '/issues?state=all': [],
      '/pulls?state=all': [],
      '/actions/runs': [{ id: 12, name: 'Publish documentation', conclusion: 'success' }],
    }),
  });
  assert.equal(result.governanceRecords.length, 0);
});

test('collector requires a request function', async () => {
  await assert.rejects(() => collectExecutiveDashboardGithub(), /request function/);
});
