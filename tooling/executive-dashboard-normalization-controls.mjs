import { RULE_STATES } from './executive-dashboard-schema.mjs';
import {
  cleanDashboardText,
  dashboardCategory,
  dashboardDate,
  dashboardEvidenceStatus,
  dashboardInteger,
  dashboardRecordId,
  requireDashboardObject,
  requiredDashboardRefs,
} from './executive-dashboard-normalization-core.mjs';

export function normalizeDashboardCost(value, index = 0) {
  requireDashboardObject(value, `costRecords[${index}]`);
  const field = `costRecords[${index}]`;
  const currency = cleanDashboardText(value.currency, `${field}.currency`, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError(`${field}.currency must be ISO-style.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    occurrenceId: cleanDashboardText(value.occurrenceId, `${field}.occurrenceId`, 500) || null,
    category: dashboardCategory(value.category, field),
    amountMinor: dashboardInteger(value.amountMinor, `${field}.amountMinor`, {
      min: 0,
      required: true,
    }),
    currency,
    status: dashboardEvidenceStatus(value.status, field),
    at: dashboardDate(value.at ?? value.occurredAt, `${field}.at`, true),
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}

export function normalizeDashboardTimeLoss(value, index = 0) {
  requireDashboardObject(value, `timeLossRecords[${index}]`);
  const field = `timeLossRecords[${index}]`;
  return {
    id: dashboardRecordId(value.id, field),
    occurrenceId: cleanDashboardText(value.occurrenceId, `${field}.occurrenceId`, 500) || null,
    category: dashboardCategory(value.category, field),
    minutes: dashboardInteger(value.minutes, `${field}.minutes`, { min: 0, required: true }),
    status: dashboardEvidenceStatus(value.status, field),
    at: dashboardDate(value.at ?? value.occurredAt, `${field}.at`, true),
    sourceRefs: requiredDashboardRefs(value.sourceRefs, `${field}.sourceRefs`),
  };
}

export function normalizeDashboardRule(value, index = 0) {
  requireDashboardObject(value, `rules[${index}]`);
  const field = `rules[${index}]`;
  const state = cleanDashboardText(value.state ?? 'candidate', `${field}.state`, 50).toLowerCase();
  if (!RULE_STATES.includes(state)) {
    throw new TypeError(`${field}.state is unsupported.`);
  }
  if (!cleanDashboardText(value.rootCauseId, `${field}.rootCauseId`, 300)) {
    throw new TypeError(`${field}.rootCauseId is required.`);
  }
  return {
    id: dashboardRecordId(value.id, field),
    rootCauseId: cleanDashboardText(value.rootCauseId, `${field}.rootCauseId`, 300),
    state,
    effectiveAt: dashboardDate(value.effectiveAt, `${field}.effectiveAt`, state !== 'candidate'),
    retiredAt: dashboardDate(value.retiredAt, `${field}.retiredAt`),
    title: cleanDashboardText(value.title, `${field}.title`, 1_000) || null,
    sourceRefs: requiredDashboardRefs(
      value.sourceRefs ?? value.evidenceRefs,
      `${field}.sourceRefs`,
    ),
  };
}

export function normalizeDashboardRecurrence(value, index = 0) {
  requireDashboardObject(value, `recurrenceDecisions[${index}]`);
  const field = `recurrenceDecisions[${index}]`;
  const rootCauseId = cleanDashboardText(value.rootCauseId, `${field}.rootCauseId`, 300);
  const occurrenceId = cleanDashboardText(
    value.occurrenceId ?? value.currentOccurrence?.id,
    `${field}.occurrenceId`,
    500,
  );
  if (!rootCauseId || !occurrenceId) {
    throw new TypeError(`${field} requires rootCauseId and occurrenceId.`);
  }
  return {
    id: dashboardRecordId(value.id ?? value.digest, field),
    rootCauseId,
    occurrenceId,
    occurredAt: dashboardDate(
      value.occurredAt ?? value.currentOccurrence?.occurredAt,
      `${field}.occurredAt`,
      true,
    ),
    prNumber: dashboardInteger(
      value.prNumber ?? value.currentOccurrence?.prNumber,
      `${field}.prNumber`,
      { min: 1 },
    ),
    ruleId: cleanDashboardText(value.ruleId ?? value.rule?.id, `${field}.ruleId`, 500) || null,
    disposition:
      cleanDashboardText(
        value.disposition ?? value.explanation?.disposition,
        `${field}.disposition`,
        100,
      ).toLowerCase() || null,
    state: cleanDashboardText(value.state ?? 'clear', `${field}.state`, 100).toLowerCase(),
    escalation: cleanDashboardText(
      value.escalation ?? 'none',
      `${field}.escalation`,
      100,
    ).toLowerCase(),
    previousPrNumbers: [
      ...new Set(
        (value.previousPrNumbers ?? []).map((entry) => Number(entry)).filter(Number.isSafeInteger),
      ),
    ].sort((a, b) => a - b),
    sourceRefs: requiredDashboardRefs(value.sourceRefs ?? [], `${field}.sourceRefs`),
  };
}
