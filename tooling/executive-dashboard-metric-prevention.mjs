import {
  IGNORED_RULE_DISPOSITIONS,
  VERIFIED_ROOT_CAUSE_STATUSES,
} from './executive-dashboard-schema.mjs';
import { withinDashboardWindow } from './executive-dashboard-normalization.mjs';
import {
  dashboardPercentage,
  distinctDashboardOccurrences,
  metricEnvelope,
} from './executive-dashboard-metric-core.mjs';

export function preventionEffectiveness(input) {
  const end = Date.parse(input.windowEnd);
  const minimumAge = input.minimumObservationDays * 24 * 60 * 60 * 1_000;
  const eligibleRules = input.rules.filter((rule) => {
    if (!['generated', 'enforced'].includes(rule.state) || rule.effectiveAt === null) {
      return false;
    }
    const effective = Date.parse(rule.effectiveAt);
    const activeAtEnd = rule.retiredAt === null || Date.parse(rule.retiredAt) >= end;
    return effective <= end - minimumAge && activeAtEnd;
  });
  const rows = eligibleRules.map((rule) => {
    const postRule = distinctDashboardOccurrences(
      input.occurrences.filter(
        (occurrence) =>
          VERIFIED_ROOT_CAUSE_STATUSES.includes(occurrence.status) &&
          occurrence.rootCauseId === rule.rootCauseId &&
          Date.parse(occurrence.occurredAt) >=
            Math.max(Date.parse(rule.effectiveAt), Date.parse(input.windowStart)) &&
          Date.parse(occurrence.occurredAt) < end,
      ),
    );
    return {
      ruleId: rule.id,
      rootCauseId: rule.rootCauseId,
      state: rule.state,
      effectiveAt: rule.effectiveAt,
      postRuleOccurrences: postRule.length,
      recurrenceFree: postRule.length === 0,
    };
  });
  const recurrenceFree = rows.filter((row) => row.recurrenceFree).length;
  return metricEnvelope({
    key: 'preventionEffectiveness',
    label: 'Prevention effectiveness',
    formula:
      'Eligible effective rules with zero post-rule recurrence divided by eligible rules after the minimum observation window.',
    value: dashboardPercentage(recurrenceFree, rows.length),
    numerator: recurrenceFree,
    denominator: rows.length,
    observed: rows.length,
    eligible: input.rules.filter((rule) => ['generated', 'enforced'].includes(rule.state)).length,
    records: eligibleRules,
    details: { minimumObservationDays: input.minimumObservationDays, rules: rows },
  });
}

export function rulesFrequentlyIgnored(input) {
  const records = input.recurrenceDecisions.filter(
    (decision) =>
      withinDashboardWindow(decision.occurredAt, input) &&
      decision.ruleId !== null &&
      decision.disposition !== null,
  );
  const ignored = records.filter((decision) =>
    IGNORED_RULE_DISPOSITIONS.includes(decision.disposition),
  );
  const byRule = new Map();
  for (const decision of ignored) {
    const row = byRule.get(decision.ruleId) ?? {
      ruleId: decision.ruleId,
      rootCauseId: decision.rootCauseId,
      ignoredCount: 0,
      dispositions: {},
      prNumbers: new Set(),
      latestEscalation: 'none',
    };
    row.ignoredCount += 1;
    row.dispositions[decision.disposition] = (row.dispositions[decision.disposition] ?? 0) + 1;
    if (decision.prNumber !== null) {
      row.prNumbers.add(decision.prNumber);
    }
    row.latestEscalation = decision.escalation;
    byRule.set(decision.ruleId, row);
  }
  const values = [...byRule.values()]
    .map((row) => ({ ...row, prNumbers: [...row.prNumbers].sort((a, b) => a - b) }))
    .sort(
      (left, right) =>
        right.ignoredCount - left.ignoredCount || left.ruleId.localeCompare(right.ruleId),
    );
  return metricEnvelope({
    key: 'rulesFrequentlyIgnored',
    label: 'Rules frequently ignored',
    formula:
      'Post-rule occurrences with not-executed, bypassed-without-approval, or failure-ignored disposition, grouped by exact rule ID.',
    value: records.length === 0 ? null : values,
    numerator: ignored.length,
    denominator: records.length,
    observed: records.length,
    eligible: records.length,
    records,
    details: {
      excludedControlFailures: records.filter((entry) => entry.disposition === 'control-failed')
        .length,
    },
  });
}
