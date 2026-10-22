import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectExecutiveDashboardRecords,
  renderExecutiveDashboardInputRecord,
  renderExecutiveDashboardSnapshotRecord,
  validateExecutiveDashboardRecordPair,
} from './executive-dashboard-record.mjs';

const input = {
  snapshotAt: '2026-07-18T00:00:00Z',
  windowStart: '2026-07-01T00:00:00Z',
  windowEnd: '2026-07-18T00:00:00Z',
  period: 'week',
};

test('round-trips generated records', () => {
  const [pair] = collectExecutiveDashboardRecords(
    { body: renderExecutiveDashboardInputRecord('ED-1', input) },
    [{ body: renderExecutiveDashboardSnapshotRecord('ED-1', input) }],
  );
  assert.equal(validateExecutiveDashboardRecordPair(pair).length, 0);
});

test('detects missing snapshot', () => {
  const [pair] = collectExecutiveDashboardRecords(
    { body: renderExecutiveDashboardInputRecord('ED-2', input) },
    [],
  );
  assert.match(validateExecutiveDashboardRecordPair(pair).join('\n'), /snapshot is missing/);
});

test('detects altered snapshot receipt', () => {
  const body = renderExecutiveDashboardSnapshotRecord('ED-3', input);
  const record = JSON.parse(
    body.match(/<!-- newax-executive-dashboard-snapshot\n([\s\S]*?)\n-->/)[1],
  );
  record.snapshotDigest = 'tampered';
  const [pair] = collectExecutiveDashboardRecords(
    { body: renderExecutiveDashboardInputRecord('ED-3', input) },
    [{ body: `<!-- newax-executive-dashboard-snapshot\n${JSON.stringify(record)}\n-->` }],
  );
  assert.match(validateExecutiveDashboardRecordPair(pair).join('\n'), /digest does not match/);
});
