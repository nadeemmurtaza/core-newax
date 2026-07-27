import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRecurrence, validateRecurrenceDecision } from './recurrence-detector.mjs';

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

test('same exact occurrence under different record IDs is counted once', () => {
  const first = occurrence('a-id', 17, '2026-01-01T00:00:00Z', { fingerprint: 'same' });
  const second = { ...first, id: 'b-id' };
  const decision = detectRecurrence({ occurrences: [first, second] });
  assert.equal(decision.counts.all, 1);
});

test('previous escalation evidence is included in recalculable digest', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences.slice(0, 3),
    rules: [rule()],
    explanations: [explanation('o49', { disposition: 'not-integrated' })],
    previousEscalations: [{ level: 'high', state: 'detected' }],
    currentOccurrenceId: 'o49',
  });
  assert.deepEqual(validateRecurrenceDecision(decision), []);
});

test('approved bypass cannot be authorized after the occurrence', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences,
    rules: [rule()],
    explanations: [
      explanation('o63', {
        disposition: 'bypassed-with-approval',
        state: 'waived',
        approver: 'owner',
        reason: 'late approval',
        scope: 'PR #63',
        effectiveAt: '2026-06-01T00:00:00Z',
      }),
    ],
    currentOccurrenceId: 'o63',
  });
  assert.equal(decision.state, 'insufficient-evidence');
  assert.match(decision.missingEvidence.join('\n'), /no later than the occurrence/);
});

test('empty decision remains recalculable', () => {
  const decision = detectRecurrence({ occurrences: [] });
  assert.deepEqual(validateRecurrenceDecision(decision), []);
});

test('rule requires durable evidence', () => {
  assert.throws(
    () =>
      detectRecurrence({
        occurrences: baseOccurrences,
        rules: [
          {
            id: 'r',
            rootCauseId: 'ROOT-X',
            state: 'enforced',
            effectiveAt: '2026-03-01T00:00:00Z',
          },
        ],
      }),
    /durable source reference/,
  );
});

test('explanation requires reviewer and reason', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences,
    rules: [rule()],
    explanations: [explanation('o63', { reviewer: null, reason: null })],
    currentOccurrenceId: 'o63',
  });
  assert.match(decision.missingEvidence.join('\n'), /reviewer/);
  assert.match(decision.missingEvidence.join('\n'), /reason/);
});

test('generated rule does not apply enforced-control high-risk floor', () => {
  const decision = detectRecurrence({
    occurrences: baseOccurrences.slice(0, 3),
    rules: [rule({ state: 'generated' })],
    explanations: [explanation('o49', { disposition: 'not-executed' })],
    currentOccurrenceId: 'o49',
  });
  assert.equal(decision.escalation, 'warning');
});
