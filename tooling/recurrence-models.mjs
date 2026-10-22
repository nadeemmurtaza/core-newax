import { createHash } from 'node:crypto';

import {
  RECURRENCE_DISPOSITIONS,
  RECURRENCE_EXPLANATION_STATES,
  RECURRENCE_RULE_STATES,
} from './recurrence-schema.mjs';
import {
  cleanRecurrenceArray,
  cleanRecurrenceText,
  normalizeRecurrenceDate,
  optionalRecurrenceInteger,
} from './recurrence-normalization.mjs';

export function normalizeOccurrence(value, index = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`occurrences[${index}] must be an object.`);
  }
  const rootCauseId = cleanRecurrenceText(
    value.rootCauseId ?? value['root-cause-id'],
    `occurrences[${index}].rootCauseId`,
    300,
  );
  const status = cleanRecurrenceText(
    value.status ?? value.rootCauseStatus ?? value['root-cause-status'] ?? 'candidate',
    `occurrences[${index}].status`,
    100,
  ).toLowerCase();
  const occurredAt = normalizeRecurrenceDate(
    value.occurredAt ?? value.at ?? value.createdAt,
    `occurrences[${index}].occurredAt`,
    true,
  );
  const prNumber = optionalRecurrenceInteger(
    value.prNumber ?? value['pr-number'],
    `occurrences[${index}].prNumber`,
  );
  const issueNumber = optionalRecurrenceInteger(
    value.issueNumber ?? value['issue-number'],
    `occurrences[${index}].issueNumber`,
  );
  const sourceId =
    cleanRecurrenceText(
      value.sourceId ?? value['source-id'],
      `occurrences[${index}].sourceId`,
      500,
    ) || null;
  const fingerprint =
    cleanRecurrenceText(value.fingerprint, `occurrences[${index}].fingerprint`, 500) || null;
  const commitSha =
    cleanRecurrenceText(
      value.commitSha ?? value['commit-sha'],
      `occurrences[${index}].commitSha`,
      100,
    ) || null;
  if (!rootCauseId) {
    throw new TypeError(`occurrences[${index}].rootCauseId is required.`);
  }
  if (prNumber === null && issueNumber === null && sourceId === null && fingerprint === null) {
    throw new TypeError(`occurrences[${index}] requires a durable occurrence identity.`);
  }
  const identity = [
    rootCauseId,
    prNumber ?? '',
    issueNumber ?? '',
    sourceId ?? '',
    fingerprint ?? '',
    commitSha ?? '',
  ].join('|');
  return {
    id:
      cleanRecurrenceText(value.id, `occurrences[${index}].id`, 500) ||
      `occ-${createHash('sha256').update(identity).digest('hex').slice(0, 20)}`,
    rootCauseId,
    status,
    occurredAt,
    prNumber,
    issueNumber,
    sourceId,
    fingerprint,
    commitSha,
    title: cleanRecurrenceText(value.title, `occurrences[${index}].title`, 500) || null,
    url: cleanRecurrenceText(value.url, `occurrences[${index}].url`, 2_000) || null,
    evidenceRefs: cleanRecurrenceArray(
      value.evidenceRefs ?? value['evidence-refs'],
      `occurrences[${index}].evidenceRefs`,
    ),
  };
}

export function normalizeRule(value, index = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`rules[${index}] must be an object.`);
  }
  const rootCauseId = cleanRecurrenceText(
    value.rootCauseId ?? value['root-cause-id'],
    `rules[${index}].rootCauseId`,
    300,
  );
  const state = cleanRecurrenceText(
    value.state ?? 'candidate',
    `rules[${index}].state`,
    100,
  ).toLowerCase();
  if (!rootCauseId) {
    throw new TypeError(`rules[${index}].rootCauseId is required.`);
  }
  if (!RECURRENCE_RULE_STATES.includes(state)) {
    throw new TypeError(`rules[${index}].state is unsupported: ${state}.`);
  }
  const effectiveAt = normalizeRecurrenceDate(
    value.effectiveAt ?? value['effective-at'],
    `rules[${index}].effectiveAt`,
    state !== 'candidate',
  );
  const sourceRef =
    cleanRecurrenceText(
      value.sourceRef ?? value['source-ref'],
      `rules[${index}].sourceRef`,
      1_000,
    ) || null;
  const evidenceRefs = cleanRecurrenceArray(
    value.evidenceRefs ?? value['evidence-refs'],
    `rules[${index}].evidenceRefs`,
  );
  if (sourceRef === null && evidenceRefs.length === 0) {
    throw new TypeError(
      `rules[${index}] requires a durable source reference or evidence reference.`,
    );
  }
  return {
    id:
      cleanRecurrenceText(value.id, `rules[${index}].id`, 500) ||
      `rule-${createHash('sha256')
        .update([rootCauseId, effectiveAt ?? 'candidate', state].join('|'))
        .digest('hex')
        .slice(0, 20)}`,
    rootCauseId,
    state,
    effectiveAt,
    retiredAt: normalizeRecurrenceDate(
      value.retiredAt ?? value['retired-at'],
      `rules[${index}].retiredAt`,
    ),
    title:
      cleanRecurrenceText(value.title ?? value.preventionControl, `rules[${index}].title`, 1_000) ||
      null,
    sourceRef,
    owner: cleanRecurrenceText(value.owner, `rules[${index}].owner`, 300) || null,
    reviewer: cleanRecurrenceText(value.reviewer, `rules[${index}].reviewer`, 300) || null,
    evidenceRefs,
  };
}

export function normalizeExplanation(value, index = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`explanations[${index}] must be an object.`);
  }
  const occurrenceId = cleanRecurrenceText(
    value.occurrenceId ?? value['occurrence-id'],
    `explanations[${index}].occurrenceId`,
    500,
  );
  const disposition = cleanRecurrenceText(
    value.disposition,
    `explanations[${index}].disposition`,
    100,
  ).toLowerCase();
  const state = cleanRecurrenceText(
    value.state ?? 'candidate',
    `explanations[${index}].state`,
    100,
  ).toLowerCase();
  if (!occurrenceId) {
    throw new TypeError(`explanations[${index}].occurrenceId is required.`);
  }
  if (!RECURRENCE_DISPOSITIONS.includes(disposition)) {
    throw new TypeError(
      `explanations[${index}].disposition is unsupported: ${disposition || 'missing'}.`,
    );
  }
  if (!RECURRENCE_EXPLANATION_STATES.includes(state)) {
    throw new TypeError(`explanations[${index}].state is unsupported: ${state}.`);
  }
  return {
    id:
      cleanRecurrenceText(value.id, `explanations[${index}].id`, 500) ||
      `explanation-${createHash('sha256')
        .update([occurrenceId, disposition, state].join('|'))
        .digest('hex')
        .slice(0, 20)}`,
    occurrenceId,
    disposition,
    state,
    reason: cleanRecurrenceText(value.reason, `explanations[${index}].reason`, 2_000) || null,
    scope: cleanRecurrenceText(value.scope, `explanations[${index}].scope`, 1_000) || null,
    reviewer: cleanRecurrenceText(value.reviewer, `explanations[${index}].reviewer`, 300) || null,
    approver: cleanRecurrenceText(value.approver, `explanations[${index}].approver`, 300) || null,
    effectiveAt: normalizeRecurrenceDate(
      value.effectiveAt ?? value['effective-at'],
      `explanations[${index}].effectiveAt`,
    ),
    evidenceRefs: cleanRecurrenceArray(
      value.evidenceRefs ?? value['evidence-refs'],
      `explanations[${index}].evidenceRefs`,
    ),
  };
}
