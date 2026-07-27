import { readFileSync, writeFileSync } from 'node:fs';

import { buildAiQualityDataset } from './ai-quality-dataset.mjs';
import {
  collectAiToolHistory,
  collectAiToolHistoryForPullRequest,
} from './ai-tool-history-github.mjs';
import { detectAiToolMistakes } from './ai-tool-mistake-detector.mjs';

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
    return collectAiToolHistoryForPullRequest(Number(pullRequestNumber));
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath !== undefined && eventPath.length > 0) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    if (event.pull_request === undefined) {
      throw new Error('The GitHub event does not contain a pull request.');
    }
    return collectAiToolHistory({ pullRequest: event.pull_request });
  }
  throw new Error('Provide --file <history.json>, --pr <number>, or GITHUB_EVENT_PATH.');
}

export function analyzeAiToolHistory(history, repository = '') {
  const result = detectAiToolMistakes(history);
  const dataset = buildAiQualityDataset({
    analysis: result,
    events: history.events ?? [],
    repository,
  });
  return { result, dataset };
}

async function main() {
  const history = await readHistory();
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const { result, dataset } = analyzeAiToolHistory(history, repository);
  const datasetOut = argumentValue('--dataset-out');
  if (datasetOut !== null) {
    writeFileSync(datasetOut, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  }
  console.log(
    JSON.stringify(
      {
        history: {
          aiQualityIssues: history.aiQualityIssues ?? [],
          eventCount: history.events?.length ?? 0,
        },
        result,
        dataset: {
          schemaVersion: dataset.schemaVersion,
          recordCount: dataset.recordCount,
          outputPath: datasetOut,
        },
      },
      null,
      2,
    ),
  );
  if (!process.argv.includes('--report-only') && result.blockers.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
