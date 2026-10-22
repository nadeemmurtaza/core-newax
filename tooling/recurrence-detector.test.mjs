import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRecurrence } from './recurrence-detector.mjs';

function occurrence(id, prNumber, occurredAt, overrides = {}) {
  return {
    id,
    rootCauseId: 'ROOT-X',
    status: 'confirmed',
    occurredAt,
    prNumber,
    sourceId: `issue-${prNumber}`,
    evidenceRefs: [`issue:${prNumber}`],
    ...overrides,
  };
}
function rule(overrides = {}) {
  return {
    id: 'RULE-X',
    rootCauseId: 'ROOT-X',
    state: 'enforced',
    effectiveAt: '2026-03-01T00:00:00Z',
    sourceRef: 'prevention:ROOT-X',
    evidenceRefs: ['rule:ROOT-X'],
    ...overrides,
  };
}
function explanation(occurrenceId, overrides = {}) {
  return {
    id: `EXP-${occurrenceId}`,
    occurrenceId,
    disposition: 'not-executed',
    state: 'confirmed',
    reviewer: 'reviewer',
    reason: 'bounded evidence-backed control gap',
    evidenceRefs: [`evidence:${occurrenceId}`],
    ...overrides,
  };
}
const baseOccurrences = [
  occurrence('o17', 17, '2026-01-01T00:00:00Z'),
  occurrence('o31', 31, '2026-02-01T00:00:00Z'),
  occurrence('o49', 49, '2026-04-01T00:00:00Z'),
  occurrence('o63', 63, '2026-05-01T00:00:00Z'),
];

test('lists previous PRs chronologically for the same confirmed root cause', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences,
    rules: [rule()],
    explanations: [explanation('o63')],
    currentOccurrenceId: 'o63',
  });
  assert.deepEqual(
    decision.previousOccurrences.map((entry) => entry.prNumber),
    [17, 31, 49],
  );
  assert.equal(decision.counts.all, 4);
});

test('pre-rule occurrences remain history rather than violations', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences,
    rules: [rule()],
    explanations: [explanation('o63')],
    currentOccurrenceId: 'o63',
  });
  assert.equal(decision.counts.preRule, 2);
  assert.equal(decision.counts.postRule, 2);
});

test('first post-rule recurrence warns', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences.slice(0, 3),
    rules: [rule()],
    explanations: [explanation('o49', { disposition: 'not-integrated' })],
    currentOccurrenceId: 'o49',
  });
  assert.equal(decision.escalation, 'warning');
});

test('second post-rule recurrence escalates high', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences,
    rules: [rule()],
    explanations: [explanation('o63', { disposition: 'not-integrated' })],
    currentOccurrenceId: 'o63',
  });
  assert.equal(decision.escalation, 'high');
});

test('third post-rule recurrence escalates critical', () => {
  const decision = detectRecurrence({
    occurrences: [...baseOccurrences, occurrence('o77', 77, '2026-06-01T00:00:00Z')],
    rules: [rule()],
    explanations: [explanation('o77', { disposition: 'not-integrated' })],
    currentOccurrenceId: 'o77',
  });
  assert.equal(decision.escalation, 'critical');
});

test('enforced control not executed raises at least high on first post-rule recurrence', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences.slice(0, 3),
    rules: [rule()],
    explanations: [explanation('o49')],
    currentOccurrenceId: 'o49',
  });
  assert.equal(decision.escalation, 'high');
});

test('no applicable rule observes recurrence without blaming noncompliance', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences.slice(0, 2),
    currentOccurrenceId: 'o31',
  });
  assert.equal(decision.state, 'observe');
  assert.equal(decision.escalation, 'observe');
  assert.equal(decision.missingEvidence.length, 0);
});

test('candidate classifications do not establish recurrence', () => {
  const decision = detectRecurrence({
    occurrences: [
      occurrence('a', 1, '2026-01-01T00:00:00Z'),
      occurrence('b', 2, '2026-02-01T00:00:00Z', { status: 'candidate' }),
    ],
  });
  assert.equal(decision.counts.all, 1);
  assert.equal(decision.state, 'clear');
});

test('different root-cause IDs do not recur even with same category', () => {
  const decision = detectRecurrence({
    occurrences: [
      occurrence('a', 1, '2026-01-01T00:00:00Z', { rootCauseId: 'ROOT-A' }),
      occurrence('b', 2, '2026-02-01T00:00:00Z', { rootCauseId: 'ROOT-B' }),
    ],
    currentOccurrenceId: 'b',
  });
  assert.equal(decision.previousOccurrences.length, 0);
});

test('re-ingestion with identical occurrence ID is deduplicated', () => {
  const decision = detectRecurrence({
    occurrences: [baseOccurrences[0], { ...baseOccurrences[0] }],
  });
  assert.equal(decision.counts.all, 1);
});

test('conflicting duplicate occurrence identity is rejected', () => {
  assert.throws(
    () =>
      detectRecurrence({
        occurrences: [baseOccurrences[0], { ...baseOccurrences[0], prNumber: 18 }],
      }),
    /conflicting content/,
  );
});
