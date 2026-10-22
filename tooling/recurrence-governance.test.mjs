import assert from 'node:assert/strict';
import test from 'node:test';

import { detectAllRecurrences, detectRecurrence } from './recurrence-detector.mjs';
import { parseRecurrenceIssueNumbers } from './recurrence-history-parser.mjs';

function event(id, rootCauseId, prNumber, occurredAt) {
  return { id, rootCauseId, status: 'confirmed', occurredAt, prNumber, sourceId: id };
}
function governed(reviewReady) {
  return detectRecurrence(
    {
      occurrences: [
        event('a', 'ROOT-X', 1, '2026-01-01T00:00:00Z'),
        event('b', 'ROOT-X', 2, '2026-03-01T00:00:00Z'),
      ],
      rules: [
        {
          id: 'r',
          rootCauseId: 'ROOT-X',
          state: 'enforced',
          effectiveAt: '2026-02-01T00:00:00Z',
          sourceRef: 'rule:r',
        },
      ],
      currentOccurrenceId: 'b',
    },
    { reviewReady },
  );
}

test('draft mode remains nonblocking', () => {
  const decision = governed(false);
  assert.equal(decision.state, 'insufficient-evidence');
  assert.equal(decision.blocker, false);
});

test('ready mode applies the generated blocker', () => {
  assert.equal(governed(true).blocker, true);
});

test('not-required field has no references', () => {
  assert.deepEqual(parseRecurrenceIssueNumbers('- Recurrence records: `not-required`'), []);
});

test('evaluates every current PR root', () => {
  const decisions = detectAllRecurrences(
    {
      occurrences: [
        event('a1', 'ROOT-A', 1, '2026-01-01T00:00:00Z'),
        event('a2', 'ROOT-A', 9, '2026-03-01T00:00:00Z'),
        event('b1', 'ROOT-B', 2, '2026-02-01T00:00:00Z'),
        event('b2', 'ROOT-B', 9, '2026-04-01T00:00:00Z'),
      ],
    },
    { currentPrNumber: 9 },
  );
  assert.deepEqual(
    decisions.map((entry) => entry.rootCauseId),
    ['ROOT-A', 'ROOT-B'],
  );
});

test('excludes old roots absent from current PR', () => {
  const decisions = detectAllRecurrences(
    {
      occurrences: [
        event('a1', 'ROOT-A', 1, '2026-01-01T00:00:00Z'),
        event('b1', 'ROOT-B', 9, '2026-02-01T00:00:00Z'),
      ],
    },
    { currentPrNumber: 9 },
  );
  assert.deepEqual(
    decisions.map((entry) => entry.rootCauseId),
    ['ROOT-B'],
  );
});
