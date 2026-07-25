import { readFileSync } from 'node:fs';

import { analyzePlanningMistakes } from './planning-mistake-analysis.mjs';
import { collectPlanningHistory } from './planning-history-github.mjs';

export function planningGovernanceErrors(history, result) {
  const errors = [];
  if ((history.planningIssues ?? []).length === 0 && history.phase === 'review') {
    errors.push('A review-ready pull request requires at least one planning issue.');
  }
  if ((history.tasks ?? []).length === 0 && history.phase === 'review') {
    errors.push('A review-ready pull request requires a declared task sequence.');
  }
  if ((history.declaredScopePaths ?? []).length === 0 && history.phase === 'review') {
    errors.push('A review-ready pull request requires declared scope paths.');
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
  const history = await collectPlanningHistory({ pullRequest: event.pull_request });
  const result = analyzePlanningMistakes(history);
  const errors = planningGovernanceErrors(history, result);
  console.log(
    JSON.stringify(
      {
        pullRequest: history.pullRequest,
        planningIssues: history.planningIssues,
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
    console.error('Planning mistake governance failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
