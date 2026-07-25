import assert from 'node:assert/strict';
import test from 'node:test';

import {
  linkedPullRequests,
  pullRequestLinksPlanningIssue,
  refreshPlanningEvidenceMarker,
} from './revalidate-planning-pull-requests.mjs';

test('matches only pull requests that explicitly link the planning issue', () => {
  assert.equal(pullRequestLinksPlanningIssue('- Planning issues: `#7, #9`', 7), true);
  assert.equal(pullRequestLinksPlanningIssue('- Planning issues: `#7, #9`', 8), false);
  assert.equal(pullRequestLinksPlanningIssue('- Planning issues: `not-required`', 7), false);
  assert.equal(
    pullRequestLinksPlanningIssue(
      '- Planning issues: `#123`, comma-separated issues, or `not-required` only for an explicitly exempt maintenance change',
      123,
    ),
    false,
  );
});

test('replaces only the marker for the changed planning issue', () => {
  const original = `Body\n\n<!-- newax-planning-evidence-refresh\nissue-number: 7\nsource-id: old\n-->\n\n<!-- newax-planning-evidence-refresh\nissue-number: 9\nsource-id: keep\n-->\n`;
  const updated = refreshPlanningEvidenceMarker(original, {
    issueNumber: 7,
    sourceId: 'issues:edited:issue:2026-07-25T22:30:00Z',
  });
  assert.match(updated, /issue-number: 7\nsource-id: issues:edited/);
  assert.match(updated, /issue-number: 9\nsource-id: keep/);
  assert.equal((updated.match(/issue-number: 7/g) ?? []).length, 1);
});

test('filters open pull requests through the shared planning parser', () => {
  const pullRequests = [
    { number: 1, body: '- Planning issues: #7' },
    { number: 2, body: '- Planning issues: #8' },
    { number: 3, body: '- Planning issues: not-required' },
  ];
  assert.deepEqual(
    linkedPullRequests(pullRequests, 7).map((pullRequest) => pullRequest.number),
    [1],
  );
});
