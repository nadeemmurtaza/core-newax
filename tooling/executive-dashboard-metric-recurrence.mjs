import { withinDashboardWindow } from './executive-dashboard-normalization.mjs';
import {
  confirmedDashboardOccurrences,
  distinctDashboardOccurrences,
  metricEnvelope,
} from './executive-dashboard-metric-core.mjs';

export function topRecurringRootCauses(input) {
  const allConfirmed = confirmedDashboardOccurrences(input);
  const occurrences = distinctDashboardOccurrences(allConfirmed).filter(
    (entry) => entry.rootCauseId,
  );
  const byRoot = new Map();
  for (const occurrence of occurrences) {
    const row = byRoot.get(occurrence.rootCauseId) ?? {
      rootCauseId: occurrence.rootCauseId,
      category: occurrence.category,
      occurrences: 0,
      prNumbers: new Set(),
      latestAt: occurrence.occurredAt,
      postRuleOccurrences: 0,
      escalation: 'none',
    };
    row.occurrences += 1;
    if (occurrence.prNumber !== null) {
      row.prNumbers.add(occurrence.prNumber);
    }
    if (Date.parse(occurrence.occurredAt) > Date.parse(row.latestAt)) {
      row.latestAt = occurrence.occurredAt;
    }
    byRoot.set(occurrence.rootCauseId, row);
  }
  for (const decision of input.recurrenceDecisions.filter((entry) =>
    withinDashboardWindow(entry.occurredAt, input),
  )) {
    const row = byRoot.get(decision.rootCauseId);
    if (!row) {
      continue;
    }
    if (decision.ruleId !== null && decision.state !== 'clear') {
      row.postRuleOccurrences += 1;
    }
    const rank = { none: 0, observe: 1, warning: 2, high: 3, critical: 4 };
    if ((rank[decision.escalation] ?? 0) > (rank[row.escalation] ?? 0)) {
      row.escalation = decision.escalation;
    }
    for (const pr of decision.previousPrNumbers) {
      row.prNumbers.add(pr);
    }
  }
  const values = [...byRoot.values()]
    .filter((row) => row.occurrences > 1)
    .map((row) => ({ ...row, prNumbers: [...row.prNumbers].sort((a, b) => a - b) }))
    .sort(
      (left, right) =>
        right.occurrences - left.occurrences ||
        right.postRuleOccurrences - left.postRuleOccurrences ||
        left.rootCauseId.localeCompare(right.rootCauseId),
    );
  return metricEnvelope({
    key: 'topRecurringRootCauses',
    label: 'Top recurring root causes',
    formula: 'Distinct confirmed occurrences grouped by exact root-cause ID.',
    value: values,
    numerator: values.length,
    denominator: new Set(occurrences.map((entry) => entry.rootCauseId)).size,
    observed: occurrences.length,
    eligible: allConfirmed.length,
    records: [...allConfirmed, ...input.recurrenceDecisions],
    status: allConfirmed.length === 0 ? 'insufficient-evidence' : 'scored',
  });
}
