export function dashboardOccurrenceKey(entry) {
  return `${entry.rootCauseId}|${entry.id}`;
}

export function distinctDashboardOccurrences(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = dashboardOccurrenceKey(entry);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
