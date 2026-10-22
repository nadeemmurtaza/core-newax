import { readFileSync } from 'node:fs';

import {
  githubRequest,
  listAll,
  parseIssueNumbers,
  parsePullRequestField,
} from './engineering-learning-core.mjs';
import {
  collectKnowledgeGraphRecord,
  validateKnowledgeGraphRecord,
} from './knowledge-graph-record.mjs';

const FINDING_FIELDS = [
  '- AI quality issues:',
  '- Learning issues:',
  '- Prevention records:',
  '- Confidence records:',
];

function issueNumbersFromField(body, label) {
  const value = parsePullRequestField(body, label);
  if (value === null || /^(?:none|not-required|pending)/i.test(value.replaceAll('`', '').trim())) {
    return [];
  }
  return parseIssueNumbers(value);
}

function linkedFindingIssues(body) {
  return [...new Set(FINDING_FIELDS.flatMap((field) => issueNumbersFromField(body, field)))].sort(
    (left, right) => left - right,
  );
}

export function knowledgeReferenceErrors(graph, repository) {
  const errors = [];
  const allowedSource =
    /^(?:github|issue|pr|commit|workflow|review|catalog|ledger|rule|prevention|requirement|verification):/;
  for (const node of graph?.nodes ?? []) {
    if (node.url) {
      let parsed;
      try {
        parsed = new URL(node.url);
      } catch {
        errors.push(`Knowledge node ${node.id} has an invalid URL.`);
        continue;
      }
      if (parsed.hostname !== 'github.com') {
        errors.push(`Knowledge node ${node.id} URL must use github.com in schema version 1.`);
      }
      if (repository && !parsed.pathname.startsWith(`/${repository}/`)) {
        errors.push(`Knowledge node ${node.id} URL does not belong to ${repository}.`);
      }
      if (
        !/(?:\/issues\/\d+|\/pull\/\d+|\/commit\/[0-9a-f]{7,40}|\/actions\/runs\/\d+|\/blob\/[^/]+\/.+)/i.test(
          parsed.pathname,
        )
      ) {
        errors.push(
          `Knowledge node ${node.id} URL is not a supported durable GitHub artifact path.`,
        );
      }
    } else if (!allowedSource.test(String(node.sourceRef ?? ''))) {
      errors.push(`Knowledge node ${node.id} sourceRef is not a supported durable reference.`);
    }
  }
  return errors;
}

export function knowledgeGraphGovernanceErrors({ pullRequest, records = [], repository = '' }) {
  const errors = [];
  const body = pullRequest?.body ?? '';
  const findingIssues = linkedFindingIssues(body);
  const recordIssues = issueNumbersFromField(body, '- Knowledge graph records:');
  if (pullRequest?.draft !== true && findingIssues.length > 0 && recordIssues.length === 0) {
    errors.push(
      'A review-ready pull request with linked findings requires a knowledge graph record.',
    );
  }
  for (const record of records) {
    errors.push(...validateKnowledgeGraphRecord(record));
    const graph = record.renderedRecord?.graph;
    if (graph) {
      errors.push(...knowledgeReferenceErrors(graph, repository));
    }
  }
  if (pullRequest?.draft !== true && findingIssues.length > 0 && records.length > 0) {
    const represented = new Set(
      records.flatMap((record) =>
        (record.renderedRecord?.graph?.nodes ?? [])
          .filter((node) => node.kind === 'bug')
          .map((node) => Number(node.metadata?.issueNumber))
          .filter(Number.isInteger),
      ),
    );
    for (const issueNumber of findingIssues) {
      if (!represented.has(issueNumber)) {
        errors.push(`Linked finding issue #${issueNumber} is not represented by a bug node.`);
      }
    }
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
  const recordIssues = issueNumbersFromField(pullRequest.body ?? '', '- Knowledge graph records:');
  const records = [];
  for (const issueNumber of recordIssues) {
    const [issue, comments] = await Promise.all([
      githubRequest(`/issues/${issueNumber}`),
      listAll(`/issues/${issueNumber}/comments`),
    ]);
    records.push(collectKnowledgeGraphRecord(issue, comments));
  }
  const errors = knowledgeGraphGovernanceErrors({
    pullRequest,
    records,
    repository: process.env.GITHUB_REPOSITORY ?? '',
  });
  console.log(
    JSON.stringify(
      {
        pullRequest: { number: pullRequest.number, draft: pullRequest.draft === true },
        knowledgeGraphRecordIssues: recordIssues,
        recordCount: records.length,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length > 0) {
    console.error('Knowledge graph governance did not pass:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
