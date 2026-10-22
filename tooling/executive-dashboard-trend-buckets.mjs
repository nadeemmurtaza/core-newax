export function trendPercentage(numerator, denominator) {
  if (denominator === 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function trendAverage(values) {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function mondayUtc(date) {
  const value = new Date(date);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() + (day === 0 ? -6 : 1 - day));
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export function dashboardBucketStart(at, period) {
  const date = new Date(at);
  return period === 'month'
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString()
    : mondayUtc(date).toISOString();
}

function addBucket(start, period) {
  const date = new Date(start);
  if (period === 'month') {
    date.setUTCMonth(date.getUTCMonth() + 1);
  } else {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date.toISOString();
}

export function dashboardBuckets(input) {
  const buckets = [];
  let cursor = dashboardBucketStart(input.windowStart, input.period);
  while (Date.parse(cursor) < Date.parse(input.windowEnd)) {
    const end = addBucket(cursor, input.period);
    buckets.push({ start: cursor, end });
    cursor = end;
  }
  return buckets;
}

export function inDashboardBucket(at, bucket) {
  if (!at) {
    return false;
  }
  const time = Date.parse(at);
  return time >= Date.parse(bucket.start) && time < Date.parse(bucket.end);
}

export function humanReviewPeriod(records) {
  const reviewed = records.filter((record) => record.reviewed);
  const outcomes = reviewed.filter(
    (record) => record.validFindings !== null && record.resolvedBeforeMerge !== null,
  );
  const valid = outcomes.reduce((sum, record) => sum + record.validFindings, 0);
  const resolved = outcomes.reduce((sum, record) => sum + record.resolvedBeforeMerge, 0);
  return {
    effectiveness: trendPercentage(resolved, valid),
    coverage: trendPercentage(reviewed.length, records.length),
    escapedFindings: reviewed.reduce((sum, record) => sum + (record.escapedFindings ?? 0), 0),
    reviewed: reviewed.length,
    eligible: records.length,
  };
}
