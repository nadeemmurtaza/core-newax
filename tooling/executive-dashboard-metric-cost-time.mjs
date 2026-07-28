import {
  confirmedDashboardOccurrences,
  metricEnvelope,
} from './executive-dashboard-metric-core.mjs';
import { withinDashboardWindow } from './executive-dashboard-normalization.mjs';

function categoryEvidenceCoverage(records, occurrences) {
  const linked = new Set(records.map((record) => record.occurrenceId).filter(Boolean));
  const occurrenceIds = new Set(occurrences.map((occurrence) => occurrence.id));
  const observed = [...linked].filter((id) => occurrenceIds.has(id)).length;
  return { observed, eligible: occurrenceIds.size };
}

export function mostExpensiveCategories(input) {
  const occurrences = confirmedDashboardOccurrences(input);
  const records = input.costRecords.filter((record) => withinDashboardWindow(record.at, input));
  const groups = new Map();
  for (const record of records) {
    const key = `${record.category}|${record.currency}`;
    const group = groups.get(key) ?? {
      category: record.category,
      currency: record.currency,
      verifiedMinor: 0,
      estimatedMinor: 0,
      recordCount: 0,
    };
    group[record.status === 'verified' ? 'verifiedMinor' : 'estimatedMinor'] += record.amountMinor;
    group.recordCount += 1;
    groups.set(key, group);
  }
  const values = [...groups.values()]
    .map((group) => ({ ...group, totalMinor: group.verifiedMinor + group.estimatedMinor }))
    .sort(
      (left, right) =>
        right.totalMinor - left.totalMinor || left.category.localeCompare(right.category),
    );
  const c = categoryEvidenceCoverage(records, occurrences);
  return metricEnvelope({
    key: 'mostExpensiveCategories',
    label: 'Most expensive categories',
    formula:
      'Source-backed cost totals grouped by category and currency; currencies are never combined.',
    value: records.length === 0 ? null : values,
    observed: c.observed,
    eligible: c.eligible,
    records,
    details: { currencies: [...new Set(records.map((record) => record.currency))].sort() },
    status: records.length === 0 ? 'insufficient-evidence' : 'scored',
  });
}

export function timeLostByCategory(input) {
  const occurrences = confirmedDashboardOccurrences(input);
  const records = input.timeLossRecords.filter((record) => withinDashboardWindow(record.at, input));
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.category) ?? {
      category: record.category,
      verifiedMinutes: 0,
      estimatedMinutes: 0,
      recordCount: 0,
    };
    group[record.status === 'verified' ? 'verifiedMinutes' : 'estimatedMinutes'] += record.minutes;
    group.recordCount += 1;
    groups.set(record.category, group);
  }
  const values = [...groups.values()]
    .map((group) => ({ ...group, totalMinutes: group.verifiedMinutes + group.estimatedMinutes }))
    .sort(
      (left, right) =>
        right.totalMinutes - left.totalMinutes || left.category.localeCompare(right.category),
    );
  const c = categoryEvidenceCoverage(records, occurrences);
  return metricEnvelope({
    key: 'timeLostByCategory',
    label: 'Time lost by category',
    formula: 'Explicit verified and estimated lost minutes grouped by category.',
    value: records.length === 0 ? null : values,
    observed: c.observed,
    eligible: c.eligible,
    records,
    status: records.length === 0 ? 'insufficient-evidence' : 'scored',
  });
}
