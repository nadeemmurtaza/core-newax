export function parseRecurrenceBlocks(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
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

function list(value) {
  return String(value ?? '')
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function engineeringOccurrence(metadata, issue, source) {
  if (!metadata['root-cause-id']) {
    return null;
  }
  return {
    id:
      metadata['occurrence-id'] ||
      `issue-${issue.number}:${metadata.fingerprint || metadata['source-id'] || 'event'}`,
    rootCauseId: metadata['root-cause-id'],
    status: metadata['root-cause-status'] || 'candidate',
    occurredAt: metadata.at || metadata['occurred-at'] || issue.created_at || issue.createdAt,
    prNumber: integer(metadata['pr-number']),
    issueNumber: integer(issue.number),
    sourceId: metadata['source-id'] || source,
    fingerprint: metadata.fingerprint || null,
    commitSha: metadata['commit-sha'] || null,
    title: issue.title || null,
    url: issue.html_url || issue.url || null,
    evidenceRefs: [source],
  };
}

export function recurrenceOccurrence(metadata, issue, source) {
  if ((metadata.type || metadata.kind) !== 'occurrence') {
    return null;
  }
  return {
    id: metadata.id || metadata['occurrence-id'],
    rootCauseId: metadata['root-cause-id'],
    status: metadata.status || metadata['root-cause-status'],
    occurredAt: metadata.at || metadata['occurred-at'] || issue.created_at,
    prNumber: integer(metadata['pr-number']),
    issueNumber: integer(metadata['issue-number'] || issue.number),
    sourceId: metadata['source-id'] || source,
    fingerprint: metadata.fingerprint || null,
    commitSha: metadata['commit-sha'] || null,
    title: metadata.title || issue.title || null,
    url: metadata.url || issue.html_url || issue.url || null,
    evidenceRefs: list(metadata['evidence-refs']).concat(source),
  };
}

export function recurrenceRule(metadata, source) {
  if ((metadata.type || metadata.kind) !== 'rule') {
    return null;
  }
  return {
    id: metadata.id || metadata['rule-id'],
    rootCauseId: metadata['root-cause-id'],
    state: metadata.state,
    effectiveAt: metadata['effective-at'],
    retiredAt: metadata['retired-at'],
    title: metadata.title || metadata['prevention-control'],
    sourceRef: metadata['source-ref'] || source,
    owner: metadata.owner,
    reviewer: metadata.reviewer,
    evidenceRefs: list(metadata['evidence-refs']).concat(source),
  };
}

export function preventionRule(metadata, source) {
  const rootCauseId = metadata['root-cause-id'];
  const preventionControl = metadata['prevention-control'];
  if (!rootCauseId || !preventionControl) {
    return null;
  }
  const resolutionStatus = String(
    metadata['resolution-status'] || metadata.status || '',
  ).toLowerCase();
  if (!['resolved', 'verified', 'closed'].includes(resolutionStatus)) {
    return null;
  }
  return {
    id:
      metadata['rule-id'] ||
      `rule-${rootCauseId}-${metadata['resolved-at'] || metadata.at || 'effective'}`,
    rootCauseId,
    state: metadata['control-state'] || 'generated',
    effectiveAt: metadata['effective-at'] || metadata['resolved-at'] || metadata.at,
    title: preventionControl,
    sourceRef: source,
    owner: metadata['ci-owner'] || metadata['static-owner'] || null,
    reviewer: metadata.reviewer || metadata['ci-reviewer'] || metadata['static-reviewer'] || null,
    evidenceRefs: list(metadata['evidence-refs']).concat(source),
  };
}

export function recurrenceExplanation(metadata, source) {
  if ((metadata.type || metadata.kind) !== 'explanation') {
    return null;
  }
  return {
    id: metadata.id || metadata['explanation-id'],
    occurrenceId: metadata['occurrence-id'],
    disposition: metadata.disposition,
    state: metadata.state,
    reason: metadata.reason,
    scope: metadata.scope,
    reviewer: metadata.reviewer,
    approver: metadata.approver,
    effectiveAt: metadata['effective-at'],
    evidenceRefs: list(metadata['evidence-refs']).concat(source),
  };
}
