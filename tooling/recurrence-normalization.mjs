import { createHash } from 'node:crypto';

import { MAX_RECURRENCE_ARRAY, MAX_RECURRENCE_TEXT } from './recurrence-schema.mjs';

export function cleanRecurrenceText(value, field = 'value', maximum = MAX_RECURRENCE_TEXT) {
  if (value === undefined || value === null) {
    return '';
  }
  const normalized = String(value).replaceAll('\u0000', '').trim();
  if (normalized.length > maximum) {
    throw new TypeError(`${field} exceeds ${maximum} characters.`);
  }
  return normalized;
}

export function cleanRecurrenceArray(value, field = 'values') {
  const input = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ''
      ? []
      : [value];
  if (input.length > MAX_RECURRENCE_ARRAY) {
    throw new TypeError(`${field} exceeds ${MAX_RECURRENCE_ARRAY} entries.`);
  }
  return [
    ...new Set(input.map((entry) => cleanRecurrenceText(entry, field)).filter(Boolean)),
  ].sort();
}

export function normalizeRecurrenceDate(value, field, required = false) {
  const text = cleanRecurrenceText(value, field, 100);
  if (!text) {
    if (required) {
      throw new TypeError(`${field} is required.`);
    }
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${field} must be an ISO-compatible timestamp.`);
  }
  return date.toISOString();
}

export function optionalRecurrenceInteger(value, field) {
  if (value === undefined || value === null || value === '' || value === 'none') {
    return null;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }
  return number;
}

export function stableRecurrenceValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableRecurrenceValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableRecurrenceValue(entry)]),
    );
  }
  return value;
}

export function stableRecurrenceStringify(value, spacing = 0) {
  return JSON.stringify(stableRecurrenceValue(value), null, spacing);
}

export function recurrenceDigest(value) {
  return createHash('sha256').update(stableRecurrenceStringify(value)).digest('hex');
}
