export const EXECUTIVE_DASHBOARD_SCHEMA_VERSION = 1;
export const EXECUTIVE_DASHBOARD_POLICY_VERSION = 'EXECUTIVE-DASHBOARD-1.0.0';

export const DASHBOARD_PERIODS = Object.freeze(['week', 'month']);
export const EVIDENCE_STATUSES = Object.freeze(['verified', 'estimated']);
export const VERIFIED_ROOT_CAUSE_STATUSES = Object.freeze(['confirmed', 'machine-supported']);
export const RULE_STATES = Object.freeze(['candidate', 'generated', 'enforced', 'retired']);
export const AI_OUTCOMES = Object.freeze(['correct', 'partial', 'incorrect', 'unverified']);
export const GOVERNANCE_CONCLUSIONS = Object.freeze(['pass', 'fail', 'blocked']);
export const IGNORED_RULE_DISPOSITIONS = Object.freeze([
  'not-executed',
  'bypassed-without-approval',
  'failure-ignored',
]);

export const MAX_DASHBOARD_RECORDS = 5_000;
export const MAX_DASHBOARD_TEXT = 2_000;
export const MAX_DASHBOARD_REFS = 100;
export const DEFAULT_OBSERVATION_DAYS = 14;

export const DASHBOARD_PANEL_KEYS = Object.freeze([
  'topRecurringRootCauses',
  'mostExpensiveCategories',
  'timeLostByCategory',
  'preventionEffectiveness',
  'rulesFrequentlyIgnored',
  'meanTimeToDetect',
  'meanTimeToResolve',
  'meanTimeToVerify',
  'engineeringQualityTrend',
  'aiAccuracyTrend',
  'humanReviewEffectiveness',
]);
