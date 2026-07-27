import assert from 'node:assert/strict';
import test from 'node:test';

import { collectPreventionHistory } from './prevention-history-github.mjs';

function request(path) {
  const responses = {
    '/pulls/20/commits': [
      {
        sha: 'c'.repeat(40),
        commit: { committer: { date: '2026-07-17T12:00:00Z' } },
      },
    ],
    [`/commits/${'c'.repeat(40)}`]: {
      commit: { committer: { date: '2026-07-17T12:00:00Z' } },
      files: [{ filename: '.newax/prevention/ci/root-x.json', status: 'added' }],
    },
    '/issues/10': {
      number: 10,
      body: `<!-- newax-prevention-event
event-id: E-10
root-cause-id: ROOT-X
root-cause-status: confirmed
resolution-status: verified
resolved-at: 2026-07-17T12:00:00Z
fix-commit: ${'a'.repeat(40)}
reviewer: reviewer
reviewed-at: 2026-07-17T12:05:00Z
verification-refs: workflow:1
regression-refs: test:one
prevention-control: Require regression evidence.
ci-owner: platform
ci-reviewer: reviewer
ci-implementation-ref: tooling/check.mjs
ci-verification-refs: workflow:2
-->`,
    },
    '/issues/10/comments': [],
  };
  return Promise.resolve(responses[path]);
}

test('collects linked resolved mistakes and changed files', async () => {
  const history = await collectPreventionHistory({
    pullRequest: {
      number: 20,
      draft: false,
      body: '- Prevention records: `#10`',
      head: { sha: 'h'.repeat(40) },
      base: { sha: 'b'.repeat(40) },
    },
    request,
  });
  assert.equal(history.phase, 'review');
  assert.equal(history.mistakes.length, 1);
  assert.deepEqual(history.changedFiles, ['.newax/prevention/ci/root-x.json']);
  assert.equal(history.controlOptions['ROOT-X'].controls['ci-check'].owner, 'platform');
});
