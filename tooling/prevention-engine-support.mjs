import { createHash } from 'node:crypto';

export const PREVENTION_CONTROL_TYPES = Object.freeze([
  'ci-check',
  'pr-checklist',
  'review-checklist',
  'coding-standard',
  'verification-rule',
  'static-analysis-rule',
  'test-template',
]);

export const EXECUTABLE_CONTROL_TYPES = new Set(['ci-check', 'static-analysis-rule']);

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

export function uniqueStrings(value) {
  return [...new Set(normalizeArray(value).map(normalizeString).filter(Boolean))].sort();
}

export function isIsoTimestamp(value) {
  const normalized = normalizeString(value);
  return normalized.length > 0 && Number.isFinite(Date.parse(normalized));
}

export function isFullCommitSha(value) {
  return /^[0-9a-f]{40}$/i.test(normalizeString(value));
}

export function rootCauseSlug(rootCauseId) {
  const normalized = normalizeString(rootCauseId).toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (slug.length === 0) {
    throw new TypeError('A stable root-cause ID is required.');
  }
  return slug;
}

export function controlId(rootCauseId, type) {
  return `PREV-${rootCauseSlug(rootCauseId).toUpperCase()}-${type.toUpperCase()}`;
}

export function controlTargetPath(rootCauseId, type) {
  const slug = rootCauseSlug(rootCauseId);
  const targets = {
    'ci-check': `.newax/prevention/ci/${slug}.json`,
    'pr-checklist': `.newax/prevention/pr-checklists/${slug}.md`,
    'review-checklist': `.newax/prevention/review-checklists/${slug}.md`,
    'coding-standard': `.newax/prevention/coding-standards/${slug}.md`,
    'verification-rule': `.newax/prevention/verification-rules/${slug}.json`,
    'static-analysis-rule': `.newax/prevention/static-analysis/${slug}.json`,
    'test-template': `.newax/prevention/test-templates/${slug}.md`,
  };
  if (!(type in targets)) {
    throw new TypeError(`Unknown prevention control type: ${type}`);
  }
  return targets[type];
}

export function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJson(entry)]),
    );
  }
  return value;
}

export function stableStringify(value, spacing = 2) {
  return JSON.stringify(stableJson(value), null, spacing);
}

export function contentDigest(value) {
  return createHash('sha256').update(stableStringify(value, 0)).digest('hex');
}

export function normalizeMistake(input = {}) {
  const resolution = input.resolution ?? {};
  return {
    id: normalizeString(input.id) || `issue-${Number(input.issueNumber) || 'unknown'}`,
    issueNumber: Number.isSafeInteger(Number(input.issueNumber)) ? Number(input.issueNumber) : null,
    rootCauseId: normalizeString(input.rootCauseId),
    ledgerEntry: normalizeString(input.ledgerEntry),
    category: normalizeString(input.category) || 'unknown',
    status: normalizeString(input.status).toLowerCase(),
    rootCauseStatus: normalizeString(input.rootCauseStatus).toLowerCase(),
    resolutionStatus: normalizeString(input.resolutionStatus ?? resolution.status).toLowerCase(),
    resolvedAt: normalizeString(input.resolvedAt ?? resolution.resolvedAt),
    fixCommit: normalizeString(input.fixCommit ?? resolution.fixCommit),
    reviewer: normalizeString(input.reviewer ?? resolution.reviewer),
    reviewedAt: normalizeString(input.reviewedAt ?? resolution.reviewedAt),
    verificationRefs: uniqueStrings(input.verificationRefs ?? resolution.verificationRefs),
    regressionRefs: uniqueStrings(input.regressionRefs ?? resolution.regressionRefs),
    preventionControl: normalizeString(input.preventionControl),
    successfulMethod: normalizeString(input.successfulMethod),
    unsuccessfulMethod: normalizeString(input.unsuccessfulMethod),
    evidenceRefs: uniqueStrings(input.evidenceRefs),
  };
}

export function resolutionEvidence(mistakeInput) {
  const mistake = normalizeMistake(mistakeInput);
  const missing = [];
  if (mistake.rootCauseId.length === 0) {
    missing.push('root-cause-id');
  }
  if (!['confirmed', 'machine-supported'].includes(mistake.rootCauseStatus)) {
    missing.push('confirmed-root-cause');
  }
  if (!['resolved', 'verified'].includes(mistake.resolutionStatus)) {
    missing.push('verified-resolution-status');
  }
  if (!isFullCommitSha(mistake.fixCommit)) {
    missing.push('exact-fix-commit');
  }
  if (mistake.reviewer.length === 0) {
    missing.push('reviewer');
  }
  if (!isIsoTimestamp(mistake.reviewedAt)) {
    missing.push('reviewed-at');
  }
  if (!isIsoTimestamp(mistake.resolvedAt)) {
    missing.push('resolved-at');
  }
  if (mistake.verificationRefs.length === 0) {
    missing.push('verification-evidence');
  }
  if (mistake.regressionRefs.length === 0) {
    missing.push('regression-evidence');
  }
  if (mistake.preventionControl.length === 0) {
    missing.push('prevention-control');
  }
  return { mistake, missing, ready: missing.length === 0 };
}

export function hasExecutableImplementation(override = {}) {
  return (
    normalizeString(override.owner).length > 0 &&
    normalizeString(override.reviewer).length > 0 &&
    normalizeString(override.implementationRef).length > 0 &&
    uniqueStrings(override.verificationRefs).length > 0
  );
}

export function assertDeclarativeDefinition(type, definition) {
  if (definition === null || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError(`${type} definition must be a declarative object.`);
  }
  const prohibited = new Set(['command', 'script', 'shell', 'exec', 'run', 'code', 'source']);
  const visit = (value, path = []) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, String(index)]));
      return;
    }
    if (value === null || typeof value !== 'object') {
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = [...path, key];
      if (prohibited.has(key.toLowerCase())) {
        throw new TypeError(
          `${type} cannot contain arbitrary executable field: ${nextPath.join('.')}.`,
        );
      }
      visit(entry, nextPath);
    }
  };
  visit(definition);
  return definition;
}

export function validSupersession(value = {}) {
  return (
    normalizeString(value.approver).length > 0 &&
    normalizeString(value.reason).length >= 12 &&
    isIsoTimestamp(value.effectiveAt)
  );
}
