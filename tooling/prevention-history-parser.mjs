import { parseIssueNumbers, parsePullRequestField } from './engineering-learning-core.mjs';
import { normalizeString, uniqueStrings } from './prevention-engine-support.mjs';

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function controlOptions(values = {}) {
  const ci = {
    owner: normalizeString(values.ciOwner),
    reviewer: normalizeString(values.ciReviewer),
    implementationRef: normalizeString(values.ciImplementationRef),
    verificationRefs: splitList(values.ciVerificationRefs),
  };
  const staticAnalysis = {
    owner: normalizeString(values.staticOwner),
    reviewer: normalizeString(values.staticReviewer),
    implementationRef: normalizeString(values.staticImplementationRef),
    verificationRefs: splitList(values.staticVerificationRefs),
  };
  const controls = {};
  if (
    Object.values(ci).some((value) => (Array.isArray(value) ? value.length > 0 : value.length > 0))
  ) {
    controls['ci-check'] = ci;
  }
  if (
    Object.values(staticAnalysis).some((value) =>
      Array.isArray(value) ? value.length > 0 : value.length > 0,
    )
  ) {
    controls['static-analysis-rule'] = staticAnalysis;
  }
  return controls;
}

function parseBlocks(body, blockName) {
  const expression = new RegExp(`<!-- ${blockName}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) =>
    Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(':');
          return separator === -1
            ? [line.toLowerCase(), '']
            : [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
        }),
    ),
  );
}

function extractHeadingValue(body, heading) {
  const lines = String(body ?? '').split('\n');
  const target = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^#{2,4}\s+(.+)$/);
    return match !== null && match[1].trim().toLowerCase() === target;
  });
  if (start === -1) {
    return '';
  }
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{2,4}\s+/.test(lines[index])) {
      break;
    }
    const normalized = lines[index].trim();
    if (normalized.length > 0) {
      values.push(normalized.replace(/^[-*]\s*/, ''));
    }
  }
  return values
    .join('\n')
    .replace(/^```[^\n]*\n?|```$/g, '')
    .trim();
}

function extractListField(body, label) {
  const match = String(body ?? '').match(new RegExp(`^-\\s*${label}:\\s*(.+)$`, 'im'));
  if (match !== null) {
    return match[1].replaceAll('`', '').trim();
  }
  const lines = String(body ?? '').split('\n');
  const line = lines.find((entry) =>
    entry.trim().toLowerCase().startsWith(`- ${label.toLowerCase()}:`),
  );
  return line === undefined
    ? ''
    : line
        .slice(line.indexOf(':') + 1)
        .replaceAll('`', '')
        .trim();
}

function eventFromMetadata(metadata, source, createdAt, issueNumber) {
  return {
    id: metadata['event-id'] ?? metadata.id ?? `issue-${issueNumber}`,
    issueNumber,
    rootCauseId: metadata['root-cause-id'],
    ledgerEntry: metadata['ledger-entry'],
    category: metadata.category,
    status: metadata.status,
    rootCauseStatus: metadata['root-cause-status'],
    resolutionStatus: metadata['resolution-status'],
    resolvedAt: metadata['resolved-at'] ?? metadata.at ?? createdAt,
    fixCommit: metadata['fix-commit'],
    reviewer: metadata.reviewer,
    reviewedAt: metadata['reviewed-at'],
    verificationRefs: splitList(metadata['verification-refs']),
    regressionRefs: splitList(metadata['regression-refs']),
    preventionControl: metadata['prevention-control'],
    successfulMethod: metadata['successful-method'],
    unsuccessfulMethod: metadata['unsuccessful-method'],
    evidenceRefs: splitList(metadata['evidence-refs']),
    controlOptions: controlOptions({
      ciOwner: metadata['ci-owner'],
      ciReviewer: metadata['ci-reviewer'],
      ciImplementationRef: metadata['ci-implementation-ref'],
      ciVerificationRefs: metadata['ci-verification-refs'],
      staticOwner: metadata['static-owner'],
      staticReviewer: metadata['static-reviewer'],
      staticImplementationRef: metadata['static-implementation-ref'],
      staticVerificationRefs: metadata['static-verification-refs'],
    }),
    source,
  };
}

function eventFromIssueForm(issue, source, createdAt) {
  const body = issue.body ?? '';
  const id = extractHeadingValue(body, 'Event ID');
  const rootCauseId = extractHeadingValue(body, 'Root cause ID');
  if (id.length === 0 || rootCauseId.length === 0) {
    return null;
  }
  return {
    id,
    issueNumber: Number(issue.number),
    rootCauseId,
    ledgerEntry: extractHeadingValue(body, 'Ledger entry'),
    category: extractHeadingValue(body, 'Category'),
    status: extractHeadingValue(body, 'Status'),
    rootCauseStatus: extractHeadingValue(body, 'Root-cause status'),
    resolutionStatus: extractHeadingValue(body, 'Resolution status'),
    resolvedAt: extractHeadingValue(body, 'Resolved at') || createdAt,
    fixCommit: extractHeadingValue(body, 'Fix commit'),
    reviewer: extractHeadingValue(body, 'Reviewer'),
    reviewedAt: extractHeadingValue(body, 'Reviewed at'),
    verificationRefs: splitList(extractHeadingValue(body, 'Verification references')),
    regressionRefs: splitList(extractHeadingValue(body, 'Regression references')),
    preventionControl: extractHeadingValue(body, 'Prevention control'),
    successfulMethod: extractHeadingValue(body, 'Successful method'),
    unsuccessfulMethod: extractHeadingValue(body, 'Unsuccessful method'),
    evidenceRefs: splitList(extractHeadingValue(body, 'Evidence references')),
    controlOptions: controlOptions({
      ciOwner: extractHeadingValue(body, 'CI control owner'),
      ciReviewer: extractHeadingValue(body, 'CI control reviewer'),
      ciImplementationRef: extractHeadingValue(body, 'CI implementation reference'),
      ciVerificationRefs: extractHeadingValue(body, 'CI verification references'),
      staticOwner: extractHeadingValue(body, 'Static-analysis control owner'),
      staticReviewer: extractHeadingValue(body, 'Static-analysis control reviewer'),
      staticImplementationRef: extractHeadingValue(
        body,
        'Static-analysis implementation reference',
      ),
      staticVerificationRefs: extractHeadingValue(body, 'Static-analysis verification references'),
    }),
    source,
  };
}

function legacyFromIssue(issue, source) {
  const body = issue.body ?? '';
  const engineering = parseBlocks(body, 'newax-engineering-event').at(-1) ?? {};
  const rootCauseStatus =
    extractListField(body, 'Root-cause status') || engineering['root-cause-status'];
  const resolutionStatus = extractListField(body, 'Resolution status');
  const reviewer = extractListField(body, 'Reviewer confirmation');
  const fixCommit = extractListField(body, 'Fix commit') || engineering['commit-sha'];
  const verification = extractListField(body, 'Successful verification');
  const ledgerEntry = extractListField(body, 'Ledger entry');
  const preventionControl = extractListField(body, 'Prevention control');
  if (normalizeString(engineering['root-cause-id']).length === 0) {
    return null;
  }
  return {
    id: `issue-${issue.number}`,
    issueNumber: Number(issue.number),
    rootCauseId: engineering['root-cause-id'],
    ledgerEntry,
    category: engineering['failure-category'],
    status: issue.state,
    rootCauseStatus,
    resolutionStatus,
    resolvedAt: issue.closed_at ?? null,
    fixCommit,
    reviewer,
    reviewedAt: extractListField(body, 'Reviewed at'),
    verificationRefs: verification.length === 0 ? [] : [verification],
    regressionRefs: splitList(extractListField(body, 'Regression evidence')),
    preventionControl,
    successfulMethod: extractListField(body, 'Successful method'),
    unsuccessfulMethod: extractListField(body, 'Unsuccessful method'),
    evidenceRefs: [`issue:${issue.number}`],
    controlOptions: {},
    source,
  };
}

export function parseResolvedMistakes(issue, comments = []) {
  const source = `issue:${issue.number}`;
  const createdAt = issue.created_at ?? issue.createdAt ?? null;
  const events = [
    ...parseBlocks(issue.body ?? '', 'newax-prevention-event').map((metadata) =>
      eventFromMetadata(metadata, source, createdAt, Number(issue.number)),
    ),
    ...comments.flatMap((comment) =>
      parseBlocks(comment.body ?? '', 'newax-prevention-event').map((metadata) =>
        eventFromMetadata(
          metadata,
          `issue-${issue.number}-comment:${comment.id ?? 'unknown'}`,
          comment.created_at ?? comment.createdAt ?? null,
          Number(issue.number),
        ),
      ),
    ),
  ];
  const formEvent = eventFromIssueForm(issue, source, createdAt);
  if (formEvent !== null && !events.some((event) => event.id === formEvent.id)) {
    events.push(formEvent);
  }
  const resolvedEvents = events.filter(
    (event) =>
      ['resolved', 'verified'].includes(normalizeString(event.resolutionStatus).toLowerCase()) ||
      ['resolved', 'closed'].includes(normalizeString(event.status).toLowerCase()),
  );
  if (resolvedEvents.length > 0) {
    return resolvedEvents;
  }
  const legacy = legacyFromIssue(issue, source);
  if (legacy === null) {
    return [];
  }
  const isResolved =
    normalizeString(issue.state).toLowerCase() === 'closed' ||
    ['resolved', 'verified'].includes(normalizeString(legacy.resolutionStatus).toLowerCase());
  return isResolved ? [legacy] : [];
}

export function buildPreventionControlOptions(mistakes) {
  const options = {};
  const ordered = [...mistakes].sort((left, right) => {
    const leftTime = Date.parse(normalizeString(left.resolvedAt));
    const rightTime = Date.parse(normalizeString(right.resolvedAt));
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return normalizeString(left.id).localeCompare(normalizeString(right.id));
  });
  for (const mistake of ordered) {
    const rootCauseId = normalizeString(mistake.rootCauseId);
    if (rootCauseId.length === 0) {
      continue;
    }
    const controls = mistake.controlOptions ?? {};
    if (Object.keys(controls).length === 0) {
      continue;
    }
    options[rootCauseId] ??= { controls: {} };
    for (const [type, override] of Object.entries(controls)) {
      options[rootCauseId].controls[type] = override;
    }
  }
  return options;
}

export function parsePreventionIssueNumbers(pullRequestBody) {
  const values = [
    parsePullRequestField(pullRequestBody, '- Prevention records:'),
    parsePullRequestField(pullRequestBody, '- Learning issues:'),
  ];
  return [...new Set(values.flatMap((value) => (value === null ? [] : parseIssueNumbers(value))))];
}

export function parsePreventionPackReferences(body) {
  return uniqueStrings(
    parseBlocks(body, 'newax-prevention-pack').flatMap((metadata) => splitList(metadata.paths)),
  );
}
