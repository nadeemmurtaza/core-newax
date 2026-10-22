import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseRecurrenceHistory,
  parseRecurrenceIssueNumbers,
} from './recurrence-history-parser.mjs';

test('parses engineering occurrences', () => {
  const issue = {
    number: 17,
    created_at: '2026-01-01T00:00:00Z',
    html_url: 'https://github.com/o/r/issues/17',
    body: `<!-- newax-engineering-event
fingerprint: abc
source-id: run-1
pr-number: 17
root-cause-id: ROOT-X
root-cause-status: confirmed
-->`,
  };
  const result = parseRecurrenceHistory(issue);
  assert.equal(result.occurrences.length, 1);
  assert.equal(result.occurrences[0].prNumber, 17);
});

test('parses explicit recurrence rule and explanation events', () => {
  const issue = { number: 1, created_at: '2026-01-01T00:00:00Z', body: '' };
  const comments = [
    {
      id: 2,
      body: `<!-- newax-recurrence-event
type: rule
id: RULE-X
root-cause-id: ROOT-X
state: enforced
effective-at: 2026-02-01T00:00:00Z
source-ref: rule:x
evidence-refs: issue:1
-->`,
    },
    {
      id: 3,
      body: `<!-- newax-recurrence-event
type: explanation
id: EXP-X
occurrence-id: OCC-X
disposition: control-failed
state: confirmed
reviewer: reviewer
evidence-refs: run:3
-->`,
    },
  ];
  const result = parseRecurrenceHistory(issue, comments);
  assert.equal(result.rules.length, 1);
  assert.equal(result.explanations.length, 1);
});

test('parses resolved prevention events as effective rules', () => {
  const issue = {
    number: 1,
    body: `<!-- newax-prevention-event
event-id: P1
root-cause-id: ROOT-X
resolution-status: verified
resolved-at: 2026-02-01T00:00:00Z
prevention-control: Run the guard.
control-state: enforced
-->`,
  };
  const result = parseRecurrenceHistory(issue);
  assert.equal(result.rules[0].rootCauseId, 'ROOT-X');
  assert.equal(result.rules[0].state, 'enforced');
});

test('parses recurrence and learning issue references from PR body', () => {
  assert.deepEqual(
    parseRecurrenceIssueNumbers('- Recurrence records: #17, #31\n- Learning issues: #31, #49'),
    [17, 31, 49],
  );
});
