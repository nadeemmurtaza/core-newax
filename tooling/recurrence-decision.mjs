import {
  MAX_RECURRENCE_EXPLANATIONS,
  MAX_RECURRENCE_OCCURRENCES,
  MAX_RECURRENCE_RULES,
  RECURRENCE_SCHEMA_VERSION,
} from './recurrence-schema.mjs';
import { recurrenceDigest, stableRecurrenceValue } from './recurrence-normalization.mjs';
import { prepareRecurrenceEvidence, recurrenceChronology } from './recurrence-series.mjs';
import {
  applicableRecurrenceRule,
  recurrenceEscalation,
  recurrenceExplanationErrors,
} from './recurrence-escalation.mjs';

function clearDecision(previousEscalations) {
  const core = stableRecurrenceValue({
    schemaVersion: RECURRENCE_SCHEMA_VERSION,
    state: 'clear',
    escalation: 'none',
    blocker: false,
    rootCauseId: null,
    currentOccurrence: null,
    previousOccurrences: [],
    previousPrNumbers: [],
    allOccurrences: [],
    rule: null,
    explanation: null,
    missingEvidence: [],
    previousEscalations,
    counts: { all: 0, previous: 0, preRule: 0, postRule: 0 },
  });
  return { ...core, digest: recurrenceDigest(core) };
}

export function detectRecurrence(input = {}, options = {}) {
  if ((input.occurrences ?? []).length > MAX_RECURRENCE_OCCURRENCES) {
    throw new TypeError(`occurrences exceeds ${MAX_RECURRENCE_OCCURRENCES} entries.`);
  }
  if ((input.rules ?? []).length > MAX_RECURRENCE_RULES) {
    throw new TypeError(`rules exceeds ${MAX_RECURRENCE_RULES} entries.`);
  }
  if ((input.explanations ?? []).length > MAX_RECURRENCE_EXPLANATIONS) {
    throw new TypeError(`explanations exceeds ${MAX_RECURRENCE_EXPLANATIONS} entries.`);
  }
  const { occurrences, rules, explanations, previousEscalations } =
    prepareRecurrenceEvidence(input);
  if (occurrences.length === 0) {
    return clearDecision(previousEscalations);
  }

  const currentId =
    options.currentOccurrenceId ?? input.currentOccurrenceId ?? occurrences.at(-1).id;
  const current = occurrences.find((occurrence) => occurrence.id === currentId);
  if (current === undefined) {
    throw new TypeError(`Current occurrence does not exist: ${currentId}.`);
  }
  const sameRoot = occurrences
    .filter((occurrence) => occurrence.rootCauseId === current.rootCauseId)
    .sort(recurrenceChronology);
  const currentIndex = sameRoot.findIndex((occurrence) => occurrence.id === current.id);
  const previous = sameRoot.slice(0, currentIndex);
  const rule = applicableRecurrenceRule(rules, current.rootCauseId, current.occurredAt);
  const postRuleOccurrences =
    rule === null
      ? []
      : sameRoot.filter(
          (occurrence) => Date.parse(occurrence.occurredAt) >= Date.parse(rule.effectiveAt),
        );
  const postRuleIndex = postRuleOccurrences.findIndex((occurrence) => occurrence.id === current.id);
  const postRuleCount = postRuleIndex === -1 ? 0 : postRuleIndex + 1;
  const explanation =
    explanations
      .filter((entry) => entry.occurrenceId === current.id)
      .sort((left, right) => left.id.localeCompare(right.id))
      .at(-1) ?? null;

  const missingEvidence = [];
  let state = 'clear';
  let escalation = 'none';
  if (previous.length > 0 && rule === null) {
    state = 'observe';
    escalation = 'observe';
  } else if (previous.length > 0 && rule !== null) {
    const errors = recurrenceExplanationErrors(explanation, rule, current);
    missingEvidence.push(...errors);
    escalation = recurrenceEscalation(
      postRuleCount,
      explanation,
      rule,
      current.rootCauseId,
      previousEscalations,
    );
    if (
      explanation?.state === 'waived' &&
      explanation.disposition === 'bypassed-with-approval' &&
      errors.length === 0
    ) {
      state = 'waived';
    } else if (explanation?.state === 'resolved' && errors.length === 0) {
      state = 'resolved';
    } else if (errors.length > 0) {
      state = 'insufficient-evidence';
    } else {
      state = 'detected';
    }
  }

  const reviewReady = options.reviewReady ?? input.reviewReady ?? false;
  const blocker =
    reviewReady &&
    ['detected', 'insufficient-evidence'].includes(state) &&
    ['warning', 'high', 'critical'].includes(escalation);
  const core = stableRecurrenceValue({
    schemaVersion: RECURRENCE_SCHEMA_VERSION,
    rootCauseId: current.rootCauseId,
    state,
    escalation,
    blocker,
    currentOccurrence: current,
    previousOccurrences: previous,
    previousPrNumbers: [
      ...new Set(previous.map((occurrence) => occurrence.prNumber).filter(Boolean)),
    ],
    allOccurrences: sameRoot,
    rule,
    explanation,
    missingEvidence: [...new Set(missingEvidence)].sort(),
    previousEscalations,
    counts: {
      all: sameRoot.length,
      previous: previous.length,
      preRule:
        rule === null
          ? sameRoot.length
          : sameRoot.filter(
              (occurrence) => Date.parse(occurrence.occurredAt) < Date.parse(rule.effectiveAt),
            ).length,
      postRule: postRuleCount,
    },
  });
  return { ...core, digest: recurrenceDigest(core) };
}
