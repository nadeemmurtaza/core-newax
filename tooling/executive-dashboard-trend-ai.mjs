import { metricEnvelope } from './executive-dashboard-metrics.mjs';
import {
  stableDashboardValue,
  withinDashboardWindow,
} from './executive-dashboard-normalization.mjs';
import {
  dashboardBuckets,
  inDashboardBucket,
  trendPercentage,
} from './executive-dashboard-trend-buckets.mjs';

export function aiAccuracyTrend(input) {
  const records = input.aiRecords.filter((record) => withinDashboardWindow(record.at, input));
  const validated = records.filter(
    (record) => record.outcome !== 'unverified' && record.reviewer !== null,
  );
  const series = dashboardBuckets(input).map((bucket) => {
    const all = records.filter((record) => inDashboardBucket(record.at, bucket));
    const eligible = validated.filter((record) => inDashboardBucket(record.at, bucket));
    const correct = eligible.filter((record) => record.outcome === 'correct').length;
    const partial = eligible.filter((record) => record.outcome === 'partial').length;
    const incorrect = eligible.filter((record) => record.outcome === 'incorrect').length;
    return stableDashboardValue({
      periodStart: bucket.start,
      periodEnd: bucket.end,
      accuracy: trendPercentage(correct, eligible.length),
      partialRate: trendPercentage(partial, eligible.length),
      incorrectRate: trendPercentage(incorrect, eligible.length),
      validationCoverage: trendPercentage(eligible.length, all.length),
      counts: { all: all.length, validated: eligible.length, correct, partial, incorrect },
    });
  });
  const correct = validated.filter((record) => record.outcome === 'correct').length;
  return metricEnvelope({
    key: 'aiAccuracyTrend',
    label: 'AI accuracy trend',
    formula: 'Reviewer-validated correct AI outputs divided by all reviewer-validated AI outputs.',
    value: series,
    numerator: correct,
    denominator: validated.length,
    observed: validated.length,
    eligible: records.length,
    records,
    status: validated.length === 0 ? 'insufficient-evidence' : 'scored',
    details: {
      currentAccuracy: trendPercentage(correct, validated.length),
      partial: validated.filter((record) => record.outcome === 'partial').length,
      incorrect: validated.filter((record) => record.outcome === 'incorrect').length,
    },
  });
}
