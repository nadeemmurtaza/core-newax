import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRecurrence } from './recurrence-detector.mjs';
import {
  collectRecurrenceRecord,
  renderRecurrenceDecisionRecord,
  renderRecurrenceInputRecord,
  validateRecurrenceRecord,
} from './recurrence-record.mjs';

const input = {
  recordId: 'REC-1',
  currentOccurrenceId: 'b',
  occurrences: [
    {
      id: 'a',
      rootCauseId: 'ROOT-X',
      status: 'confirmed',
      occurredAt: '2026-01-01T00:00:00Z',
      prNumber: 1,
      sourceId: 'a',
    },
    {
      id: 'b',
      rootCauseId: 'ROOT-X',
      status: 'confirmed',
      occurredAt: '2026-02-01T00:00:00Z',
      prNumber: 2,
      sourceId: 'b',
    },
  ],
};

test('input and decision records round trip', () => {
  const decision = detectRecurrence(input);
  const record = collectRecurrenceRecord({ body: renderRecurrenceInputRecord(input) }, [
    { body: renderRecurrenceDecisionRecord(decision) },
  ]);
  assert.deepEqual(validateRecurrenceRecord(record), []);
});

test('missing input is rejected', () => {
  assert.deepEqual(validateRecurrenceRecord({ input: null, decision: null }), [
    'Recurrence input record is missing.',
  ]);
});

test('missing decision is rejected', () => {
  const record = collectRecurrenceRecord({ body: renderRecurrenceInputRecord(input) }, []);
  assert.deepEqual(validateRecurrenceRecord(record), ['Recurrence decision record is missing.']);
});

test('altered stored decision is rejected', () => {
  const decision = detectRecurrence(input);
  const record = collectRecurrenceRecord({ body: renderRecurrenceInputRecord(input) }, [
    { body: renderRecurrenceDecisionRecord({ ...decision, digest: 'bad' }) },
  ]);
  assert.match(validateRecurrenceRecord(record).join('\n'), /digest|recalculated/);
});
