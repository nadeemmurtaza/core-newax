import {
  EXECUTIVE_DASHBOARD_SCHEMA_VERSION,
  MAX_DASHBOARD_RECORDS,
} from './executive-dashboard-schema.mjs';
import {
  assertDashboardPrivacy,
  normalizeDashboardWindow,
  requireDashboardObject,
  stableDashboardStringify,
  stableDashboardValue,
} from './executive-dashboard-normalization-core.mjs';
import {
  normalizeDashboardCost,
  normalizeDashboardOccurrence,
  normalizeDashboardRecurrence,
  normalizeDashboardRule,
  normalizeDashboardTimeLoss,
} from './executive-dashboard-normalization-evidence.mjs';
import {
  normalizeDashboardAi,
  normalizeDashboardConfidence,
  normalizeDashboardGovernance,
  normalizeDashboardReview,
} from './executive-dashboard-normalization-quality.mjs';

export * from './executive-dashboard-normalization-core.mjs';
export * from './executive-dashboard-normalization-evidence.mjs';
export * from './executive-dashboard-normalization-quality.mjs';

function dedupe(records, label) {
  const byId = new Map();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (existing === undefined) {
      byId.set(record.id, record);
      continue;
    }
    if (stableDashboardStringify(existing) !== stableDashboardStringify(record)) {
      throw new TypeError(`${label} ID ${record.id} has conflicting content.`);
    }
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeCollection(values, label, normalizer) {
  if (!Array.isArray(values ?? [])) {
    throw new TypeError(`${label} must be an array.`);
  }
  if ((values ?? []).length > MAX_DASHBOARD_RECORDS) {
    throw new TypeError(`${label} exceeds ${MAX_DASHBOARD_RECORDS} records.`);
  }
  return dedupe((values ?? []).map(normalizer), label);
}

export function normalizeExecutiveDashboardInput(input = {}) {
  requireDashboardObject(input, 'dashboard input');
  assertDashboardPrivacy(input);
  const normalized = {
    schemaVersion: EXECUTIVE_DASHBOARD_SCHEMA_VERSION,
    ...normalizeDashboardWindow(input),
    occurrences: normalizeCollection(
      input.occurrences,
      'occurrences',
      normalizeDashboardOccurrence,
    ),
    costRecords: normalizeCollection(input.costRecords, 'costRecords', normalizeDashboardCost),
    timeLossRecords: normalizeCollection(
      input.timeLossRecords,
      'timeLossRecords',
      normalizeDashboardTimeLoss,
    ),
    rules: normalizeCollection(input.rules, 'rules', normalizeDashboardRule),
    recurrenceDecisions: normalizeCollection(
      input.recurrenceDecisions,
      'recurrenceDecisions',
      normalizeDashboardRecurrence,
    ),
    aiRecords: normalizeCollection(input.aiRecords, 'aiRecords', normalizeDashboardAi),
    reviewRecords: normalizeCollection(
      input.reviewRecords,
      'reviewRecords',
      normalizeDashboardReview,
    ),
    confidenceRecords: normalizeCollection(
      input.confidenceRecords,
      'confidenceRecords',
      normalizeDashboardConfidence,
    ),
    governanceRecords: normalizeCollection(
      input.governanceRecords,
      'governanceRecords',
      normalizeDashboardGovernance,
    ),
  };
  assertDashboardPrivacy(normalized);
  return stableDashboardValue(normalized);
}

export function withinDashboardWindow(at, window) {
  if (!at) {
    return false;
  }
  const time = Date.parse(at);
  return time >= Date.parse(window.windowStart) && time < Date.parse(window.windowEnd);
}

export function latestDashboardSourceTime(records, field = 'at') {
  const times = records
    .map((record) =>
      Date.parse(
        record[field] ??
          record.occurredAt ??
          record.at ??
          record.effectiveAt ??
          record.verifiedAt ??
          record.resolvedAt,
      ),
    )
    .filter(Number.isFinite);
  return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
}
