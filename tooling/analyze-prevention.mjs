import { readFileSync } from 'node:fs';

import { enrichPreventionRegistry } from './confidence-finding-adapters.mjs';
import { writePreventionFiles } from './prevention-control-renderer.mjs';
import { buildPreventionRegistry } from './prevention-engine.mjs';
import {
  collectPreventionHistory,
  collectPreventionHistoryForPullRequest,
} from './prevention-history-github.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function readHistory() {
  const file = argumentValue('--file');
  if (file !== null) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed.history ?? parsed;
  }
  const pullRequestNumber = argumentValue('--pr');
  if (pullRequestNumber !== null) {
    return collectPreventionHistoryForPullRequest(Number(pullRequestNumber));
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath !== undefined && eventPath.length > 0) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    if (event.pull_request === undefined) {
      throw new Error('The GitHub event does not contain a pull request.');
    }
    return collectPreventionHistory({ pullRequest: event.pull_request });
  }
  throw new Error('Provide --file <history.json>, --pr <number>, or GITHUB_EVENT_PATH.');
}

const history = await readHistory();
const registry = buildPreventionRegistry(
  history.mistakes ?? [],
  history.existingPacks ?? [],
  history.controlOptions ?? {},
);
const outputRoot = argumentValue('--out');
const generatedPaths = [];
if (outputRoot !== null) {
  for (const pack of registry.packs) {
    generatedPaths.push(...writePreventionFiles(pack, outputRoot));
  }
}
const enrichedRegistry = enrichPreventionRegistry(registry, {
  exactFilesCurrent: outputRoot !== null,
  governancePassed: false,
});
const failures = enrichedRegistry.results.filter((result) => result.status !== 'ready');
console.log(
  JSON.stringify(
    {
      history: {
        preventionIssues: history.preventionIssues ?? [],
        mistakeCount: history.mistakes?.length ?? 0,
      },
      results: enrichedRegistry.results,
      packs: enrichedRegistry.packs,
      generatedPaths,
    },
    null,
    2,
  ),
);
if (!process.argv.includes('--report-only') && failures.length > 0) {
  process.exitCode = 1;
}
