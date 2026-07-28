import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeRootCause,
  compareRootCauseOccurrences,
  normalizeRootCauseEvidence,
} from './root-cause-engine.mjs';
import { sanitizeEngineeringEvidence } from './sanitize-engineering-evidence.mjs';

const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(
  CURRENT_DIRECTORY,
  '../docs/verification/engineering-learning-catalog.json',
);

export const FAILURE_CONCLUSIONS = new Set(['action_required', 'failure', 'timed_out']);

export function loadCatalog(path = CATALOG_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function normalizeText(value) {
  return normalizeRootCauseEvidence(value);
}

export function classifyFailure(input, catalog = loadCatalog()) {
  const assessment = analyzeRootCause(input, catalog);
  const selected = assessment.selected;

  return {
    assessment,
    category: selected.category,
    confidence: selected.confidence,
    deterministic: assessment.deterministic,
    ledgerEntry: selected.ledgerEntry,
    matchedSignatures: selected.matchedSignatures,
    preventionControl: selected.preventionControl,
    rootCauseCandidate: selected.rootCause,
    rootCauseId: selected.rootCauseId,
    successfulMethod: selected.successfulMethod,
    unsuccessfulMethod: selected.unsuccessfulMethod,
  };
}

export function createFingerprint({ classification, workflowName, jobName, stepName, logText }) {
  const normalizedLog = normalizeText(logText).slice(-4_000);
  const source = [
    classification.rootCauseId,
    normalizeText(workflowName),
    normalizeText(jobName),
    normalizeText(stepName),
    normalizedLog,
  ].join('|');

  return createHash('sha256').update(source).digest('hex');
}

export function createEngineeringEvent(input, catalog = loadCatalog()) {
  const classification = classifyFailure(input, catalog);
  const fingerprint = createFingerprint({ ...input, classification });

  return {
    schemaVersion: 2,
    sourceType: input.sourceType ?? 'unknown',
    sourceId:
      input.sourceId === undefined || input.sourceId === null
        ? null
        : sanitizeEngineeringEvidence(input.sourceId),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    repository: input.repository ?? null,
    prNumber: toOptionalInteger(input.prNumber),
    commitSha: input.commitSha ?? null,
    workflowRunId: toOptionalInteger(input.workflowRunId),
    workflowName:
      input.workflowName === undefined || input.workflowName === null
        ? null
        : sanitizeEngineeringEvidence(input.workflowName),
    jobId: toOptionalInteger(input.jobId),
    jobName:
      input.jobName === undefined || input.jobName === null
        ? null
        : sanitizeEngineeringEvidence(input.jobName),
    stepName:
      input.stepName === undefined || input.stepName === null
        ? null
        : sanitizeEngineeringEvidence(input.stepName),
    category: classification.category,
    symptom: summarizeSymptom(
      input.logText ?? input.summary ?? input.stepName ?? 'Unknown failure',
    ),
    rootCauseId: classification.rootCauseId,
    rootCauseCandidate: sanitizeEngineeringEvidence(classification.rootCauseCandidate),
    rootCauseConfidence: classification.confidence,
    rootCauseDeterministic: classification.deterministic,
    rootCauseAssessment: classification.assessment,
    matchedSignatures: classification.matchedSignatures,
    unsuccessfulMethod: sanitizeEngineeringEvidence(
      input.unsuccessfulMethod ?? classification.unsuccessfulMethod,
    ),
    successfulMethod: sanitizeEngineeringEvidence(
      input.successfulMethod ?? classification.successfulMethod,
    ),
    preventionControl: sanitizeEngineeringEvidence(
      input.preventionControl ?? classification.preventionControl,
    ),
    ledgerEntry: classification.ledgerEntry,
    fingerprint,
    evidenceUrls: Array.from(new Set((input.evidenceUrls ?? []).filter(Boolean))),
    status: classification.deterministic ? 'machine-supported' : 'candidate',
  };
}

export function summarizeSymptom(value) {
  const normalized = normalizeText(value);
  return normalized.length <= 500 ? normalized : `${normalized.slice(0, 497)}...`;
}

export function parseMetadata(body) {
  const match = String(body ?? '').match(/<!-- newax-engineering-event\n([\s\S]*?)\n-->/);
  if (match === null) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf(':');
        if (index === -1) {
          return [line, ''];
        }
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

function renderEvidenceList(values, emptyMessage) {
  return values.length === 0
    ? `- ${emptyMessage}`
    : values.map((value) => `- ${sanitizeEngineeringEvidence(value)}`).join('\n');
}

function renderAlternativeHypotheses(event) {
  const alternatives = event.rootCauseAssessment.hypotheses.filter(
    (hypothesis) => hypothesis.rootCauseId !== event.rootCauseId,
  );
  return alternatives.length === 0
    ? '- No competing catalog hypothesis matched.'
    : alternatives
        .map(
          (hypothesis) =>
            `- \`${hypothesis.rootCauseId}\`: score ${hypothesis.score}, confidence ${hypothesis.confidence}`,
        )
        .join('\n');
}

export function renderIssueBody(event) {
  const evidence =
    event.evidenceUrls.length === 0
      ? '- No URL was supplied.'
      : event.evidenceUrls.map((url) => `- ${url}`).join('\n');
  const matchedSignatures =
    event.matchedSignatures.length === 0 ? 'none' : event.matchedSignatures.join('|');

  return `<!-- newax-engineering-event
fingerprint: ${event.fingerprint}
source-type: ${event.sourceType}
source-id: ${event.sourceId ?? 'none'}
pr-number: ${event.prNumber ?? 'none'}
commit-sha: ${event.commitSha ?? 'none'}
workflow-run-id: ${event.workflowRunId ?? 'none'}
job-id: ${event.jobId ?? 'none'}
step-name: ${event.stepName ?? 'none'}
failure-category: ${event.category}
matched-signatures: ${matchedSignatures}
root-cause-id: ${event.rootCauseId}
root-cause-confidence: ${event.rootCauseConfidence}
root-cause-status: ${event.status}
duplicate-of: ${event.duplicateOfIssue ?? 'none'}
-->
# Engineering Learning Intake

## Machine-captured evidence

- Category: \`${event.category}\`
- Symptom: ${event.symptom}
- Source type: \`${event.sourceType}\`
- Workflow: ${event.workflowName ?? 'Not applicable'}
- Job: ${event.jobName ?? 'Not applicable'}
- Failed step: ${event.stepName ?? 'Not applicable'}
- Commit: ${event.commitSha ?? 'Not applicable'}
- Pull request: ${event.prNumber === null ? 'Not linked' : `#${event.prNumber}`}
- Fingerprint: \`${event.fingerprint}\`
- Root-cause ID: \`${event.rootCauseId}\`
- Machine confidence: \`${event.rootCauseConfidence}\`
- Machine-supported classification: \`${event.rootCauseDeterministic ? 'yes' : 'no'}\`
- Ambiguous hypothesis: \`${event.rootCauseAssessment.ambiguous ? 'yes' : 'no'}\`
- Matching root-cause occurrence: ${event.duplicateOfIssue === undefined ? 'None found' : `#${event.duplicateOfIssue}`}

## Evidence links

${evidence}

## Root-cause engine evidence

### Observed facts

${renderEvidenceList(event.rootCauseAssessment.observedFacts, 'No structured fact was available.')}

### Evidence for the selected cause

${renderEvidenceList(event.rootCauseAssessment.evidenceFor, 'No supporting catalog signature was observed.')}

### Evidence against the selected cause

${renderEvidenceList(event.rootCauseAssessment.evidenceAgainst, 'No contradiction was detected in available evidence.')}

### Missing evidence

${renderEvidenceList(event.rootCauseAssessment.missingEvidence, 'No additional machine evidence is required.')}

### Alternative hypotheses

${renderAlternativeHypotheses(event)}

## Root-cause assessment

- Root-cause status: \`${event.status}\`
- Root-cause candidate: ${event.rootCauseCandidate}
- Unsuccessful method: ${event.unsuccessfulMethod}
- Successful method: ${event.successfulMethod}
- Prevention control: ${event.preventionControl}
- Ledger entry: \`${event.ledgerEntry ?? 'pending'}\`

## Required confirmation

- [ ] Complete logs and affected scope reviewed.
- [ ] Immediate failure distinguished from root cause.
- [ ] Root cause confirmed or corrected with evidence.
- [ ] Unsuccessful method recorded accurately.
- [ ] Successful method passed focused verification.
- [ ] Complete applicable verification passed.
- [ ] Regression prevention added.
- [ ] Ledger entry created or existing entry linked.

## Resolution record

- Root-cause status: \`candidate\`
- Confirmed root cause: Pending.
- Resolution status: \`unverified\`
- Fix commit: Pending.
- Successful verification: Pending.
- Reviewer confirmation: Pending.
`;
}

export function renderRecurrenceComment(event) {
  return `A matching engineering failure recurred.

- Occurred at: ${event.occurredAt}
- Source: ${event.sourceType}
- Pull request: ${event.prNumber === null ? 'Not linked' : `#${event.prNumber}`}
- Commit: ${event.commitSha ?? 'Not applicable'}
- Workflow: ${event.workflowName ?? 'Not applicable'}
- Failed step: ${event.stepName ?? 'Not applicable'}
- Fingerprint: \`${event.fingerprint}\`
- Root-cause ID: \`${event.rootCauseId}\`

The existing prevention control must be reassessed before the same method is retried.`;
}

export function appendLocalEvent(event, path = '.newax/engineering-events.ndjson') {
  const absolutePath = resolve(process.cwd(), path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  appendFileSync(absolutePath, `${JSON.stringify(event)}\n`, 'utf8');
  return absolutePath;
}

export async function githubRequest(path, options = {}) {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;

  if (token === undefined || token.length === 0) {
    throw new Error('GITHUB_TOKEN is required for GitHub learning operations.');
  }
  if (repository === undefined || repository.length === 0) {
    throw new Error('GITHUB_REPOSITORY is required for GitHub learning operations.');
  }

  const url = path.startsWith('http') ? path : `https://api.github.com/repos/${repository}${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...options.headers,
  };
  if (options.body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub request failed (${response.status} ${response.statusText}): ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export async function listAll(path, options = {}) {
  const { collectionKey, ...requestOptions } = options;
  const results = [];
  let page = 1;

  while (page <= 20) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await githubRequest(
      `${path}${separator}per_page=100&page=${page}`,
      requestOptions,
    );
    const items = Array.isArray(response)
      ? response
      : collectionKey === undefined
        ? []
        : (response?.[collectionKey] ?? []);

    if (items.length === 0) {
      break;
    }
    results.push(...items);
    if (items.length < 100) {
      break;
    }
    page += 1;
  }

  return results;
}

export async function ensureLabel(name, color, description, options = {}) {
  try {
    await githubRequest(`/labels/${encodeURIComponent(name)}`, options);
  } catch (error) {
    if (!String(error).includes('(404 ')) {
      throw error;
    }
    await githubRequest('/labels', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ name, color, description }),
    });
  }
}

export async function findMatchingIssues(event, options = {}) {
  const issues = await listAll('/issues?state=all', options);
  const candidates = issues
    .filter((issue) => issue.pull_request === undefined)
    .map((issue) => {
      const metadata = parseMetadata(issue.body);
      return {
        issue,
        metadata,
        relationship: compareRootCauseOccurrences(event, metadata),
      };
    });

  const exactOccurrence = candidates.find(
    ({ relationship }) => relationship.relation === 'exact-occurrence',
  );
  const sameRootCause = candidates
    .filter(({ relationship }) => relationship.relation === 'shared-root-cause')
    .sort((first, second) => second.relationship.score - first.relationship.score)[0];

  return {
    exactOccurrence: exactOccurrence?.issue,
    sameRootCause: sameRootCause?.issue,
    sameRootCauseRelationship: sameRootCause?.relationship ?? null,
  };
}

export async function createOrUpdateLearningIssue(event, options = {}) {
  await ensureLabel(
    'engineering-learning',
    '1D76DB',
    'Structured engineering learning intake.',
    options,
  );
  await ensureLabel(
    'learning-candidate',
    'FBCA04',
    'Root cause or resolution requires confirmation.',
    options,
  );
  await ensureLabel(
    'learning-recurrence',
    'D93F0B',
    'A known or matching failure recurred.',
    options,
  );
  await ensureLabel(
    'learning-duplicate-root-cause',
    '8250DF',
    'Another occurrence shares a classified root cause.',
    options,
  );

  const matches = await findMatchingIssues(event, options);
  const existing = matches.exactOccurrence;
  if (existing !== undefined) {
    if (existing.state === 'closed') {
      await githubRequest(`/issues/${existing.number}`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify({ state: 'open' }),
      });
    }
    await githubRequest(`/issues/${existing.number}/labels`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ labels: ['learning-recurrence'] }),
    });
    await githubRequest(`/issues/${existing.number}/comments`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ body: renderRecurrenceComment(event) }),
    });
    return { issueNumber: existing.number, created: false };
  }

  const eventWithDuplicate =
    matches.sameRootCause === undefined
      ? event
      : { ...event, duplicateOfIssue: matches.sameRootCause.number };

  const issue = await githubRequest('/issues', {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      title: `[Engineering learning] ${event.category}: ${event.stepName ?? event.symptom}`.slice(
        0,
        240,
      ),
      body: renderIssueBody(eventWithDuplicate),
      labels: [
        'engineering-learning',
        'learning-candidate',
        ...(matches.sameRootCause === undefined ? [] : ['learning-duplicate-root-cause']),
      ],
    }),
  });

  return { issueNumber: issue.number, created: true };
}

export function parsePullRequestField(body, label) {
  const line = String(body ?? '')
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.startsWith(label));

  if (line === undefined) {
    return null;
  }

  return line.slice(label.length).trim().replaceAll('`', '');
}

export function parseIssueNumbers(value) {
  return Array.from(
    new Set(
      Array.from(String(value ?? '').matchAll(/#?(\d+)/g), (match) => Number(match[1])).filter(
        Number.isSafeInteger,
      ),
    ),
  );
}

export function parseIssueNumber(value) {
  return parseIssueNumbers(value)[0] ?? null;
}

export function parseLedgerEntries(value) {
  return Array.from(new Set(String(value ?? '').match(/EL-\d{4}/g) ?? []));
}

export function toOptionalInteger(value) {
  if (value === undefined || value === null || value === '' || value === 'none') {
    return null;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
