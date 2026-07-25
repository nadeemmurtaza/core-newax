import { readFileSync } from 'node:fs';

import { githubRequest, listAll } from './engineering-learning-core.mjs';
import { parsePlanningIssueNumbers } from './planning-history-github.mjs';

const MARKER_PATTERN = /\n?<!-- newax-planning-evidence-refresh\nissue-number: (\d+)\nsource-id: ([^\n]+)\n-->\n?/g;

export function pullRequestLinksPlanningIssue(body, issueNumber) {
  const number = Number(issueNumber);
  return Number.isSafeInteger(number) && parsePlanningIssueNumbers(body).includes(number);
}

export function refreshPlanningEvidenceMarker(body, { issueNumber, sourceId }) {
  const number = Number(issueNumber);
  if (!Number.isSafeInteger(number)) {
    throw new TypeError('issueNumber must be an integer.');
  }
  const source = String(sourceId ?? '').trim();
  if (source.length === 0) {
    throw new TypeError('sourceId is required.');
  }
  const retained = String(body ?? '')
    .replace(MARKER_PATTERN, (marker, markerIssue) =>
      Number(markerIssue) === number ? '' : marker,
    )
    .trimEnd();
  return `${retained}\n\n<!-- newax-planning-evidence-refresh\nissue-number: ${number}\nsource-id: ${source}\n-->\n`;
}

export function linkedPullRequests(pullRequests, issueNumber) {
  return (pullRequests ?? []).filter((pullRequest) =>
    pullRequestLinksPlanningIssue(pullRequest.body ?? '', issueNumber),
  );
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    throw new Error('GITHUB_EVENT_PATH is unavailable.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  if (event.issue?.pull_request !== undefined) {
    return;
  }
  const issueNumber = Number(event.issue?.number);
  if (!Number.isSafeInteger(issueNumber)) {
    throw new Error('The issue event does not contain an issue number.');
  }
  const sourceId = [
    process.env.GITHUB_EVENT_NAME ?? 'issue',
    event.action ?? 'updated',
    event.comment?.id ?? 'issue',
    event.comment?.updated_at ?? event.issue?.updated_at ?? 'unknown-time',
  ].join(':');
  const pullRequests = await listAll('/pulls?state=open');
  for (const pullRequest of linkedPullRequests(pullRequests, issueNumber)) {
    const body = refreshPlanningEvidenceMarker(pullRequest.body ?? '', {
      issueNumber,
      sourceId,
    });
    if (body === pullRequest.body) {
      continue;
    }
    await githubRequest(`/pulls/${pullRequest.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
    console.log(`Revalidation requested for PR #${pullRequest.number} from planning issue #${issueNumber}.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
