import {
  cleanDashboardRefs,
  cleanDashboardText,
  dashboardCategory,
  dashboardDate,
  dashboardInteger,
  dashboardRecordId,
  requireDashboardObject,
} from './executive-dashboard-normalization-core.mjs';

export function normalizeDashboardOccurrence(value, index = 0) {
  requireDashboardObject(value, `occurrences[${index}]`);
  const field = `occurrences[${index}]`;
  const occurredAt = dashboardDate(value.occurredAt ?? value.at, `${field}.occurredAt`, true);
  const detectedAt = dashboardDate(value.detectedAt, `${field}.detectedAt`);
  const resolvedAt = dashboardDate(value.resolvedAt, `${field}.resolvedAt`);
  const verifiedAt = dashboardDate(value.verifiedAt, `${field}.verifiedAt`);
  if (detectedAt && Date.parse(detectedAt) < Date.parse(occurredAt)) {
    throw new TypeError(`${field}.detectedAt cannot precede occurredAt.`);
  }
  if (resolvedAt && detectedAt && Date.parse(resolvedAt) < Date.parse(detectedAt)) {
    throw new TypeError(`${field}.resolvedAt cannot precede detectedAt.`);
  }
  if (verifiedAt && resolvedAt && Date.parse(verifiedAt) < Date.parse(resolvedAt)) {
    throw new TypeError(`${field}.verifiedAt cannot precede resolvedAt.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    rootCauseId: cleanDashboardText(value.rootCauseId, `${field}.rootCauseId`, 300),
    category: dashboardCategory(value.category ?? 'uncategorized', field),
    status: cleanDashboardText(value.status ?? 'candidate', `${field}.status`, 100).toLowerCase(),
    occurredAt,
    detectedAt,
    resolvedAt,
    verifiedAt,
    prNumber: dashboardInteger(value.prNumber, `${field}.prNumber`, { min: 1 }),
    issueNumber: dashboardInteger(value.issueNumber, `${field}.issueNumber`, { min: 1 }),
    sourceId: cleanDashboardText(value.sourceId, `${field}.sourceId`, 500) || null,
    fingerprint: cleanDashboardText(value.fingerprint, `${field}.fingerprint`, 500) || null,
    commitSha: cleanDashboardText(value.commitSha, `${field}.commitSha`, 100) || null,
    sourceRefs: cleanDashboardRefs(value.sourceRefs ?? value.evidenceRefs, `${field}.sourceRefs`),
  };
}
