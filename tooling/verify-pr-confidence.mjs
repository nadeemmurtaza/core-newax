import { readFileSync } from 'node:fs';

import { collectConfidenceRecords, validateConfidenceRecordPair } from './confidence-record.mjs';
import {
  githubRequest,
  listAll,
  parseIssueNumbers,
  parsePullRequestField,
} from './engineering-learning-core.mjs';

const MANUAL_SCORE_PATTERN =
  /(?:^|\n)\s*(?:[-*]\s*)?(?:Root Cause Confidence|Duplicate Confidence|Evidence Quality|Explanation Confidence|Automation Confidence)\s*[:|]\s*(?:\d+%|High|Medium|Low|Insufficient)(?:\s|$)/im;
const FINDING_FIELDS = ['- AI quality issues:', '- Learning issues:', '- Prevention records:'];

function issueNumbersFromField(body, label) {
  const value = parsePullRequestField(body, label);
  return value === null || /^(?:none|not-required)$/i.test(value.trim())
    ? []
    : parseIssueNumbers(value);
}

export function confidenceGovernanceErrors({ pullRequest, recordPairs = [] }) {
  const errors = [];
  const body = pullRequest?.body ?? '';
  if (MANUAL_SCORE_PATTERN.test(body.replaceAll('**', ''))) {
    errors.push(
      'Pull-request confidence percentages are non-authoritative; link recalculable confidence records instead.',
    );
  }
  const linkedFindingIssues = FINDING_FIELDS.flatMap((field) => issueNumbersFromField(body, field));
  const recordIssues = issueNumbersFromField(body, '- Confidence records:');
  if (pullRequest?.draft !== true && linkedFindingIssues.length > 0 && recordIssues.length === 0) {
    errors.push(
      'A review-ready pull request with linked findings requires at least one confidence record.',
    );
  }
  if (pullRequest?.draft !== true && linkedFindingIssues.length > 0 && recordIssues.length > 0) {
    const sourceReferences = recordPairs.map((pair) => String(pair?.inputRecord?.sourceRef ?? ''));
    for (const issueNumber of [...new Set(linkedFindingIssues)]) {
      const represented = sourceReferences.some((reference) =>
        new RegExp(`(?:issue:|#|/issues/)${issueNumber}(?:\\b|$)`, 'i').test(reference),
      );
      if (!represented) {
        errors.push(
          `Linked finding issue #${issueNumber} lacks a recalculable confidence input record.`,
        );
      }
    }
  }
  for (const pair of recordPairs) {
    errors.push(...validateConfidenceRecordPair(pair));
  }
  return errors;
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is unavailable.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    throw new Error('The pull_request payload is unavailable.');
  }
  const issueNumbers = issueNumbersFromField(pullRequest.body ?? '', '- Confidence records:');
  const pairs = [];
  for (const issueNumber of issueNumbers) {
    const [issue, comments] = await Promise.all([
      githubRequest(`/issues/${issueNumber}`),
      listAll(`/issues/${issueNumber}/comments`),
    ]);
    pairs.push(...collectConfidenceRecords(issue, Array.isArray(comments) ? comments : []));
  }
  const errors = confidenceGovernanceErrors({ pullRequest, recordPairs: pairs });
  console.log(
    JSON.stringify(
      {
        pullRequest: { number: pullRequest.number, draft: pullRequest.draft === true },
        confidenceRecordIssues: issueNumbers,
        confidenceFindingCount: pairs.length,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length > 0) {
    console.error('Confidence governance failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
