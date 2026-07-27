#!/usr/bin/env node
import { collectRecurrenceHistory } from './recurrence-history-github.mjs';
import { parseRecurrenceIssueNumbers } from './recurrence-history-parser.mjs';
import { detectAllRecurrences } from './recurrence-detector.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!token || !repository || !eventPath) {
  throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_EVENT_PATH are required.');
}
const { readFileSync } = await import('node:fs');
const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const pullRequest = event.pull_request;
if (!pullRequest) {
  throw new Error('Pull request event is required.');
}
const issueNumbers = parseRecurrenceIssueNumbers(pullRequest.body ?? '');
if (issueNumbers.length === 0) {
  if (
    !pullRequest.draft &&
    /-\s*Learning issues:\s*(?!`?not-required)/i.test(pullRequest.body ?? '')
  ) {
    throw new Error('Review-ready pull request with learning issues requires recurrence records.');
  }
  process.stdout.write('No recurrence records are required.\n');
  process.exit(0);
}
const history = await collectRecurrenceHistory({ issueNumbers, token, repository });
const decisions = detectAllRecurrences(history, {
  currentPrNumber: pullRequest.number,
  reviewReady: !pullRequest.draft,
});
const blockers = decisions.filter((decision) => decision.blocker);
if (blockers.length > 0) {
  throw new Error(
    blockers
      .map(
        (decision) =>
          `Recurrence ${decision.rootCauseId} escalation ${decision.escalation} blocks review: ${decision.missingEvidence.join(' ') || decision.state}`,
      )
      .join('\n'),
  );
}
process.stdout.write(
  decisions.length === 0
    ? 'No confirmed current-PR recurrence was found.\n'
    : `${decisions.map((decision) => `${decision.rootCauseId}:${decision.state}:${decision.escalation}`).join(', ')}\n`,
);
