import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCommunicationEvents,
  parseCommunicationIssueNumbers,
} from './communication-history-parser.mjs';

function marker(lines) {
  return [['<', '!--', ' newax-communication-event'].join(''), ...lines, '-->'].join('\n');
}

test('parses structured communication marker fields', () => {
  const events = parseCommunicationEvents(
    marker([
      'communication-id: COM-1',
      'event: assumption',
      'topic: retention',
      'authority: implementer',
      'status: active',
      'value: 30-days',
      'requires-confirmation: yes',
      'applies-to: src,docs',
    ]),
    { source: 'issue:1', createdAt: '2026-01-01T09:00:00Z' },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'COM-1');
  assert.deepEqual(events[0].appliesTo, ['src', 'docs']);
  assert.equal(events[0].requiresConfirmation, 'yes');
});

test('parses issue-form heading output', () => {
  const events = parseCommunicationEvents(
    `### Communication ID
COM-2

### Event type
Decision

### Topic
storage

### Authority
Architect

### Status
Confirmed

### Value or interpretation
postgres

### Applies to
src/storage`,
    { source: 'issue:2' },
  );
  assert.equal(events[0].id, 'COM-2');
  assert.equal(events[0].value, 'postgres');
});

test('parses communication issue references from pull request metadata', () => {
  assert.deepEqual(parseCommunicationIssueNumbers('- Communication issues: `#12, #14`'), [12, 14]);
});

test('ignores unstructured prose', () => {
  assert.deepEqual(parseCommunicationEvents('I think the client meant CSV.'), []);
});
