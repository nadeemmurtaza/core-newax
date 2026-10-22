import { dashboardMinutes, escapeDashboardHtml } from './executive-dashboard-render-format.mjs';

export function executiveDashboardRows(snapshot) {
  const m = snapshot.metrics;
  return {
    rootRows: (m.topRecurringRootCauses.value ?? []).map((row) => [
      row.rootCauseId,
      row.category,
      String(row.occurrences),
      String(row.postRuleOccurrences),
      row.prNumbers.map((pr) => `#${pr}`).join(', '),
      row.escalation,
    ]),
    costRows: (m.mostExpensiveCategories.value ?? []).map((row) => [
      row.category,
      row.currency,
      String(row.verifiedMinor),
      String(row.estimatedMinor),
      String(row.totalMinor),
    ]),
    timeRows: (m.timeLostByCategory.value ?? []).map((row) => [
      row.category,
      dashboardMinutes(row.verifiedMinutes),
      dashboardMinutes(row.estimatedMinutes),
      dashboardMinutes(row.totalMinutes),
    ]),
    ignoredRows: (m.rulesFrequentlyIgnored.value ?? []).map((row) => [
      row.ruleId,
      row.rootCauseId,
      String(row.ignoredCount),
      Object.entries(row.dispositions)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', '),
      row.prNumbers.map((pr) => `#${pr}`).join(', '),
    ]),
    preventionRows: (m.preventionEffectiveness.details?.rules ?? []).map((row) => [
      row.ruleId,
      row.rootCauseId,
      row.state,
      String(row.postRuleOccurrences),
      row.recurrenceFree ? 'Yes' : 'No',
    ]),
    definitions: Object.entries(snapshot.definitions)
      .map(
        ([key, definition]) =>
          `<li><strong>${escapeDashboardHtml(definition.label)}</strong><span>${escapeDashboardHtml(definition.formula)}</span><code>${escapeDashboardHtml(key)}</code></li>`,
      )
      .join(''),
  };
}
