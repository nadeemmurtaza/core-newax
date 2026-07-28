#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  githubRequest,
  parseIssueNumbers,
  parsePullRequestField,
} from './engineering-learning-core.mjs';
import { collectExecutiveDashboardRecords } from './executive-dashboard-record.mjs';
import { evaluateExecutiveDashboardGovernance } from './executive-dashboard-governance.mjs';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token || !repository || !eventPath) {
    throw new Error('GitHub governance environment is required.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    throw new Error('Pull request event is required.');
  }
  const files = await githubRequest(`/pulls/${pullRequest.number}/files?per_page=100`, {
    token,
    repository,
  });
  const body = pullRequest.body ?? '';
  const field = parsePullRequestField(body, '- Executive dashboard records:');
  const issueNumbers = field === null ? [] : parseIssueNumbers(field);
  const recordPairs = [];
  for (const number of issueNumbers) {
    const issue = await githubRequest(`/issues/${number}`, { token, repository });
    const comments = await githubRequest(`/issues/${number}/comments?per_page=100`, {
      token,
      repository,
    });
    recordPairs.push(...collectExecutiveDashboardRecords(issue, comments));
  }
  const result = evaluateExecutiveDashboardGovernance({
    draft: Boolean(pullRequest.draft),
    body,
    changedFiles: files.map((file) => file.filename),
    recordPairs,
  });
  if (result.errors.length) {
    throw new Error(result.errors.join('\n'));
  }
  process.stdout.write(
    `Executive dashboard governance checked ${result.issueNumbers.length} record issue(s).\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
