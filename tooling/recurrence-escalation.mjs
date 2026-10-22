import { ESCALATION_RANK, HIGH_RISK_DISPOSITIONS } from './recurrence-schema.mjs';
import { recurrenceChronology } from './recurrence-series.mjs';

export function applicableRecurrenceRule(rules, rootCauseId, occurredAt) {
  const time = Date.parse(occurredAt);
  return (
    rules
      .filter((rule) => rule.rootCauseId === rootCauseId)
      .filter((rule) => rule.state !== 'candidate' && rule.state !== 'retired')
      .filter((rule) => rule.effectiveAt !== null && Date.parse(rule.effectiveAt) <= time)
      .filter((rule) => rule.retiredAt === null || Date.parse(rule.retiredAt) > time)
      .sort((left, right) => recurrenceChronology(right, left))[0] ?? null
  );
}

export function recurrenceExplanationErrors(explanation, rule, occurrence) {
  if (explanation === null) {
    return ['An evidence-backed control-gap explanation is required.'];
  }
  const errors = [];
  if (explanation.evidenceRefs.length === 0) {
    errors.push('Control-gap explanation requires evidence references.');
  }
  if (!explanation.reviewer) {
    errors.push('Control-gap explanation requires a reviewer.');
  }
  if (!explanation.reason) {
    errors.push('Control-gap explanation requires a reason.');
  }
  if (explanation.disposition === 'unknown') {
    errors.push('Unknown disposition remains unresolved.');
  }
  if (explanation.state === 'candidate') {
    errors.push('Control-gap explanation remains a candidate.');
  }
  if (
    explanation.disposition === 'not-effective-yet' &&
    rule !== null &&
    Date.parse(rule.effectiveAt) <= Date.parse(occurrence.occurredAt)
  ) {
    errors.push('The applicable rule was already effective before this occurrence.');
  }
  if (explanation.disposition === 'bypassed-with-approval') {
    if (!explanation.approver) {
      errors.push('Approved bypass requires an approver.');
    }
    if (!explanation.reason) {
      errors.push('Approved bypass requires a reason.');
    }
    if (!explanation.scope) {
      errors.push('Approved bypass requires a bounded scope.');
    }
    if (!explanation.effectiveAt) {
      errors.push('Approved bypass requires an effective time.');
    }
    if (
      explanation.effectiveAt &&
      Date.parse(explanation.effectiveAt) > Date.parse(occurrence.occurredAt)
    ) {
      errors.push('Approved bypass must be effective no later than the occurrence.');
    }
  }
  if (rule?.state === 'enforced' && explanation.disposition === 'not-integrated') {
    errors.push(
      'An enforced rule cannot be explained as not integrated without correcting the rule state.',
    );
  }
  return errors;
}

export function recurrenceEscalation(
  postRuleCount,
  explanation,
  rule,
  rootCauseId,
  previousEscalations = [],
) {
  let level =
    postRuleCount <= 0
      ? 'observe'
      : postRuleCount === 1
        ? 'warning'
        : postRuleCount === 2
          ? 'high'
          : 'critical';
  if (
    rule?.state === 'enforced' &&
    explanation !== null &&
    HIGH_RISK_DISPOSITIONS.includes(explanation.disposition) &&
    ESCALATION_RANK[level] < ESCALATION_RANK.high
  ) {
    level = 'high';
  }
  const unresolvedHigh = previousEscalations.some(
    (entry) =>
      (entry.rootCauseId === null || entry.rootCauseId === rootCauseId) &&
      ['high', 'critical'].includes(entry.level) &&
      !['resolved', 'waived'].includes(entry.state),
  );
  return unresolvedHigh && postRuleCount >= 1 ? 'critical' : level;
}
