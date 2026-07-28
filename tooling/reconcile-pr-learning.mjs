import { readFileSync } from 'node:fs';

import {
  FAILURE_CONCLUSIONS,
  createEngineeringEvent,
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

function fail(messages) {
  console.error('Engineering learning reconciliation failed:');
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

function parseResolution(body) {
  return {
    confirmedRootCause: parseLastField(body, '- Confirmed root cause:'),
    fixCommit: parseLastField(body, '- Fix commit:'),
    resolutionStatus: parseLastField(body, '- Resolution status:'),
    reviewerConfirmation: parseLastField(body, '- Reviewer confirmation:'),
    rootCauseStatus: parseLastField(body, '- Root-cause status:'),
    successfulVerification: parseLastField(body, '- Successful verification:'),
  };
}

async function validateConfirmedResolution(issue, pullRequestCommitShas, errors) {
  const resolution = parseResolution(issue.body ?? '');

  if (resolution.rootCauseStatus !== 'confirmed') {
    errors.push(`Issue #${issue.number} does not mark its final root cause as confirmed.`);
  }
  if (
    resolution.confirmedRootCause === null ||
    resolution.confirmedRootCause === 'Pending.' ||
    resolution.confirmedRootCause.length < 12
  ) {
    errors.push(`Issue #${issue.number} lacks a specific confirmed root cause.`);
  }
  if (resolution.resolutionStatus !== 'verified') {
    errors.push(`Issue #${issue.number} resolution status is not verified.`);
  }
  if (
    resolution.successfulVerification === null ||
    resolution.successfulVerification === 'Pending.' ||
    resolution.successfulVerification.length < 12
  ) {
    errors.push(`Issue #${issue.number} lacks successful verification evidence.`);
  }
  if (
    resolution.reviewerConfirmation === null ||
    resolution.reviewerConfirmation === 'Pending.' ||
    resolution.reviewerConfirmation.length < 8
  ) {
    errors.push(`Issue #${issue.number} lacks reviewer confirmation.`);
  }

  const fixCommit = resolution.fixCommit ?? '';
  if (/^[0-9a-f]{40}$/i.test(fixCommit)) {
    try {
      await githubRequest(`/commits/${fixCommit}`);
      if (!pullRequestCommitShas.has(fixCommit)) {
        errors.push(`Issue #${issue.number} fix commit is not part of this pull request.`);
      }
    } catch (error) {
      errors.push(`Issue #${issue.number} fix commit could not be verified: ${String(error)}`);
    }
  } else if (!fixCommit.startsWith('not-applicable:')) {
    errors.push(
      `Issue #${issue.number} fix commit must be a full commit SHA or start with not-applicable:.`,
    );
  }
}

async function verifyMachineEvidence(issue, metadata, pullRequest, errors) {
  const workflowRunId = Number(metadata['workflow-run-id']);
  const jobId = Number(metadata['job-id']);

  if (!Number.isSafeInteger(workflowRunId) || !Number.isSafeInteger(jobId)) {
    errors.push(`Issue #${issue.number} lacks valid workflow-run and job identifiers.`);
    return;
  }

  try {
    const run = await githubRequest(`/actions/runs/${workflowRunId}`);
    if (!FAILURE_CONCLUSIONS.has(run.conclusion)) {
      errors.push(
        `Issue #${issue.number} references workflow run ${workflowRunId}, which is not failed.`,
      );
      return;
    }
    if (run.head_sha !== metadata['commit-sha']) {
      errors.push(
        `Issue #${issue.number} commit metadata does not match workflow run ${workflowRunId}.`,
      );
      return;
    }

    const jobs = await listAll(`/actions/runs/${workflowRunId}/jobs`, {
      collectionKey: 'jobs',
    });
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (job === undefined || !FAILURE_CONCLUSIONS.has(job.conclusion)) {
      errors.push(`Issue #${issue.number} references job ${jobId}, which is not a failed job.`);
      return;
    }

    const logText = await githubRequest(`/actions/jobs/${jobId}/logs`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    const recomputed = createEngineeringEvent({
      sourceType: metadata['source-type'],
      sourceId: metadata['source-id'],
      repository: process.env.GITHUB_REPOSITORY,
      prNumber: pullRequest.number,
      commitSha: run.head_sha,
      workflowRunId,
      workflowName: run.name,
      jobId,
      jobName: job.name,
      stepName: metadata['step-name'],
      logText,
      evidenceUrls: [run.html_url, job.html_url].filter(Boolean),
    });

    if (recomputed.fingerprint !== metadata.fingerprint) {
      errors.push(
        `Issue #${issue.number} fingerprint does not match the referenced workflow evidence.`,
      );
    }
    if (recomputed.rootCauseId !== metadata['root-cause-id']) {
      errors.push(
        `Issue #${issue.number} root-cause classification does not match the referenced logs.`,
      );
    }
    if (!recomputed.rootCauseDeterministic) {
      errors.push(
        `Issue #${issue.number} is marked machine-supported, but its classifier is not deterministic.`,
      );
    }
  } catch (error) {
    errors.push(`Issue #${issue.number} machine evidence could not be verified: ${String(error)}`);
  }
}

async function listPullRequestRuns(commits) {
  const runsById = new Map();

  for (const commit of commits) {
    const response = await githubRequest(
      `/actions/runs?event=pull_request&head_sha=${encodeURIComponent(commit.sha)}`,
    );
    for (const run of response.workflow_runs ?? []) {
      runsById.set(run.id, run);
    }
  }

  return [...runsById.values()];
}

async function listPullRequestLearningIssues(pullRequestNumber) {
  const issues = await listAll('/issues?state=all');
  return issues.filter((issue) => {
    if (issue.pull_request !== undefined) {
      return false;
    }
    const metadata = parseMetadata(issue.body);
    return Number(metadata['pr-number']) === pullRequestNumber;
  });
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath === undefined || eventPath.length === 0) {
  fail(['GITHUB_EVENT_PATH is unavailable.']);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const pullRequest = event.pull_request;
if (pullRequest === undefined) {
  fail(['The pull_request payload is unavailable.']);
}

const body = pullRequest.body ?? '';
const errors = [];
const ledgerEntriesValue = parsePullRequestField(body, '- Ledger entries:');
const ledgerEntries = parseLedgerEntries(ledgerEntriesValue);
const learningIssuesValue = parsePullRequestField(body, '- Learning issues:');
const learningIssueNumbers = parseIssueNumbers(learningIssuesValue);
const rootCauseStatus = parsePullRequestField(body, '- Root-cause status:');
const rootCauseEvidence = parsePullRequestField(body, '- Root-cause evidence:');
const resolutionEvidence = parsePullRequestField(body, '- Resolution evidence:');
const failureHistoryReconciled = parsePullRequestField(body, '- Failure history reconciled:');
const externalEventsReconciled = parsePullRequestField(
  body,
  '- External and tool events reconciled:',
);

if (parsePullRequestField(body, '- Learning outcome:') !== null) {
  errors.push(
    'Remove the manual `Learning outcome` field. The trusted rule engine calculates the outcome.',
  );
}
if (failureHistoryReconciled !== 'yes') {
  errors.push('Failure history must be reconciled before review.');
}
if (externalEventsReconciled !== 'yes') {
  errors.push('External and tool events must be reconciled before review.');
}

const commits = await listAll(`/pulls/${pullRequest.number}/commits`);
const pullRequestCommitShas = new Set(commits.map((commit) => commit.sha));
const [runs, linkedIssues, changedFiles] = await Promise.all([
  listPullRequestRuns(commits),
  listPullRequestLearningIssues(pullRequest.number),
  listAll(`/pulls/${pullRequest.number}/files`),
]);

const failedRuns = runs.filter((run) => FAILURE_CONCLUSIONS.has(run.conclusion));
const linkedIssueNumbers = new Set(linkedIssues.map((issue) => issue.number));
const listedIssueNumbers = new Set(learningIssueNumbers);
const linkedIssueMetadata = new Map(
  linkedIssues.map((issue) => [issue.number, parseMetadata(issue.body)]),
);
const capturedWorkflowRunIds = new Set(
  [...linkedIssueMetadata.values()]
    .map((metadata) => Number(metadata['workflow-run-id']))
    .filter(Number.isSafeInteger),
);
const catalog = loadCatalog();
const learningRequirement = evaluateLearningRequirement({
  changedFiles,
  failedWorkflowRuns: failedRuns,
  linkedLearningIssues: linkedIssues,
});
const learningRecord = validateLearningRecord({
  requirement: learningRequirement,
  ledgerEntries,
  ledgerEntriesValue,
  learningIssueNumbers,
  learningIssuesValue,
  rootCauseStatus,
  rootCauseEvidence,
  resolutionEvidence,
  changedFiles,
  catalog,
});
errors.push(...learningRecord.errors);

for (const run of failedRuns) {
  if (!capturedWorkflowRunIds.has(run.id)) {
    errors.push(`Failed workflow run ${run.id} has no occurrence-specific learning issue.`);
  }
}
for (const linkedIssueNumber of linkedIssueNumbers) {
  if (!listedIssueNumbers.has(linkedIssueNumber)) {
    errors.push(`Linked learning issue #${linkedIssueNumber} is missing from the PR record.`);
  }
}
for (const listedIssueNumber of listedIssueNumbers) {
  if (!linkedIssueNumbers.has(listedIssueNumber)) {
    errors.push(`PR record issue #${listedIssueNumber} is not linked to this pull request.`);
  }
}

for (const learningIssueNumber of learningIssueNumbers) {
  const issue = linkedIssues.find((candidate) => candidate.number === learningIssueNumber);
  if (issue === undefined) {
    continue;
  }

  const metadata = linkedIssueMetadata.get(learningIssueNumber) ?? {};
  if (metadata.fingerprint === undefined || metadata['root-cause-id'] === undefined) {
    errors.push(`Issue #${learningIssueNumber} lacks machine-readable learning metadata.`);
    continue;
  }
  if (Number(metadata['pr-number']) !== pullRequest.number) {
    errors.push(`Issue #${learningIssueNumber} is not linked to PR #${pullRequest.number}.`);
  }

  const catalogEntry = catalog.rootCauses.find(
    (rootCause) => rootCause.id === metadata['root-cause-id'],
  );
  if (catalogEntry === undefined) {
    errors.push(`Issue #${learningIssueNumber} root-cause ID is absent from the catalog.`);
  }
  if (metadata['root-cause-id'].startsWith('ROOT-UNCLASSIFIED-')) {
    errors.push(`Issue #${learningIssueNumber} still has an unclassified root cause.`);
  }

  if (metadata['root-cause-status'] === 'machine-supported') {
    await verifyMachineEvidence(issue, metadata, pullRequest, errors);
  } else if (metadata['root-cause-status'] !== 'confirmed') {
    errors.push(
      `Issue #${learningIssueNumber} root-cause status is neither confirmed nor machine-supported.`,
    );
  }

  await validateConfirmedResolution(issue, pullRequestCommitShas, errors);
}

if (errors.length > 0) {
  fail(errors);
}

console.log(
  JSON.stringify({
    pullRequest: pullRequest.number,
    learningOutcome: learningRequirement.learningOutcome,
    learningOutcomeRulesVersion: learningRequirement.rulesVersion,
    learningOutcomeReasons: learningRequirement.reasons,
    ledgerClassifications: learningRecord.classifications,
    failedRuns: failedRuns.map((run) => ({
      id: run.id,
      name: run.name,
      conclusion: run.conclusion,
    })),
    linkedLearningIssues: linkedIssues.map((issue) => issue.number),
    status: 'reconciled',
  }),
);
