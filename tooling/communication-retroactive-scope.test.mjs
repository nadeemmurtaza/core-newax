import assert from 'node:assert/strict';
import test from 'node:test';

import { detectCommunicationMistakes } from './communication-mistake-detector.mjs';

test('later scope records do not attach earlier commits retroactively', () => {
  const result = detectCommunicationMistakes({
    commits: [
      {
        sha: 'a',
        timestamp: '2026-01-01T10:00:00Z',
        files: [{ filename: 'docs/a.md' }],
      },
    ],
    events: [
      {
        id: 'INT',
        type: 'interpretation',
        topic: 'storage',
        value: 'sqlite',
        authority: 'implementer',
        status: 'active',
        at: '2026-01-01T09:00:00Z',
        appliesTo: ['src'],
      },
      {
        id: 'DEC',
        type: 'decision',
        topic: 'storage',
        value: 'postgres',
        authority: 'architect',
        status: 'confirmed',
        at: '2026-01-01T11:00:00Z',
        appliesTo: ['docs'],
      },
    ],
  });
  const finding = result.findings.find((candidate) => candidate.type === 'wrong-interpretation');
  assert.equal(finding.state, 'suspected');
  assert.deepEqual(finding.missingEvidence, ['dependent-work']);
  assert.equal(result.blockers.length, 0);
});
