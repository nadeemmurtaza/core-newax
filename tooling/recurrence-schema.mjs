export const RECURRENCE_SCHEMA_VERSION = 1;

export const VERIFIED_ROOT_CAUSE_STATUSES = Object.freeze(['confirmed', 'machine-supported']);

export const RECURRENCE_STATES = Object.freeze([
  'clear',
  'observe',
  'detected',
  'resolved',
  'waived',
  'insufficient-evidence',
]);

export const RECURRENCE_ESCALATION_LEVELS = Object.freeze([
  'none',
  'observe',
  'warning',
  'high',
  'critical',
]);

export const RECURRENCE_DISPOSITIONS = Object.freeze([
  'not-applicable',
  'not-effective-yet',
  'not-integrated',
  'not-executed',
  'bypassed-with-approval',
  'bypassed-without-approval',
  'control-failed',
  'failure-ignored',
  'unknown',
]);

export const RECURRENCE_RULE_STATES = Object.freeze([
  'candidate',
  'generated',
  'enforced',
  'retired',
]);

export const RECURRENCE_EXPLANATION_STATES = Object.freeze([
  'candidate',
  'confirmed',
  'resolved',
  'waived',
]);

export const ESCALATION_RANK = Object.freeze(
  Object.fromEntries(RECURRENCE_ESCALATION_LEVELS.map((value, index) => [value, index])),
);

export const HIGH_RISK_DISPOSITIONS = Object.freeze([
  'not-executed',
  'bypassed-without-approval',
  'control-failed',
  'failure-ignored',
]);

export const MAX_RECURRENCE_OCCURRENCES = 500;
export const MAX_RECURRENCE_RULES = 100;
export const MAX_RECURRENCE_EXPLANATIONS = 500;
export const MAX_RECURRENCE_TEXT = 2_000;
export const MAX_RECURRENCE_ARRAY = 100;
