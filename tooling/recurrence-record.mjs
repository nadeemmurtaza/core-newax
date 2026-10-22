import { detectRecurrence, validateRecurrenceDecision } from './recurrence-detector.mjs';
import { stableRecurrenceStringify } from './recurrence-normalization.mjs';

const INPUT_MARKER = 'newax-recurrence-input';
const DECISION_MARKER = 'newax-recurrence-decision';

function parseJsonMarkers(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\n([\\s\\S]*?)\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      return { parseError: String(error) };
    }
  });
}

export function renderRecurrenceInputRecord(record) {
  const normalized = {
    schemaVersion: 1,
    recordId: String(record?.recordId ?? '').trim(),
    currentOccurrenceId: record?.currentOccurrenceId ?? null,
    occurrences: record?.occurrences ?? [],
    rules: record?.rules ?? [],
    explanations: record?.explanations ?? [],
    previousEscalations: record?.previousEscalations ?? [],
  };
  if (!normalized.recordId) {
    throw new TypeError('Recurrence input record requires recordId.');
  }
  detectRecurrence(normalized, { currentOccurrenceId: normalized.currentOccurrenceId });
  return `<!-- ${INPUT_MARKER}
${stableRecurrenceStringify(normalized, 2)}
-->`;
}

export function renderRecurrenceDecisionRecord(decision) {
  return `<!-- ${DECISION_MARKER}
${stableRecurrenceStringify(decision, 2)}
-->`;
}

export function parseRecurrenceInputRecords(body) {
  return parseJsonMarkers(body, INPUT_MARKER);
}

export function parseRecurrenceDecisionRecords(body) {
  return parseJsonMarkers(body, DECISION_MARKER);
}

export function collectRecurrenceRecord(issue, comments = []) {
  const bodies = [issue?.body ?? '', ...comments.map((comment) => comment.body ?? '')];
  return {
    input: bodies.flatMap(parseRecurrenceInputRecords).at(-1) ?? null,
    decision: bodies.flatMap(parseRecurrenceDecisionRecords).at(-1) ?? null,
  };
}

export function validateRecurrenceRecord(record, options = {}) {
  const errors = [];
  if (record?.input === null || record?.input === undefined) {
    return ['Recurrence input record is missing.'];
  }
  if (record.input.parseError) {
    return [`Recurrence input JSON is invalid: ${record.input.parseError}`];
  }
  let calculated;
  try {
    calculated = detectRecurrence(record.input, {
      currentOccurrenceId: record.input.currentOccurrenceId,
      reviewReady: options.reviewReady ?? false,
    });
  } catch (error) {
    return [String(error.message ?? error)];
  }
  if (record?.decision === null || record?.decision === undefined) {
    return ['Recurrence decision record is missing.'];
  }
  if (record.decision.parseError) {
    return [`Recurrence decision JSON is invalid: ${record.decision.parseError}`];
  }
  errors.push(...validateRecurrenceDecision(record.decision));
  if (record.decision.digest !== calculated.digest) {
    errors.push('Stored recurrence decision does not match recalculated input.');
  }
  return errors;
}
