import { VERIFIED_ROOT_CAUSE_STATUSES } from './recurrence-schema.mjs';
import { normalizeExplanation, normalizeOccurrence, normalizeRule } from './recurrence-models.mjs';

export function recurrenceChronology(left, right) {
  const byTime =
    Date.parse(left.occurredAt ?? left.effectiveAt) -
    Date.parse(right.occurredAt ?? right.effectiveAt);
  return Number.isFinite(byTime) && byTime !== 0 ? byTime : left.id.localeCompare(right.id);
}

export function dedupeRecurrenceIds(values, label) {
  const map = new Map();
  for (const value of values) {
    const previous = map.get(value.id);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(value)) {
      throw new TypeError(`${label} ${value.id} has conflicting content.`);
    }
    map.set(value.id, value);
  }
  return [...map.values()];
}

function exactOccurrenceKey(occurrence) {
  return [
    occurrence.rootCauseId,
    occurrence.fingerprint ?? '',
    occurrence.sourceId ?? '',
    occurrence.prNumber ?? '',
    occurrence.issueNumber ?? '',
    occurrence.commitSha ?? '',
  ].join('|');
}

export function dedupeExactOccurrences(values) {
  const map = new Map();
  for (const occurrence of values) {
    const key = exactOccurrenceKey(occurrence);
    const previous = map.get(key);
    if (previous === undefined || occurrence.id.localeCompare(previous.id) < 0) {
      map.set(key, occurrence);
    }
  }
  return [...map.values()];
}

export function normalizePreviousEscalations(values = []) {
  return [...values]
    .map((entry, index) => {
      const level = String(entry?.level ?? '')
        .trim()
        .toLowerCase();
      const state =
        String(entry?.state ?? '')
          .trim()
          .toLowerCase() || 'detected';
      if (!['none', 'observe', 'warning', 'high', 'critical'].includes(level)) {
        throw new TypeError(`previousEscalations[${index}].level is unsupported.`);
      }
      return {
        level,
        state,
        rootCauseId: String(entry?.rootCauseId ?? '').trim() || null,
      };
    })
    .sort(
      (left, right) =>
        (left.rootCauseId ?? '').localeCompare(right.rootCauseId ?? '') ||
        left.level.localeCompare(right.level) ||
        left.state.localeCompare(right.state),
    );
}

export function prepareRecurrenceEvidence(input = {}) {
  const occurrences = dedupeExactOccurrences(
    dedupeRecurrenceIds((input.occurrences ?? []).map(normalizeOccurrence), 'Occurrence'),
  )
    .filter((occurrence) => VERIFIED_ROOT_CAUSE_STATUSES.includes(occurrence.status))
    .sort(recurrenceChronology);
  const rules = dedupeRecurrenceIds((input.rules ?? []).map(normalizeRule), 'Rule').sort(
    recurrenceChronology,
  );
  const explanations = dedupeRecurrenceIds(
    (input.explanations ?? []).map(normalizeExplanation),
    'Explanation',
  );
  return {
    occurrences,
    rules,
    explanations,
    previousEscalations: normalizePreviousEscalations(input.previousEscalations ?? []),
  };
}
