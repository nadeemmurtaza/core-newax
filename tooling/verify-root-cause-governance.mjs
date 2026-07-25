import { readFileSync } from 'node:fs';

import {
  FAILURE_CONCLUSIONS,
  githubRequest,
  listAll,
  loadCatalog,
  parseMetadata,
  parsePullRequestField,
} from './engineering-learning-core.mjs';
import { verifyGithubExplanationEvidence } from './explanation-evidence-github.mjs';
import {
  evaluateLearningOutcome,
  parseExplanationEvidenceRecord,
  verifyExplanation,
  verifyRootCauseExplanation,
} from './root-cause-engine.mjs';

function fail(messages) {
  console.error('Root-cause governance verification failed:');
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

async function listPullRequestRuns(commits) {
  const runsById = new Map();
  for (const commit of commits) {
    const response = await listAll(
      `/actions/runs?event=pull_request&head_sha=${encodeURIComponent(commit.sha)}`,
      { collectionKey: 'workflow_runs' },
    );
    for (const run of response) {
      runsById.set(run.id, run);
    }
  }
  return [...runsById.values()];
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

const [issues, commits] = await Promise.all([
  listAll('/issues?state=all'),
  listAll(`/pulls/${pullRequest.number}/commits`),
]);
const linkedIssues = issues.filter((issue) => {
  if (issue.pull_request !== undefined) {
    return false;
  }
  return Number(parseMetadata(issue.body)['pr-number']) === pullRequest.number;
});
const runs = await listPullRequestRuns(commits);
const failedRuns = runs.filter((run) => FAILURE_CONCLUSIONS.has(run.conclusion));
const declaredOutcome = parsePullRequestField(pullRequest.body ?? '', '- Learning outcome:');
const outcomeDecision = evaluateLearningOutcome({
  declaredOutcome,
  failedRuns,
  linkedIssues,
});
const errors = [...outcomeDecision.errors];
const catalog = loadCatalog();
const explanationDecisions = [];

for (const issue of linkedIssues) {
  const metadata = parseMetadata(issue.body);
  const rootCauseId = metadata['root-cause-id'];
  const catalogEntry = catalog.rootCauses.find((entry) => entry.id === rootCauseId);
  if (catalogEntry === undefined) {
    errors.push(`Issue #${issue.number} root-cause ID is absent from the catalog.`);
    continue;
  }

  const resolution = parseResolution(issue.body);
  const matchedSignatures = String(metadata['matched-signatures'] ?? '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
  const missingDeterministicSignatures =
    metadata['root-cause-status'] === 'machine-supported'
      ? catalogEntry.signatures.filter((signature) => !matchedSignatures.includes(signature))
      : [];
  const deterministicEvidence =
    metadata['root-cause-status'] === 'machine-supported' &&
    catalogEntry.deterministic === true &&
    missingDeterministicSignatures.length === 0;
  const evidenceAgainst = [
    ...(metadata['root-cause-status'] === 'machine-supported' && !catalogEntry.deterministic
      ? ['The catalog entry is not deterministic.']
      : []),
    ...missingDeterministicSignatures.map(
      (signature) => `Missing deterministic signature: ${signature}`,
    ),
  ];
  const assessment = {
    ambiguous: false,
    deterministic: deterministicEvidence,
    evidenceAgainst,
    selected: {
      rootCauseId,
    },
  };
  const verification = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      ...resolution,
      evidenceReferences: [
        metadata['workflow-run-id'],
        metadata['job-id'],
        resolution.fixCommit,
        resolution.successfulVerification,
      ].filter((value) => value !== undefined && value !== null && value !== 'none'),
      rootCauseId,
    },
  });

  if (verification.status !== 'supported') {
    for (const message of verification.errors) {
      errors.push(`Issue #${issue.number}: ${message}`);
    }
  }

  const explanationRecord = parseExplanationEvidenceRecord(issue.body);
  if (explanationRecord === null) {
    errors.push(`Issue #${issue.number}: explanation-evidence record is missing or invalid.`);
    continue;
  }
  if (explanationRecord.explanation?.rootCauseId !== rootCauseId) {
    errors.push(`Issue #${issue.number}: explanation root-cause ID differs from issue metadata.`);
    continue;
  }

  try {
    const provenance = await verifyGithubExplanationEvidence({
      evidence: explanationRecord.evidence,
      githubRequest,
      listAll,
    });
    const explanationVerification = verifyExplanation({
      assessment: explanationRecord.assessment,
      explanation: explanationRecord.explanation,
      evidence: provenance.evidence,
    });
    explanationDecisions.push({
      issueNumber: issue.number,
      status: explanationVerification.status,
      confidenceScore: explanationVerification.confidenceScore,
    });

    if (explanationVerification.status !== 'accepted') {
      errors.push(
        `Issue #${issue.number}: explanation decision is ${explanationVerification.status} at ${explanationVerification.confidenceScore}/100.`,
      );
      for (const message of [
        ...provenance.errors,
        ...explanationVerification.errors,
        ...explanationVerification.challenges,
      ]) {
        errors.push(`Issue #${issue.number}: ${message}`);
      }
    }
  } catch (error) {
    errors.push(`Issue #${issue.number}: explanation verification failed: ${String(error)}`);
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log(
  JSON.stringify({
    failedRuns: failedRuns.map((run) => run.id),
    linkedIssues: linkedIssues.map((issue) => issue.number),
    outcome: declaredOutcome,
    explanationDecisions,
    semanticTruthAutomaticallyVerified: false,
    status: 'root-cause-and-explanation-governance-verified',
  }),
);
