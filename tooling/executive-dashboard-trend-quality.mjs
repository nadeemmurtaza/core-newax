import { VERIFIED_ROOT_CAUSE_STATUSES } from './executive-dashboard-schema.mjs';
import {
  stableDashboardValue,
  withinDashboardWindow,
} from './executive-dashboard-normalization.mjs';
import { metricEnvelope } from './executive-dashboard-metrics.mjs';
import {
  dashboardBuckets,
  humanReviewPeriod,
  inDashboardBucket,
  trendAverage,
  trendPercentage,
} from './executive-dashboard-trend-buckets.mjs';

export function engineeringQualityTrend(input) {
  const occurrences = input.occurrences.filter(
    (entry) =>
      VERIFIED_ROOT_CAUSE_STATUSES.includes(entry.status) &&
      withinDashboardWindow(entry.occurredAt, input),
  );
  const recurrenceIds = new Set(
    input.recurrenceDecisions
      .filter((entry) => entry.state !== 'clear' && entry.state !== 'observe')
      .map((entry) => entry.occurrenceId),
  );
  const series = dashboardBuckets(input).map((bucket) => {
    const bucketOccurrences = occurrences.filter((entry) =>
      inDashboardBucket(entry.occurredAt, bucket),
    );
    const verified = bucketOccurrences.filter((entry) => entry.verifiedAt !== null).length;
    const recurrent = bucketOccurrences.filter((entry) => recurrenceIds.has(entry.id)).length;
    const confidence = input.confidenceRecords.filter((entry) =>
      inDashboardBucket(entry.at, bucket),
    );
    const governance = input.governanceRecords.filter(
      (entry) => entry.executed && inDashboardBucket(entry.at, bucket),
    );
    const reviews = input.reviewRecords.filter((entry) => inDashboardBucket(entry.at, bucket));
    const review = humanReviewPeriod(reviews);
    const passes = governance.filter((entry) => entry.conclusion === 'pass').length;
    const executed = governance.filter((entry) =>
      ['pass', 'fail'].includes(entry.conclusion),
    ).length;
    return stableDashboardValue({
      periodStart: bucket.start,
      periodEnd: bucket.end,
      verifiedResolutionRate: trendPercentage(verified, bucketOccurrences.length),
      recurrenceFreeRate: trendPercentage(
        bucketOccurrences.length - recurrent,
        bucketOccurrences.length,
      ),
      evidenceQualityAverage: trendAverage(confidence.map((entry) => entry.evidenceQualityScore)),
      executedGovernancePassRate: trendPercentage(passes, executed),
      humanReviewEffectiveness: review.effectiveness,
      reviewCoverage: review.coverage,
      counts: {
        occurrences: bucketOccurrences.length,
        verified,
        recurrent,
        confidenceRecords: confidence.length,
        executedGovernance: executed,
        reviewRecords: reviews.length,
      },
    });
  });
  const relevant = [
    ...occurrences,
    ...input.recurrenceDecisions,
    ...input.confidenceRecords,
    ...input.governanceRecords,
    ...input.reviewRecords,
  ];
  return metricEnvelope({
    key: 'engineeringQualityTrend',
    label: 'Engineering quality trend',
    formula:
      'Period series of verified resolution, recurrence-free outcomes, evidence quality, executed governance pass rate, and human review effectiveness.',
    value: series,
    observed: relevant.length,
    eligible: relevant.length,
    records: relevant,
    status: relevant.length === 0 ? 'insufficient-evidence' : 'scored',
  });
}
