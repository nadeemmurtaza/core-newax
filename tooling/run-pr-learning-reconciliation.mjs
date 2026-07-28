import { readFileSync } from 'node:fs';

import {
  githubRequest,
  listAll,
  loadCatalog,
  parseIssueNumbers,
  parseLedgerEntries,
  parseMetadata,
  parsePullRequestField,
} from './engineering-learning-core.mjs';
import {
  evaluateLearningRequirement,
  validateLearningRecord,
} from './learning-outcome-rule-engine.mjs';

const INTAKE_PATH = '.github/workflows/engineering-failure-intake.yml';

function fail(messages) {
  console.error('Engineering learning bootstrap reconciliation failed:');
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

function parseLastField(body, label) {
  const matches = String(body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(label));
  const last = matches.at(-1);
  return last === undefined ? null : last.slice(label.length).trim().replaceAll('`', '');
}

function isNotFound(error) {
  return String(error).includes('(404 ');
}

async function intakeIsActiveOnDefaultBranch(event) {
  const defaultBranch = event.repository?.default_branch;
  if (defaultBranch === undefined || defaultBranch.length === 0) {
    throw new Error('The repository default branch is unavailable.');
  }

  try {
    await githubRequest(`/contents/${INTAKE_PATH}?ref=${encodeURIComponent(defaultBranch)}`);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

async function runBootstrapReconciliation(event) {
  const pullRequest = event.pull_request;
  if (pullRequest === undefined) {
    fail(['The pull_request payload is unavailable.']);
  }

  const body = pullRequest.body ?? '';
  const errors = [];
  const ledgerEntriesValue = parsePullRequestField(body, '- Ledger entries:');
  const ledgerEntries = parseLedgerEntries(ledgerEntriesValue);
  const learningIssuesValue = parsePullRequestField(body, '- Learning issues:');
  const listedIssueNumbers = new Set(parseIssueNumbers(learningIssuesValue));
  const rootCauseStatus = parsePullRequestField(body, '- Root-cause status:');
  const rootCauseEvidence = parsePullRequestField(body, '- Root-cause evidence:');
  const resolutionEvidence = parsePullRequestField(body, '- Resolution evidence:');
  const [issues, changedFiles] = await Promise.all([
    listAll('/issues?state=all'),
    listAll(`/pulls/${pullRequest.number}/files`),
  ]);
  const linkedIssues = issues.filter((issue) => {
    if (issue.pull_request !== undefined) {
      return false;
    }
    return Number(parseMetadata(issue.body)['pr-number']) === pullRequest.number;
  });
  const linkedIssueNumbers = new Set(linkedIssues.map((issue) => issue.number));
  const learningRequirement = evaluateLearningRequirement({
    changedFiles,
    linkedLearningIssues: linkedIssues,
  });
  const learningRecord = validateLearningRecord({
    requirement: learningRequirement,
    ledgerEntries,
    ledgerEntriesValue,
    learningIssueNumbers: [...listedIssueNumbers],
    learningIssuesValue,
    rootCauseStatus,
    rootCauseEvidence,
    resolutionEvidence,
    changedFiles,
    catalog: loadCatalog(),
  });
  errors.push(...learningRecord.errors);

  if (parsePullRequestField(body, '- Learning outcome:') !== null) {
    errors.push(
      'Remove the manual `Learning outcome` field. The trusted rule engine calculates the outcome.',
    );
  }

  for (const issueNumber of linkedIssueNumbers) {
    if (!listedIssueNumbers.has(issueNumber)) {
      errors.push(`Linked learning issue #${issueNumber} is missing from the PR record.`);
    }
  }
  for (const issueNumber of listedIssueNumbers) {
    if (!linkedIssueNumbers.has(issueNumber)) {
      errors.push(`PR record issue #${issueNumber} is not linked to this pull request.`);
    }
  }

  for (const issue of linkedIssues) {
    const metadata = parseMetadata(issue.body);
    const finalRootCauseStatus = parseLastField(issue.body, '- Root-cause status:');
    const resolutionStatus = parseLastField(issue.body, '- Resolution status:');
    const confirmedRootCause = parseLastField(issue.body, '- Confirmed root cause:');
    const successfulVerification = parseLastField(issue.body, '- Successful verification:');

    if (metadata.fingerprint === undefined || metadata['root-cause-id'] === undefined) {
      errors.push(`Issue #${issue.number} lacks machine-readable learning metadata.`);
    }
    if (String(metadata['root-cause-id'] ?? '').startsWith('ROOT-UNCLASSIFIED-')) {
      errors.push(`Issue #${issue.number} still has an unclassified root cause.`);
    }
    if (finalRootCauseStatus !== 'confirmed') {
      errors.push(`Issue #${issue.number} final root cause is not confirmed.`);
    }
    if (resolutionStatus !== 'verified') {
      errors.push(`Issue #${issue.number} resolution is not verified.`);
    }
    if (confirmedRootCause === null || confirmedRootCause.length < 12) {
      errors.push(`Issue #${issue.number} lacks a specific confirmed root cause.`);
    }
    if (successfulVerification === null || successfulVerification.length < 12) {
      errors.push(`Issue #${issue.number} lacks successful verification evidence.`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log(
    JSON.stringify({
      pullRequest: pullRequest.number,
      intakeActiveOnDefaultBranch: false,
      learningOutcome: learningRequirement.learningOutcome,
      learningOutcomeRulesVersion: learningRequirement.rulesVersion,
      learningOutcomeReasons: learningRequirement.reasons,
      ledgerClassifications: learningRecord.classifications,
      linkedLearningIssues: [...linkedIssueNumbers],
      status: 'bootstrap-reconciled',
    }),
  );
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath === undefined || eventPath.length === 0) {
  fail(['GITHUB_EVENT_PATH is unavailable.']);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
if (await intakeIsActiveOnDefaultBranch(event)) {
  await import('./reconcile-pr-learning.mjs');
} else {
  await runBootstrapReconciliation(event);
}
