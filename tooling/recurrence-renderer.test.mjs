import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRecurrence } from './recurrence-detector.mjs';
import { renderRecurrenceReport } from './recurrence-renderer.mjs';

function item(id, prNumber, occurredAt) {
  return { id, rootCauseId: 'ROOT-X', status: 'confirmed', occurredAt, prNumber, sourceId: id };
}

test('renders prior PR and generated decision metadata', () => {
  const decision = detectRecurrence({
    occurrences: [item('a', 17, '2026-01-01T00:00:00Z'), item('b', 31, '2026-02-01T00:00:00Z')],
    currentOccurrenceId: 'b',
  });
  const report = renderRecurrenceReport(decision);
  assert.match(report, /PR #17/);
  assert.match(report, new RegExp(decision.digest));
});

test('renders applicable rule and unresolved evidence state', () => {
  const decision = detectRecurrence({
    occurrences: [item('a', 17, '2026-01-01T00:00:00Z'), item('b', 31, '2026-03-01T00:00:00Z')],
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
  });
  const report = renderRecurrenceReport(decision);
  assert.match(report, /Rule: `r`/);
  assert.match(report, new RegExp(decision.state));
});

test('does not request a control-gap explanation when no rule existed', () => {
  const decision = detectRecurrence({
    occurrences: [item('a', 17, '2026-01-01T00:00:00Z'), item('b', 31, '2026-02-01T00:00:00Z')],
    currentOccurrenceId: 'b',
  });
  const report = renderRecurrenceReport(decision);
  assert.match(report, /Not required because no applicable effective rule existed/);
  assert.doesNotMatch(report, /Missing\. Why was the applicable rule/);
});
