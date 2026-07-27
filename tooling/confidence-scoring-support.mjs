import { createHash } from 'node:crypto';

import { CONFIDENCE_POLICY } from './confidence-scoring-policy.mjs';

const EVIDENCE_STATUSES = new Set(['verified', 'claimed', 'contradictory', 'unavailable']);

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function asArray(value) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

export function uniqueStrings(values) {
  return [...new Set(asArray(values).map(normalizeString).filter(Boolean))].sort();
}

export function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(
    CONFIDENCE_POLICY.scoreRange.minimum,
    Math.min(CONFIDENCE_POLICY.scoreRange.maximum, Math.round(number)),
  );
}

export function confidenceBand(score) {
  const normalized = clampScore(score);
  if (normalized >= CONFIDENCE_POLICY.bands.high) {
    return 'high';
  }
  if (normalized >= CONFIDENCE_POLICY.bands.medium) {
    return 'medium';
  }
  return 'low';
}

export function qualityLabel(score, status = 'scored') {
  if (status === 'insufficient-evidence') {
    return 'Insufficient';
  }
  const band = confidenceBand(score);
  return band === 'high' ? 'High' : band === 'medium' ? 'Medium' : 'Low';
}

export function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJson(entry)]),
    );
  }
  return value;
}

export function stableStringify(value, spacing = 0) {
  return JSON.stringify(stableJson(value), null, spacing);
}

export function inputDigest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function normalizeEvidence(record, index = 0) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`evidenceRecords[${index}] must be an object.`);
  }
  const id = normalizeString(record.id) || `evidence-${index + 1}`;
  const status = normalizeString(record.status).toLowerCase() || 'claimed';
  if (!EVIDENCE_STATUSES.has(status)) {
    throw new TypeError(`evidenceRecords[${index}].status is unsupported.`);
  }
  return {
    id,
    type: normalizeString(record.type).toLowerCase() || 'artifact',
    source: normalizeString(record.source),
    status,
    primary: record.primary === true,
    durable: record.durable === true,
    provenanceComplete: record.provenanceComplete === true,
    roles: uniqueStrings(record.roles),
    supports: uniqueStrings(record.supports),
    contradicts: uniqueStrings(record.contradicts),
  };
}

export function applyCaps(score, caps) {
  let result = clampScore(score);
  const applied = [];
  for (const cap of caps) {
    if (cap.applies !== true) {
      continue;
    }
    const maximum = clampScore(cap.maximum);
    if (result > maximum) {
      result = maximum;
      applied.push({ id: cap.id, maximum, reason: cap.reason });
    }
  }
  return { score: result, capsApplied: applied };
}

export function metric({
  score,
  status = 'scored',
  meaning,
  evidenceRefs = [],
  missingEvidence = [],
  capsApplied = [],
  extra = {},
}) {
  const normalizedScore = clampScore(score);
  return {
    score: normalizedScore,
    display: `${normalizedScore}%`,
    band: confidenceBand(normalizedScore),
    status,
    meaning,
    evidenceRefs: uniqueStrings(evidenceRefs),
    missingEvidence: uniqueStrings(missingEvidence),
    capsApplied,
    policyVersion: CONFIDENCE_POLICY.version,
    ...extra,
  };
}
