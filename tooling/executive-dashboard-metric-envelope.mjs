import {
  latestDashboardSourceTime,
  stableDashboardValue,
} from './executive-dashboard-normalization.mjs';

export function dashboardPercentage(numerator, denominator) {
  if (denominator === 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function dashboardMean(values) {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function dashboardMedian(values) {
  if (values.length === 0) {
    return null;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? Math.round(((ordered[middle - 1] + ordered[middle]) / 2) * 100) / 100
    : ordered[middle];
}

export function dashboardSourceRefs(records) {
  return [...new Set(records.flatMap((record) => record.sourceRefs ?? []))].sort().slice(0, 100);
}

export function dashboardCoverage(observed, eligible) {
  return {
    observed,
    eligible,
    percentage: dashboardPercentage(observed, eligible),
  };
}

export function metricEnvelope({
  key,
  label,
  formula,
  value,
  numerator = null,
  denominator = null,
  observed = 0,
  eligible = 0,
  records = [],
  details = null,
  status,
}) {
  const resolvedStatus =
    status ?? (eligible === 0 || value === null ? 'insufficient-evidence' : 'scored');
  return stableDashboardValue({
    key,
    label,
    formula,
    status: resolvedStatus,
    value,
    numerator,
    denominator,
    coverage: dashboardCoverage(observed, eligible),
    freshness: latestDashboardSourceTime(records),
    sourceRefs: dashboardSourceRefs(records),
    details,
  });
}
