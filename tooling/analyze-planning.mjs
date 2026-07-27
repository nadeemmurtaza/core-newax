import { readFileSync } from 'node:fs';

import { analyzePlanningMistakes } from './planning-mistake-analysis.mjs';
import {
  collectPlanningHistory,
  collectPlanningHistoryForPullRequest,
} from './planning-history-github.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function readInput() {
  const file = argumentValue('--file');
  if (file !== null) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed.history ?? parsed;
  }

  const pullRequestNumber = argumentValue('--pr');
  if (pullRequestNumber !== null) {
    return collectPlanningHistoryForPullRequest(Number(pullRequestNumber));
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath !== undefined && eventPath.length > 0) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    if (event.pull_request === undefined) {
      throw new Error('The GitHub event does not contain a pull request.');
    }
    return collectPlanningHistory({ pullRequest: event.pull_request });
  }

  throw new Error('Provide --file <history.json>, --pr <number>, or GITHUB_EVENT_PATH.');
}

const history = await readInput();
const result = analyzePlanningMistakes(history);
console.log(
  JSON.stringify({ history: { planningIssues: history.planningIssues ?? [] }, result }, null, 2),
);
if (!process.argv.includes('--report-only') && result.blockers.length > 0) {
  process.exitCode = 1;
}
