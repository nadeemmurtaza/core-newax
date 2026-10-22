import assert from 'node:assert/strict';
import test from 'node:test';

import { collectAiToolHistory } from './ai-tool-history-github.mjs';

const marker = (id, type, outputId) =>
  `<!-- newax-ai-quality-event\nevent-id: ${id}\nevent: ${type}\noutput-id: ${outputId}\nstatus: verified\n-->`;

test('collects structured evidence from PR, linked issues, comments, reviews and commits', async () => {
  const responses = new Map([
    ['/pulls/12/commits', [{ sha: 'abc', commit: { message: 'generated change' } }]],
    [
      '/commits/abc',
      {
        commit: {
          message: 'generated change',
          author: { date: '2026-07-17T10:00:00Z' },
          committer: { date: '2026-07-17T10:00:00Z' },
        },
        files: [{ filename: 'tooling/example.mjs', status: 'added' }],
      },
    ],
    ['/issues/12/comments', [{ id: 1, body: marker('COMMENT-1', 'correction', 'OUT-1') }]],
    ['/pulls/12/comments', [{ id: 2, body: marker('INLINE-1', 'static-analysis', 'OUT-1') }]],
    ['/pulls/12/reviews', [{ id: 3, body: marker('REVIEW-1', 'policy-violation', 'OUT-1') }]],
    ['/issues/233', { number: 233, body: marker('ISSUE-1', 'ai-output', 'OUT-1') }],
    [
      '/issues/233/comments',
      [{ id: 4, body: marker('ISSUE-COMMENT-1', 'regression-test', 'OUT-1') }],
    ],
  ]);
  const request = async (path) => responses.get(path) ?? [];
  const history = await collectAiToolHistory({
    pullRequest: {
      number: 12,
      draft: true,
      body: `- AI quality issues: #233\n${marker('PR-1', 'documentation-use', 'OUT-1')}`,
      head: { sha: 'head' },
      base: { sha: 'base' },
    },
    request,
  });
  assert.equal(history.phase, 'draft');
  assert.deepEqual(history.aiQualityIssues, [233]);
  assert.equal(history.commits.length, 1);
  assert.deepEqual(
    history.events.map((event) => event.id).sort(),
    ['COMMENT-1', 'INLINE-1', 'ISSUE-1', 'ISSUE-COMMENT-1', 'PR-1', 'REVIEW-1'].sort(),
  );
});
