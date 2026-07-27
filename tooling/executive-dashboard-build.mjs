import {
  EXECUTIVE_DASHBOARD_POLICY_VERSION,
  EXECUTIVE_DASHBOARD_SCHEMA_VERSION,
} from './executive-dashboard-schema.mjs';
import {
  dashboardDigest,
  normalizeExecutiveDashboardInput,
  stableDashboardValue,
} from './executive-dashboard-normalization.mjs';
import {
  humanReviewEffectiveness,
  meanTimeToDetect,
  meanTimeToResolve,
  meanTimeToVerify,
  mostExpensiveCategories,
  preventionEffectiveness,
  rulesFrequentlyIgnored,
  timeLostByCategory,
  topRecurringRootCauses,
} from './executive-dashboard-metrics.mjs';
import { aiAccuracyTrend, engineeringQualityTrend } from './executive-dashboard-trends.mjs';
import {
  executiveDashboardDefinitions,
  executiveDashboardSourceCoverage,
} from './executive-dashboard-coverage.mjs';

export function buildExecutiveDashboard(input = {}) {
  const normalized = normalizeExecutiveDashboardInput(input);
  const metrics = stableDashboardValue({
    topRecurringRootCauses: topRecurringRootCauses(normalized),
    mostExpensiveCategories: mostExpensiveCategories(normalized),
    timeLostByCategory: timeLostByCategory(normalized),
    preventionEffectiveness: preventionEffectiveness(normalized),
    rulesFrequentlyIgnored: rulesFrequentlyIgnored(normalized),
    meanTimeToDetect: meanTimeToDetect(normalized),
    meanTimeToResolve: meanTimeToResolve(normalized),
    meanTimeToVerify: meanTimeToVerify(normalized),
    engineeringQualityTrend: engineeringQualityTrend(normalized),
    aiAccuracyTrend: aiAccuracyTrend(normalized),
    humanReviewEffectiveness: humanReviewEffectiveness(normalized),
  });
  const core = stableDashboardValue({
    schemaVersion: EXECUTIVE_DASHBOARD_SCHEMA_VERSION,
    policyVersion: EXECUTIVE_DASHBOARD_POLICY_VERSION,
    snapshotAt: normalized.snapshotAt,
    window: {
      start: normalized.windowStart,
      end: normalized.windowEnd,
      period: normalized.period,
      minimumObservationDays: normalized.minimumObservationDays,
    },
    metrics,
    dataCoverage: executiveDashboardSourceCoverage(normalized),
    definitions: executiveDashboardDefinitions(metrics),
    inputDigest: dashboardDigest(normalized),
  });
  return { ...core, digest: dashboardDigest(core) };
}
