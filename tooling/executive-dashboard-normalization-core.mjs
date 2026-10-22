import { createHash } from 'node:crypto';

import {
  DASHBOARD_PERIODS,
  EVIDENCE_STATUSES,
  MAX_DASHBOARD_REFS,
  MAX_DASHBOARD_TEXT,
} from './executive-dashboard-schema.mjs';

const FORBIDDEN_KEYS = new Set([
  'prompt',
  'rawPrompt',
  'rawOutput',
  'generatedCode',
  'secret',
  'token',
  'credential',
  'privateContent',
]);

export function assertDashboardPrivacy(value, path = 'dashboard') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDashboardPrivacy(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new TypeError(`${path}.${key} is prohibited.`);
    }
    assertDashboardPrivacy(child, `${path}.${key}`);
  }
}

export function cleanDashboardText(value, field, limit = MAX_DASHBOARD_TEXT) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value).trim();
  if (text.length > limit) {
    throw new TypeError(`${field} exceeds ${limit} characters.`);
  }
  return text;
}

export function cleanDashboardRefs(value, field) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/[|,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
  const unique = [
    ...new Set(values.map((entry) => cleanDashboardText(entry, field, 1_000)).filter(Boolean)),
  ];
  if (unique.length > MAX_DASHBOARD_REFS) {
    throw new TypeError(`${field} exceeds ${MAX_DASHBOARD_REFS} references.`);
  }
  return unique.sort();
}

export function dashboardDate(value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new TypeError(`${field} is required.`);
    }
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${field} must be an ISO date.`);
  }
  return date.toISOString();
}

export function dashboardInteger(value, field, options = {}) {
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      throw new TypeError(`${field} is required.`);
    }
    return null;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new TypeError(`${field} must be a safe integer.`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new TypeError(`${field} must be at least ${options.min}.`);
  }
  return number;
}

export function stableDashboardValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableDashboardValue);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableDashboardValue(child)]),
  );
}

export function stableDashboardStringify(value, space = 0) {
  return JSON.stringify(stableDashboardValue(value), null, space);
}

export function dashboardDigest(value) {
  return createHash('sha256').update(stableDashboardStringify(value)).digest('hex');
}

export function requireDashboardObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }
}

export function dashboardRecordId(value, field) {
  const id = cleanDashboardText(value, `${field}.id`, 500);
  if (!id) {
    throw new TypeError(`${field}.id is required.`);
  }
  return id;
}

export function dashboardCategory(value, field) {
  const result = cleanDashboardText(value, `${field}.category`, 300);
  if (!result) {
    throw new TypeError(`${field}.category is required.`);
  }
  return result;
}

export function dashboardEvidenceStatus(value, field) {
  const status = cleanDashboardText(value, `${field}.status`, 50).toLowerCase();
  if (!EVIDENCE_STATUSES.includes(status)) {
    throw new TypeError(`${field}.status must be verified or estimated.`);
  }
  return status;
}

export function requiredDashboardRefs(value, field) {
  const refs = cleanDashboardRefs(value, field);
  if (refs.length === 0) {
    throw new TypeError(`${field} requires at least one durable source reference.`);
  }
  return refs;
}

export function normalizeDashboardWindow(input = {}) {
  const snapshotAt = dashboardDate(input.snapshotAt, 'snapshotAt', true);
  const windowEnd = dashboardDate(input.windowEnd ?? snapshotAt, 'windowEnd', true);
  const windowStart = dashboardDate(input.windowStart, 'windowStart', true);
  if (Date.parse(windowStart) >= Date.parse(windowEnd)) {
    throw new TypeError('windowStart must be earlier than windowEnd.');
  }
  const period = cleanDashboardText(input.period ?? 'week', 'period', 20).toLowerCase();
  if (!DASHBOARD_PERIODS.includes(period)) {
    throw new TypeError(`Unsupported period: ${period}.`);
  }
  const observationDays = dashboardInteger(
    input.minimumObservationDays ?? 14,
    'minimumObservationDays',
    { min: 0, required: true },
  );
  return { snapshotAt, windowStart, windowEnd, period, minimumObservationDays: observationDays };
}
