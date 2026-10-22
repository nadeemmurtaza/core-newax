import assert from 'node:assert/strict';
import test from 'node:test';

import { collectRecurrenceHistory } from './recurrence-history-github.mjs';

function request(path) {
  if (path === '/issues/17') {
    return Promise.resolve({ number: 17, body: '' });
  }
  if (path.startsWith('/issues/17/comments')) {
    return Promise.resolve([]);
  }
  throw new Error(`Unexpected path ${path}`);
}

test('collects a bounded issue history', async () => {
  const history = await collectRecurrenceHistory({ issueNumbers: [17], request });
  assert.deepEqual(history, { occurrences: [], rules: [], explanations: [] });
});

test('deduplicates issue numbers before collection', async () => {
  let reads = 0;
  const counting = async (path) => {
    if (path === '/issues/17') {
      reads += 1;
    }
    return request(path);
  };
  await collectRecurrenceHistory({ issueNumbers: [17, 17], request: counting });
  assert.equal(reads, 1);
});
