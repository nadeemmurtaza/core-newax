import { AI_OUTCOMES, GOVERNANCE_CONCLUSIONS } from './executive-dashboard-schema.mjs';
import {
  cleanDashboardText,
  dashboardDate,
  dashboardInteger,
  dashboardRecordId,
  requireDashboardObject,
  requiredDashboardRefs,
} from './executive-dashboard-normalization-core.mjs';

export function normalizeDashboardAi(value, index = 0) {
  requireDashboardObject(value, `aiRecords[${index}]`);
  const field = `aiRecords[${index}]`;
  const outcome = cleanDashboardText(
    value.outcome ?? 'unverified',
    `${field}.outcome`,
    50,
  ).toLowerCase();
  if (!AI_OUTCOMES.includes(outcome)) {
    throw new TypeError(`${field}.outcome is unsupported.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    at: dashboardDate(value.at ?? value.occurredAt, `${field}.at`, true),
    outcome,
    reviewer: cleanDashboardText(value.reviewer, `${field}.reviewer`, 300) || null,
    provider: cleanDashboardText(value.provider, `${field}.provider`, 200) || null,
    model: cleanDashboardText(value.model, `${field}.model`, 200) || null,
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}

export function normalizeDashboardReview(value, index = 0) {
  requireDashboardObject(value, `reviewRecords[${index}]`);
  const field = `reviewRecords[${index}]`;
  const validFindings = dashboardInteger(value.validFindings, `${field}.validFindings`, { min: 0 });
  const resolvedBeforeMerge = dashboardInteger(
    value.resolvedBeforeMerge,
    `${field}.resolvedBeforeMerge`,
    { min: 0 },
  );
  if (
    validFindings !== null &&
    resolvedBeforeMerge !== null &&
    resolvedBeforeMerge > validFindings
  ) {
    throw new TypeError(`${field}.resolvedBeforeMerge cannot exceed validFindings.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    prNumber: dashboardInteger(value.prNumber, `${field}.prNumber`, { min: 1, required: true }),
    at: dashboardDate(value.at ?? value.reviewedAt, `${field}.at`, true),
    reviewed: Boolean(value.reviewed),
    validFindings,
    resolvedBeforeMerge,
    escapedFindings: dashboardInteger(value.escapedFindings, `${field}.escapedFindings`, {
      min: 0,
    }),
    reviewer: cleanDashboardText(value.reviewer, `${field}.reviewer`, 300) || null,
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}

export function normalizeDashboardConfidence(value, index = 0) {
  requireDashboardObject(value, `confidenceRecords[${index}]`);
  const field = `confidenceRecords[${index}]`;
  const score = Number(value.evidenceQualityScore ?? value.evidenceQuality?.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new TypeError(`${field}.evidenceQualityScore must be between 0 and 100.`);
  }
  return {
    id: dashboardRecordId(value.id ?? value.findingId, field),
    at: dashboardDate(value.at ?? value.scoredAt, `${field}.at`, true),
    evidenceQualityScore: Math.round(score * 100) / 100,
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}

export function normalizeDashboardGovernance(value, index = 0) {
  requireDashboardObject(value, `governanceRecords[${index}]`);
  const field = `governanceRecords[${index}]`;
  const conclusion = cleanDashboardText(value.conclusion, `${field}.conclusion`, 50).toLowerCase();
  if (!GOVERNANCE_CONCLUSIONS.includes(conclusion)) {
    throw new TypeError(`${field}.conclusion is unsupported.`);
  }
  const executed = Boolean(value.executed);
  if ((!executed && conclusion !== 'blocked') || (executed && conclusion === 'blocked')) {
    throw new TypeError(`${field}.executed and conclusion are inconsistent.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    at: dashboardDate(value.at ?? value.completedAt, `${field}.at`, true),
    executed,
    conclusion,
    prNumber: dashboardInteger(value.prNumber, `${field}.prNumber`, { min: 1 }),
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}
