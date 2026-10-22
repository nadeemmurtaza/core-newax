import { VERIFIED_ROOT_CAUSE_STATUSES } from './executive-dashboard-schema.mjs';
import { withinDashboardWindow } from './executive-dashboard-normalization.mjs';

export function confirmedDashboardOccurrences(input) {
  return input.occurrences.filter(
    (entry) =>
      VERIFIED_ROOT_CAUSE_STATUSES.includes(entry.status) &&
      withinDashboardWindow(entry.occurredAt, input),
  );
}
