import { readFileSync } from 'node:fs';

import { buildAiQualityDataset } from './ai-quality-dataset.mjs';
import { collectAiToolHistory } from './ai-tool-history-github.mjs';
import { detectAiToolMistakes } from './ai-tool-mistake-detector.mjs';

export function aiToolGovernanceErrors(history, result) {
  const errors = [];
  const events = history.events ?? [];
  const issues = history.aiQualityIssues ?? [];
  const hasOutputRecord = events.some((event) => event.type === 'ai-output');
  if (history.phase === 'review' && hasOutputRecord && issues.length === 0) {
    errors.push(
      'A review-ready pull request with output provenance requires a linked quality issue.',
    );
  }
  if (history.phase === 'review' && issues.length > 0 && !hasOutputRecord) {
    errors.push('A linked quality issue must contain a structured output provenance record.');
  }
  for (const finding of result.blockers ?? []) {
    errors.push(`${finding.type}: ${finding.title} (${finding.id})`);
  }
  return errors;
}

export function evaluateAiToolGovernance(history, repository = '') {
  const result = detectAiToolMistakes(history);
  const dataset = buildAiQualityDataset({
    analysis: result,
    events: history.events ?? [],
    repository,
  });
  return {
    result,
    dataset,
    errors: aiToolGovernanceErrors(history, result),
  };
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
  const history = await collectAiToolHistory({ pullRequest: event.pull_request });
  const evaluation = evaluateAiToolGovernance(history, process.env.GITHUB_REPOSITORY ?? '');
  console.log(
    JSON.stringify(
      {
        pullRequest: history.pullRequest,
        aiQualityIssues: history.aiQualityIssues,
        status: evaluation.result.status,
        summary: evaluation.result.summary,
        findings: evaluation.result.findings,
        notices: evaluation.result.notices,
        dataset: {
          schemaVersion: evaluation.dataset.schemaVersion,
          recordCount: evaluation.dataset.recordCount,
        },
      },
      null,
      2,
    ),
  );
  if (evaluation.errors.length > 0) {
    console.error('Tool and AI mistake governance failed:');
    for (const error of evaluation.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
