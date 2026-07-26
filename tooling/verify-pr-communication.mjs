import { readFileSync } from 'node:fs';

import { collectCommunicationHistory } from './communication-history-github.mjs';
import { detectCommunicationMistakes } from './communication-mistake-detector.mjs';

export function communicationGovernanceErrors(history, result) {
  const errors = [];
  if (history.phase === 'review' && (history.communicationIssues ?? []).length === 0) {
    errors.push('A review-ready pull request requires at least one communication issue.');
  }
  if (history.phase === 'review' && (history.events ?? []).length === 0) {
    errors.push('A review-ready pull request requires structured communication evidence.');
  }
  for (const finding of result.findings) {
    if (finding.state === 'detected' && finding.confidence === 'high' && finding.waived !== true) {
      errors.push(`${finding.type}: ${finding.title} (${finding.id})`);
    }
  }
  return errors;
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    throw new Error('GITHUB_EVENT_PATH is unavailable.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  if (event.pull_request === undefined) {
    throw new Error('The pull_request payload is unavailable.');
  }
  const history = await collectCommunicationHistory({ pullRequest: event.pull_request });
  const result = detectCommunicationMistakes(history);
  const errors = communicationGovernanceErrors(history, result);
  console.log(
    JSON.stringify(
      {
        pullRequest: history.pullRequest,
        communicationIssues: history.communicationIssues,
        status: result.status,
        summary: result.summary,
        findings: result.findings,
        notices: result.notices,
      },
      null,
      2,
    ),
  );
  if (errors.length > 0) {
    console.error('Communication mistake governance failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
