import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExecutiveDashboardGovernance } from './executive-dashboard-governance.mjs';
import {
  collectExecutiveDashboardRecords,
  renderExecutiveDashboardInputRecord,
  renderExecutiveDashboardSnapshotRecord,
} from './executive-dashboard-record.mjs';

const input = {
  snapshotAt: '2026-07-18T00:00:00Z',
  windowStart: '2026-07-01T00:00:00Z',
  windowEnd: '2026-07-18T00:00:00Z',
  period: 'week',
};
function pair() {
  return collectExecutiveDashboardRecords(
    { body: renderExecutiveDashboardInputRecord('ED-1', input) },
    [{ body: renderExecutiveDashboardSnapshotRecord('ED-1', input) }],
  )[0];
}

test('draft dashboard changes may remain without record', () => {
  assert.deepEqual(
    evaluateExecutiveDashboardGovernance({
      draft: true,
      body: '',
      changedFiles: ['tooling/executive-dashboard.mjs'],
    }).errors,
    [],
  );
});

test('review-ready dashboard change requires linked record and acknowledgement', () => {
  const result = evaluateExecutiveDashboardGovernance({
    draft: false,
    body: '',
    changedFiles: ['tooling/executive-dashboard.mjs'],
  });
  assert.match(result.errors.join('\n'), /linked dashboard record/);
  assert.match(result.errors.join('\n'), /Manual KPI values supplied/);
});

test('recalculated linked record passes', () => {
  const result = evaluateExecutiveDashboardGovernance({
    draft: false,
    body: '- Executive dashboard records: `#123`\n- Manual KPI values supplied: `no`',
    changedFiles: ['tooling/executive-dashboard.mjs'],
    recordPairs: [pair()],
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.issueNumbers, [123]);
});

test('manual KPI values are rejected', () => {
  const result = evaluateExecutiveDashboardGovernance({
    draft: true,
    body: '- Manual KPI values supplied: `yes`',
  });
  assert.match(result.errors.join('\n'), /prohibited/);
});

test('unrelated change requires no dashboard record', () => {
  const result = evaluateExecutiveDashboardGovernance({
    draft: false,
    body: '',
    changedFiles: ['apps/api/src/route.ts'],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.relevant, false);
});
