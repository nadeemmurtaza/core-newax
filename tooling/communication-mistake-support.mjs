import { createHash } from 'node:crypto';

export const COMMUNICATION_MISTAKE_TYPES = Object.freeze([
  'requirement-misunderstood',
  'assumption-not-confirmed',
  'ambiguous-specification',
  'decision-undocumented',
  'wrong-interpretation',
  'conflicting-instructions',
  'missing-approval',
]);

export const AUTHORITY_RANK = Object.freeze({
  observer: 0,
  implementer: 1,
  reviewer: 2,
  architect: 3,
  approver: 4,
  owner: 5,
});

export const AUTHORITATIVE_TYPES = new Set([
  'requirement',
  'instruction',
  'decision',
  'clarification',
  'correction',
]);
export const CLOSED_STATUSES = new Set(['rejected', 'resolved', 'superseded', 'withdrawn']);
export const APPROVED_STATUSES = new Set(['approved', 'confirmed', 'accepted']);

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
  if (['yes', 'true', 'required'].includes(normalized)) {
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

function normalizeFile(file, index) {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) {
    throw new TypeError(`files[${index}] must be an object.`);
  }
  const filename = normalizeString(file.filename ?? file.path);
  if (filename.length === 0) {
    throw new TypeError(`files[${index}] requires filename.`);
  }
  return { filename, status: normalizeString(file.status).toLowerCase() || 'modified' };
}

export function normalizeCommit(commit, index) {
  if (commit === null || typeof commit !== 'object' || Array.isArray(commit)) {
    throw new TypeError(`commits[${index}] must be an object.`);
  }
  return {
    sha: normalizeString(commit.sha) || `commit-${index + 1}`,
    timestamp: normalizeDate(
      commit.committedAt ?? commit.authoredAt ?? commit.timestamp ?? commit.date,
    ),
    sequence: Number.isFinite(Number(commit.sequence)) ? Number(commit.sequence) : index,
    message: normalizeString(commit.message),
    files: normalizeArray(commit.files).map(normalizeFile),
  };
}

export function normalizeEvent(event, index) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError(`events[${index}] must be an object.`);
  }
  const id = normalizeString(event.id ?? event.communicationId ?? event['communication-id']);
  const type = normalizeString(event.type ?? event.event).toLowerCase();
  if (id.length === 0) {
    throw new TypeError(`events[${index}] requires communication-id.`);
  }
  if (type.length === 0) {
    throw new TypeError(`events[${index}] requires event type.`);
  }
  return {
    id,
    type,
    topic: normalizeString(event.topic).toLowerCase(),
    text: normalizeString(event.text ?? event.statement),
    value: normalizeString(event.value ?? event.choice ?? event.interpretation),
    authority: normalizeString(event.authority ?? event.role).toLowerCase() || 'observer',
    status: normalizeString(event.status).toLowerCase() || 'active',
    at: normalizeDate(event.at ?? event.createdAt ?? event.created_at),
    appliesTo: normalizeArray(event.appliesTo ?? event['applies-to'] ?? event.scope),
    references: normalizeArray(event.references ?? event.referenceIds ?? event['reference-ids']),
    conflictsWith: normalizeArray(event.conflictsWith ?? event['conflicts-with']),
    supersedes: normalizeArray(event.supersedes),
    resolves: normalizeArray(event.resolves),
    findingType: normalizeString(event.findingType ?? event['finding-type']).toLowerCase(),
    requiresConfirmation: normalizeBoolean(
      event.requiresConfirmation ?? event['requires-confirmation'],
    ),
    requiresApproval: normalizeBoolean(event.requiresApproval ?? event['requires-approval']),
    requiresDecision: normalizeBoolean(event.requiresDecision ?? event['requires-decision']),
    confirmsMisunderstanding:
      normalizeBoolean(event.confirmsMisunderstanding ?? event['confirms-misunderstanding']) ===
      true,
    reviewer: normalizeString(event.reviewer ?? event.approvedBy ?? event['approved-by']),
    reason: normalizeString(event.reason),
    source: normalizeString(event.source),
  };
}

function patternToRegExp(pattern) {
  const normalized = normalizeString(pattern).replace(/^\.\//, '');
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const wildcard = escaped.replaceAll('**', '__DOUBLE_STAR__').replaceAll('*', '[^/]*');
  return new RegExp(`^${wildcard.replaceAll('__DOUBLE_STAR__', '.*')}(?:/.*)?$`);
}

export function pathMatchesCommunicationScope(filename, patterns = []) {
  return normalizeArray(patterns).some((pattern) => patternToRegExp(pattern).test(filename));
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

export function compareCommits(left, right) {
  if (left.timestamp !== null && right.timestamp !== null) {
    const difference = Date.parse(left.timestamp) - Date.parse(right.timestamp);
    if (difference !== 0) {
      return difference;
    }
  } else if (left.timestamp !== null) {
    return -1;
  } else if (right.timestamp !== null) {
    return 1;
  }
  return left.sequence - right.sequence;
}

export function authorityRank(event) {
  return AUTHORITY_RANK[event.authority] ?? 0;
}

export function isAuthoritative(event) {
  return AUTHORITATIVE_TYPES.has(event.type) && authorityRank(event) >= 2;
}

export function createFinding({
  type,
  topic,
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
    .update(JSON.stringify({ type, topic, evidence }))
    .digest('hex')
    .slice(0, 10);
  return {
    id: `CM-${type.toUpperCase()}-${digest}`,
    type,
    topic,
    title,
    state,
    confidence,
    severity,
    eventIds: [...new Set(eventIds)],
    evidence,
    missingEvidence,
    recommendation,
    waived: false,
    waiver: null,
    resolution: null,
  };
}

export function pairwise(values) {
  const pairs = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      pairs.push([values[left], values[right]]);
    }
  }
  return pairs;
}
