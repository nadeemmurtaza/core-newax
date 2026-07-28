import { createHash } from 'node:crypto';

export const AI_TOOL_MISTAKE_TYPES = Object.freeze([
  'ai-hallucination',
  'wrong-framework-api',
  'wrong-documentation-version',
  'deprecated-package',
  'unsafe-suggestion',
  'copy-paste-bug',
  'generated-dead-code',
]);

export const CLOSED_EVENT_STATUSES = new Set(['rejected', 'resolved', 'superseded', 'withdrawn']);

export const VERIFIED_EVENT_STATUSES = new Set([
  'verified',
  'confirmed',
  'failed',
  'deprecated',
  'unsafe',
  'dead',
  'unreachable',
  'unused',
  'incompatible',
  'missing',
]);

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return [];
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeString(value).toLowerCase();
  if (['yes', 'true', 'required', 'confirmed'].includes(normalized)) {
    return true;
  }
  if (['no', 'false', 'not-required', 'none'].includes(normalized)) {
    return false;
  }
  return null;
}

export function normalizeDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeHash(value) {
  const normalized = normalizeString(value).toLowerCase();
  return /^(?:sha256:)?[a-f0-9]{64}$/.test(normalized) ? normalized.replace(/^sha256:/, '') : '';
}

export function normalizeEvent(event, index) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError(`events[${index}] must be an object.`);
  }
  const id = normalizeString(event.id ?? event.eventId ?? event['event-id']);
  const type = normalizeString(event.type ?? event.event).toLowerCase();
  if (id.length === 0) {
    throw new TypeError(`events[${index}] requires event-id.`);
  }
  if (type.length === 0) {
    throw new TypeError(`events[${index}] requires event type.`);
  }
  return {
    id,
    type,
    outputId: normalizeString(event.outputId ?? event['output-id']),
    status: normalizeString(event.status).toLowerCase() || 'active',
    at: normalizeDate(event.at ?? event.createdAt ?? event.created_at),
    effectiveAt: normalizeDate(event.effectiveAt ?? event['effective-at']),
    provider: normalizeString(event.provider),
    model: normalizeString(event.model),
    tool: normalizeString(event.tool),
    toolVersion: normalizeString(event.toolVersion ?? event['tool-version']),
    sourceKind: normalizeString(event.sourceKind ?? event['source-kind']).toLowerCase(),
    promptHash: normalizeHash(event.promptHash ?? event['prompt-hash']),
    outputHash: normalizeHash(event.outputHash ?? event['output-hash']),
    artifactRefs: normalizeArray(event.artifactRefs ?? event['artifact-refs']),
    framework: normalizeString(event.framework),
    frameworkVersion: normalizeString(event.frameworkVersion ?? event['framework-version']),
    pinnedVersion: normalizeString(event.pinnedVersion ?? event['pinned-version']),
    documentationVersion: normalizeString(
      event.documentationVersion ?? event['documentation-version'],
    ),
    symbol: normalizeString(event.symbol),
    claim: normalizeString(event.claim ?? event.statement),
    expected: normalizeString(event.expected),
    actual: normalizeString(event.actual),
    packageName: normalizeString(event.packageName ?? event['package-name']),
    packageVersion: normalizeString(event.packageVersion ?? event['package-version']),
    replacement: normalizeString(event.replacement),
    policyId: normalizeString(event.policyId ?? event['policy-id']),
    validationKind: normalizeString(event.validationKind ?? event['validation-kind']).toLowerCase(),
    validationCode: normalizeString(event.validationCode ?? event['validation-code']),
    validationRef: normalizeString(event.validationRef ?? event['validation-ref']),
    copiedFrom: normalizeString(event.copiedFrom ?? event['copied-from']),
    staleIdentifiers: normalizeArray(event.staleIdentifiers ?? event['stale-identifiers']),
    generated: normalizeBoolean(event.generated),
    materialImpact: normalizeBoolean(event.materialImpact ?? event['material-impact']),
    confirmsMistake: normalizeBoolean(event.confirmsMistake ?? event['confirms-mistake']),
    references: normalizeArray(event.references),
    resolves: normalizeArray(event.resolves),
    findingType: normalizeString(event.findingType ?? event['finding-type']).toLowerCase(),
    severity: normalizeString(event.severity).toLowerCase() || 'medium',
    reviewer: normalizeString(event.reviewer),
    reason: normalizeString(event.reason),
    correctionCommit: normalizeString(event.correctionCommit ?? event['correction-commit']),
    regressionTest: normalizeString(event.regressionTest ?? event['regression-test']),
    regressionRun: normalizeString(event.regressionRun ?? event['regression-run']),
    source: normalizeString(event.source),
  };
}

export function compareEvents(left, right) {
  if (left.at !== null && right.at !== null) {
    const difference = Date.parse(left.at) - Date.parse(right.at);
    if (difference !== 0) {
      return difference;
    }
  } else if (left.at !== null) {
    return -1;
  } else if (right.at !== null) {
    return 1;
  }
  return left.id.localeCompare(right.id);
}

export function isVerifiedEvidence(event) {
  return VERIFIED_EVENT_STATUSES.has(event.status) || event.confirmsMistake === true;
}

export function isAttributableOutput(output) {
  return (
    output.type === 'ai-output' &&
    output.outputId.length > 0 &&
    output.at !== null &&
    output.outputHash.length > 0 &&
    output.artifactRefs.length > 0 &&
    (output.provider.length > 0 || output.tool.length > 0)
  );
}

export function occurredNoLaterThan(evidence, output) {
  const effectiveAt = evidence.effectiveAt ?? evidence.at;
  if (effectiveAt === null || output.at === null) {
    return null;
  }
  return Date.parse(effectiveAt) <= Date.parse(output.at);
}

export function createFinding({
  type,
  output,
  title,
  state = 'detected',
  confidence = 'high',
  severity = 'medium',
  eventIds = [],
  evidence = [],
  missingEvidence = [],
  recommendation,
}) {
  const digest = createHash('sha256')
    .update(JSON.stringify({ type, outputId: output?.outputId ?? '', eventIds, evidence }))
    .digest('hex')
    .slice(0, 12);
  return {
    id: `AIQ-${type.toUpperCase()}-${digest}`,
    type,
    outputId: output?.outputId ?? '',
    title,
    state,
    confidence,
    severity,
    attributable: output === undefined ? false : isAttributableOutput(output),
    eventIds: [...new Set(eventIds)],
    evidence,
    missingEvidence: [...new Set(missingEvidence)],
    recommendation,
    waived: false,
    waiver: null,
    resolution: null,
  };
}

export function hashIdentifier(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}
