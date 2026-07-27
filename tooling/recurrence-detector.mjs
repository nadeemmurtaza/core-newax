import { normalizeOccurrence } from './recurrence-models.mjs';
import {
  dedupeExactOccurrences,
  dedupeRecurrenceIds,
  recurrenceChronology,
} from './recurrence-series.mjs';
import { detectRecurrence } from './recurrence-decision.mjs';

export { detectRecurrence } from './recurrence-decision.mjs';

export function detectAllRecurrences(input = {}, options = {}) {
  const normalized = dedupeExactOccurrences(
    dedupeRecurrenceIds((input.occurrences ?? []).map(normalizeOccurrence), 'Occurrence'),
  ).filter((occurrence) => ['confirmed', 'machine-supported'].includes(occurrence.status));
  const rootCauseIds = [...new Set(normalized.map((occurrence) => occurrence.rootCauseId))].sort();
  return rootCauseIds
    .flatMap((rootCauseId) => {
      const rootOccurrences = normalized
        .filter((occurrence) => occurrence.rootCauseId === rootCauseId)
        .sort(recurrenceChronology);
      const current =
        options.currentPrNumber === undefined || options.currentPrNumber === null
          ? rootOccurrences.at(-1)
          : rootOccurrences
              .filter((occurrence) => occurrence.prNumber === Number(options.currentPrNumber))
              .at(-1);
      return current === undefined
        ? []
        : [
            detectRecurrence(
              { ...input, occurrences: normalized, currentOccurrenceId: current.id },
              {
                reviewReady: options.reviewReady ?? input.reviewReady ?? false,
                currentOccurrenceId: current.id,
              },
            ),
          ];
    })
    .sort((left, right) => left.rootCauseId.localeCompare(right.rootCauseId));
}

export function validateRecurrenceDecision(decision) {
  const errors = [];
  try {
    const rebuilt = detectRecurrence({
      occurrences: decision?.allOccurrences ?? [],
      rules: decision?.rule ? [decision.rule] : [],
      explanations: decision?.explanation ? [decision.explanation] : [],
      currentOccurrenceId: decision?.currentOccurrence?.id,
      previousEscalations: decision?.previousEscalations ?? [],
      reviewReady: decision?.blocker ?? false,
    });
    if (decision?.digest !== rebuilt.digest) {
      errors.push('Recurrence decision digest does not match recalculated content.');
    }
  } catch (error) {
    errors.push(String(error.message ?? error));
  }
  return errors;
}
