import {
  confirmedDashboardOccurrences,
  dashboardMean,
  dashboardMedian,
  dashboardPercentage,
  metricEnvelope,
} from './executive-dashboard-metric-core.mjs';
import { withinDashboardWindow } from './executive-dashboard-normalization.mjs';

function durationMetric(input, config) {
  const occurrences = confirmedDashboardOccurrences(input);
  const eligible = [];
  for (const occurrence of occurrences) {
    const start = occurrence[config.start];
    const end = occurrence[config.end];
    if (!start || !end) {
      continue;
    }
    eligible.push({
      ...occurrence,
      durationMinutes: (Date.parse(end) - Date.parse(start)) / 60_000,
    });
  }
  const values = eligible.map((entry) => entry.durationMinutes);
  return metricEnvelope({
    key: config.key,
    label: config.label,
    formula: config.formula,
    value: dashboardMean(values),
    numerator:
      values.length === 0
        ? null
        : Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100,
    denominator: values.length,
    observed: values.length,
    eligible: occurrences.length,
    records: eligible,
    details: { unit: 'minutes', medianMinutes: dashboardMedian(values) },
  });
}

export function meanTimeToDetect(input) {
  return durationMetric(input, {
    key: 'meanTimeToDetect',
    label: 'Mean time to detect',
    formula: 'Mean detectedAt minus occurredAt for confirmed occurrences with both timestamps.',
    start: 'occurredAt',
    end: 'detectedAt',
  });
}

export function meanTimeToResolve(input) {
  return durationMetric(input, {
    key: 'meanTimeToResolve',
    label: 'Mean time to resolve',
    formula: 'Mean resolvedAt minus detectedAt for confirmed occurrences with both timestamps.',
    start: 'detectedAt',
    end: 'resolvedAt',
  });
}

export function meanTimeToVerify(input) {
  return durationMetric(input, {
    key: 'meanTimeToVerify',
    label: 'Mean time to verify',
    formula: 'Mean verifiedAt minus resolvedAt for confirmed occurrences with both timestamps.',
    start: 'resolvedAt',
    end: 'verifiedAt',
  });
}

export function humanReviewEffectiveness(input) {
  const records = input.reviewRecords.filter((record) => withinDashboardWindow(record.at, input));
  const reviewed = records.filter((record) => record.reviewed);
  const outcomeRecords = reviewed.filter(
    (record) => record.validFindings !== null && record.resolvedBeforeMerge !== null,
  );
  const valid = outcomeRecords.reduce((sum, record) => sum + record.validFindings, 0);
  const resolved = outcomeRecords.reduce((sum, record) => sum + record.resolvedBeforeMerge, 0);
  const escaped = reviewed.reduce((sum, record) => sum + (record.escapedFindings ?? 0), 0);
  return metricEnvelope({
    key: 'humanReviewEffectiveness',
    label: 'Human review effectiveness',
    formula: 'Valid review findings resolved before merge divided by valid review findings.',
    value: dashboardPercentage(resolved, valid),
    numerator: resolved,
    denominator: valid,
    observed: outcomeRecords.length,
    eligible: records.length,
    records,
    details: {
      reviewCoverage: dashboardPercentage(reviewed.length, records.length),
      reviewedPullRequests: reviewed.length,
      eligiblePullRequests: records.length,
      escapedFindings: escaped,
    },
  });
}
