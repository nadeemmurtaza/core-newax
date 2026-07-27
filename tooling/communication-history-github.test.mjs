import assert from 'node:assert/strict';
import test from 'node:test';

import { collectCommunicationHistory } from './communication-history-github.mjs';

function marker(lines) {
  return [['<', '!--', ' newax-communication-event'].join(''), ...lines, '-->'].join('\n');
}

test('collects commits plus issue, comment, and review events', async () => {
  const responses = new Map([
    ['/pulls/7/commits', [{ sha: 'abc' }]],
    [
      '/commits/abc',
      {
        commit: {
          message: 'Build',
          author: { date: '2026-01-01T10:00:00Z' },
          committer: { date: '2026-01-01T10:00:00Z' },
        },
        files: [{ filename: 'src/a.ts', status: 'added' }],
      },
    ],
    [
      '/issues/7/comments',
      [
        {
          id: 71,
          created_at: '2026-01-01T09:30:00Z',
          body: marker([
            'communication-id: COM-C',
            'event: clarification',
            'topic: export',
            'authority: owner',
            'status: confirmed',
            'value: xlsx',
            'applies-to: src',
          ]),
        },
      ],
    ],
    ['/pulls/7/comments', []],
    [
      '/pulls/7/reviews',
      [
        {
          id: 72,
          submitted_at: '2026-01-01T09:40:00Z',
          body: marker([
            'communication-id: COM-A',
            'event: approval',
            'topic: export',
            'authority: approver',
            'status: approved',
            'value: proceed',
            'applies-to: src',
          ]),
        },
      ],
    ],
    [
      '/issues/12',
      {
        number: 12,
        created_at: '2026-01-01T09:00:00Z',
        body: marker([
          'communication-id: COM-R',
          'event: requirement',
          'topic: export',
          'authority: owner',
          'status: active',
          'value: xlsx',
          'applies-to: src',
        ]),
      },
    ],
    ['/issues/12/comments', []],
  ]);
  const request = async (path) => responses.get(path) ?? [];
  const history = await collectCommunicationHistory({
    pullRequest: {
      number: 7,
      draft: true,
      body: '- Communication issues: `#12`',
      head: { sha: 'abc' },
      base: { sha: 'base' },
    },
    request,
  });
  assert.equal(history.commits.length, 1);
  assert.deepEqual(history.communicationIssues, [12]);
  assert.deepEqual(history.events.map((event) => event.id).sort(), ['COM-A', 'COM-C', 'COM-R']);
});
