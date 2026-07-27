export function executiveDashboardSourceCoverage(input) {
  const families = {
    occurrences: input.occurrences.length,
    costs: input.costRecords.length,
    timeLoss: input.timeLossRecords.length,
    rules: input.rules.length,
    recurrence: input.recurrenceDecisions.length,
    ai: input.aiRecords.length,
    reviews: input.reviewRecords.length,
    confidence: input.confidenceRecords.length,
    governance: input.governanceRecords.length,
  };
  const availableFamilies = Object.values(families).filter((count) => count > 0).length;
  return {
    families,
    availableFamilies,
    totalFamilies: Object.keys(families).length,
    percentage: Math.round((availableFamilies / Object.keys(families).length) * 10_000) / 100,
  };
}

export function executiveDashboardDefinitions(metrics) {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, metric]) => [
      key,
      { label: metric.label, formula: metric.formula },
    ]),
  );
}
