import { readFileSync } from 'node:fs';

import {
  createEngineeringEvent,
  ensureLabel,
  githubRequest,
  parseMetadata,
  renderIssueBody,
} from './engineering-learning-core.mjs';
import { applyExternalSourceClassification } from './external-event-classification.mjs';
import { sanitizeEngineeringEvidence } from './sanitize-engineering-evidence.mjs';

const SOURCE_TYPES = {
  'Communication or polling': 'communication',
  'External tool': 'external-tool',
  'Local command': 'local-command',
  'Manual observation': 'manual',
  'Planning or decision quality': 'planning',
};

function readSection(body, heading) {
  const escaped = heading.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`### ${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`));
  if (match === null) {
    return '';
  }
  return match[1].trim();
}

function extractUrls(value) {
  return Array.from(new Set(String(value).match(/https?:\/\/[^\s)]+/g) ?? []));
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath === undefined || eventPath.length === 0) {
  throw new Error('GITHUB_EVENT_PATH is required.');
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const issue = event.issue;
if (issue === undefined || issue.pull_request !== undefined) {
  process.exit(0);
}
if (parseMetadata(issue.body).fingerprint !== undefined) {
  console.log(`Issue #${issue.number} is already normalized.`);
  process.exit(0);
}
if (!issue.title.startsWith('[Engineering learning]')) {
  process.exit(0);
}

const sourceLabel = readSection(issue.body, 'Source type');
const sourceType = SOURCE_TYPES[sourceLabel] ?? 'manual';
const symptom = readSection(issue.body, 'Exact symptom or mistake');
const evidence = sanitizeEngineeringEvidence(readSection(issue.body, 'Evidence'));
const rootCauseCandidate = readSection(issue.body, 'Root-cause candidate');
const unsuccessfulMethod = readSection(issue.body, 'Unsuccessful method');
const successfulMethod = readSection(issue.body, 'Successful method');
const preventionControl = readSection(issue.body, 'Prevention control');
const prNumber =
  Number(readSection(issue.body, 'Related pull request').match(/\d+/)?.[0] ?? 0) || null;
const commitSha = readSection(issue.body, 'Related commit') || null;

if (symptom.length === 0) {
  throw new Error(`Engineering learning issue #${issue.number} has no symptom.`);
}

const baseEvent = createEngineeringEvent({
  sourceType,
  sourceId: `issue-${issue.number}`,
  occurredAt: issue.created_at,
  repository: process.env.GITHUB_REPOSITORY,
  prNumber,
  commitSha,
  stepName: 'Structured engineering mistake issue',
  logText: symptom,
  unsuccessfulMethod: unsuccessfulMethod || undefined,
  successfulMethod: successfulMethod || undefined,
  preventionControl: preventionControl || undefined,
  evidenceUrls: extractUrls(evidence),
});
const learningEvent = {
  ...applyExternalSourceClassification(baseEvent, sourceType, symptom),
  rootCauseCandidate:
    sanitizeEngineeringEvidence(rootCauseCandidate) ||
    'The issue records a candidate cause that requires evidence-backed confirmation.',
};

for (const [name, color, description] of [
  ['engineering-learning', '1D76DB', 'Structured engineering learning intake.'],
  ['learning-candidate', 'FBCA04', 'Root cause or resolution requires confirmation.'],
]) {
  await ensureLabel(name, color, description);
}

const normalizedBody = `${renderIssueBody(learningEvent)}\n## Original submitted evidence\n\n${evidence || 'No additional evidence text was submitted.'}\n`;
await githubRequest(`/issues/${issue.number}`, {
  method: 'PATCH',
  body: JSON.stringify({
    body: normalizedBody,
    labels: Array.from(
      new Set([
        ...(issue.labels ?? []).map((label) => label.name),
        'engineering-learning',
        'learning-candidate',
      ]),
    ),
  }),
});

console.log(`Normalized engineering learning issue #${issue.number}.`);
