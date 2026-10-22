import {
  EXECUTIVE_DASHBOARD_POLICY_VERSION,
  EXECUTIVE_DASHBOARD_SCHEMA_VERSION,
} from './executive-dashboard-schema.mjs';
import { stableDashboardStringify } from './executive-dashboard-normalization.mjs';
import { buildExecutiveDashboard } from './executive-dashboard-build.mjs';

export function validateExecutiveDashboardSnapshot(input, snapshot) {
  const expected = buildExecutiveDashboard(input);
  const errors = [];
  if (snapshot?.schemaVersion !== EXECUTIVE_DASHBOARD_SCHEMA_VERSION) {
    errors.push('Dashboard schema version is stale.');
  }
  if (snapshot?.policyVersion !== EXECUTIVE_DASHBOARD_POLICY_VERSION) {
    errors.push('Dashboard policy version is stale.');
  }
  if (stableDashboardStringify(snapshot) !== stableDashboardStringify(expected)) {
    errors.push('Dashboard snapshot does not match recalculated content.');
  }
  return errors;
}
