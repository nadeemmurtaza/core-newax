import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutiveDashboard } from './executive-dashboard.mjs';

const base = {
  snapshotAt: '2026-07-18T00:00:00Z',
  windowStart: '2026-07-01T00:00:00Z',
  windowEnd: '2026-07-18T00:00:00Z',
  period: 'week',
};

function occurrence(id, rootCauseId, at, extra = {}) {
  return {
    id,
    rootCauseId,
    category: 'planning',
    status: 'confirmed',
    occurredAt: at,
    sourceId: id,
    sourceRefs: [`issue:${id}`],
    ...extra,
  };
}

test('missing evidence remains missing rather than zero', () => {
  const snapshot = buildExecutiveDashboard(base);
  assert.equal(snapshot.metrics.mostExpensiveCategories.status, 'insufficient-evidence');
  assert.equal(snapshot.metrics.timeLostByCategory.value, null);
});

test('recurring root causes use distinct exact identities', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    occurrences: [
      occurrence('a', 'ROOT-X', '2026-07-02T00:00:00Z'),
      occurrence('b', 'ROOT-X', '2026-07-03T00:00:00Z'),
    ],
  });
  assert.equal(snapshot.metrics.topRecurringRootCauses.value[0].occurrences, 2);
});

test('different currencies remain separate', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    costRecords: [
      {
        id: 'p',
        category: 'planning',
        amountMinor: 100,
        currency: 'PKR',
        status: 'verified',
        at: '2026-07-02T00:00:00Z',
        sourceRefs: ['invoice:p'],
      },
      {
        id: 'u',
        category: 'planning',
        amountMinor: 100,
        currency: 'USD',
        status: 'verified',
        at: '2026-07-02T00:00:00Z',
        sourceRefs: ['invoice:u'],
      },
    ],
  });
  assert.equal(snapshot.metrics.mostExpensiveCategories.value.length, 2);
});

test('recent rules are excluded from prevention denominator', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    minimumObservationDays: 14,
    rules: [
      {
        id: 'r',
        rootCauseId: 'ROOT-X',
        state: 'enforced',
        effectiveAt: '2026-07-17T00:00:00Z',
        sourceRefs: ['rule:r'],
      },
    ],
  });
  assert.equal(snapshot.metrics.preventionEffectiveness.denominator, 0);
});

test('control failure is not classified as ignored rule', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    recurrenceDecisions: [
      {
        id: 'd',
        rootCauseId: 'ROOT-X',
        occurrenceId: 'o',
        occurredAt: '2026-07-05T00:00:00Z',
        ruleId: 'r',
        disposition: 'control-failed',
        state: 'detected',
        escalation: 'high',
        sourceRefs: ['issue:1'],
      },
    ],
  });
  assert.equal(snapshot.metrics.rulesFrequentlyIgnored.value.length, 0);
  assert.equal(snapshot.metrics.rulesFrequentlyIgnored.details.excludedControlFailures, 1);
});

test('AI accuracy excludes unreviewed outputs', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    aiRecords: [{ id: 'a', at: '2026-07-02T00:00:00Z', outcome: 'correct', sourceRefs: ['ai:a'] }],
  });
  assert.equal(snapshot.metrics.aiAccuracyTrend.status, 'insufficient-evidence');
});

test('reversed lifecycle timestamps are rejected', () => {
  assert.throws(
    () =>
      buildExecutiveDashboard({
        ...base,
        occurrences: [
          occurrence('a', 'ROOT-X', '2026-07-03T00:00:00Z', { detectedAt: '2026-07-02T00:00:00Z' }),
        ],
      }),
    /cannot precede/,
  );
});

test('human review exposes coverage and escaped findings', () => {
  const snapshot = buildExecutiveDashboard({
    ...base,
    reviewRecords: [
      {
        id: 'r',
        prNumber: 7,
        at: '2026-07-03T00:00:00Z',
        reviewed: true,
        validFindings: 2,
        resolvedBeforeMerge: 1,
        escapedFindings: 1,
        reviewer: 'human',
        sourceRefs: ['review:7'],
      },
    ],
  });
  assert.equal(snapshot.metrics.humanReviewEffectiveness.value, 50);
  assert.equal(snapshot.metrics.humanReviewEffectiveness.details.escapedFindings, 1);
});
