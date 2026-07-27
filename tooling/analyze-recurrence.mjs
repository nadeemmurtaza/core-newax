#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { detectAllRecurrences, detectRecurrence } from './recurrence-detector.mjs';
import { collectRecurrenceHistory } from './recurrence-history-github.mjs';
import { parseRecurrenceIssueNumbers } from './recurrence-history-parser.mjs';
import { renderRecurrenceReport } from './recurrence-renderer.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const file = argument('--file');
const prNumber = Number(argument('--pr'));
const reviewReady = process.argv.includes('--review-ready');
let input;
if (file) {
  input = JSON.parse(readFileSync(file, 'utf8'));
} else if (Number.isSafeInteger(prNumber) && prNumber > 0) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
  }
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`Unable to read pull request ${prNumber}.`);
  }
  const pullRequest = await response.json();
  const issueNumbers = parseRecurrenceIssueNumbers(pullRequest.body ?? '');
  input = await collectRecurrenceHistory({ issueNumbers, token, repository });
  input.reviewReady = !pullRequest.draft;
} else {
  throw new Error('Use --file <path> or --pr <number>.');
}
const currentOccurrenceId = argument('--current-occurrence') ?? input.currentOccurrenceId;
const decisions = currentOccurrenceId
  ? [
      detectRecurrence(input, {
        currentOccurrenceId,
        reviewReady: reviewReady || input.reviewReady,
      }),
    ]
  : detectAllRecurrences(input, {
      currentPrNumber: Number.isSafeInteger(prNumber) && prNumber > 0 ? prNumber : null,
      reviewReady: reviewReady || input.reviewReady,
    });
process.stdout.write(`${decisions.map(renderRecurrenceReport).join('\n\n')}\n`);
if (
  decisions.some(
    (decision) =>
      decision.blocker ||
      (process.argv.includes('--require-resolved') &&
        !['clear', 'resolved', 'waived'].includes(decision.state)),
  )
) {
  process.exitCode = 1;
}
