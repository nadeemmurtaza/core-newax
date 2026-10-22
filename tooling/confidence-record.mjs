import { scoreConfidenceEnvelope, validateConfidenceEnvelope } from './confidence-scoring.mjs';
import { normalizeString, stableStringify } from './confidence-scoring-support.mjs';

const INPUT_BLOCK = 'newax-confidence-input';
const SCORE_BLOCK = 'newax-confidence-score';

function parseJsonBlocks(body, name) {
  const expression = new RegExp(`<!-- ${name}\n([\\s\\S]*?)\n-->`, 'g');
  const records = [];
  for (const match of String(body ?? '').matchAll(expression)) {
    try {
      records.push(JSON.parse(match[1]));
    } catch (error) {
      records.push({ parseError: String(error), raw: match[1] });
    }
  }
  return records;
}

function headingValue(body, heading) {
  const lines = String(body ?? '').split('\n');
  const index = lines.findIndex(
    (line) => line.trim().toLowerCase() === `### ${heading.toLowerCase()}`,
  );
  if (index === -1) {
    return '';
  }
  const values = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (/^###\s+/.test(line.trim())) {
      break;
    }
    values.push(line);
  }
  return values.join('\n').trim();
}

function parseJsonHeading(body, heading) {
  const value = headingValue(body, heading);
  if (value.length === 0) {
    return null;
  }
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? value;
  try {
    return JSON.parse(fenced);
  } catch (error) {
    return { parseError: String(error), raw: fenced };
  }
}

export function renderConfidenceInputRecord({ findingId, sourceType, sourceRef, input }) {
  const record = {
    schemaVersion: 1,
    findingId: normalizeString(findingId),
    sourceType: normalizeString(sourceType),
    sourceRef: normalizeString(sourceRef),
    input,
  };
  if (!record.findingId) {
    throw new TypeError('Confidence input record requires findingId.');
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Confidence input record requires an input object.');
  }
  return `<!-- ${INPUT_BLOCK}\n${stableStringify(record, 2)}\n-->`;
}

export function renderConfidenceScoreRecord({ findingId, input }) {
  const envelope = scoreConfidenceEnvelope(input);
  const record = {
    schemaVersion: 1,
    findingId: normalizeString(findingId),
    policyVersion: envelope.policyVersion,
    inputDigest: envelope.inputDigest,
    envelope,
  };
  if (!record.findingId) {
    throw new TypeError('Confidence score record requires findingId.');
  }
  return `<!-- ${SCORE_BLOCK}\n${stableStringify(record, 2)}\n-->`;
}

export function parseConfidenceInputRecords(body) {
  const blocks = parseJsonBlocks(body, INPUT_BLOCK);
  if (blocks.length > 0) {
    return blocks;
  }
  const input = parseJsonHeading(body, 'Confidence input JSON');
  if (input === null) {
    return [];
  }
  return [
    {
      schemaVersion: 1,
      findingId: headingValue(body, 'Finding ID').replaceAll('`', '').trim(),
      sourceType: headingValue(body, 'Source type').replaceAll('`', '').trim(),
      sourceRef: headingValue(body, 'Source reference').replaceAll('`', '').trim(),
      input,
    },
  ];
}

export function parseConfidenceScoreRecords(body) {
  return parseJsonBlocks(body, SCORE_BLOCK);
}

export function collectConfidenceRecords(issue, comments = []) {
  const inputs = [
    ...parseConfidenceInputRecords(issue?.body ?? ''),
    ...comments.flatMap((comment) => parseConfidenceInputRecords(comment.body ?? '')),
  ];
  const scores = [
    ...parseConfidenceScoreRecords(issue?.body ?? ''),
    ...comments.flatMap((comment) => parseConfidenceScoreRecords(comment.body ?? '')),
  ];
  const latestInputByFinding = new Map();
  for (const record of inputs) {
    latestInputByFinding.set(record.findingId, record);
  }
  const latestScoreByFinding = new Map();
  for (const record of scores) {
    latestScoreByFinding.set(record.findingId, record);
  }
  return [...latestInputByFinding.values()].map((inputRecord) => ({
    inputRecord,
    scoreRecord: latestScoreByFinding.get(inputRecord.findingId) ?? null,
  }));
}

export function validateConfidenceRecordPair(pair) {
  const errors = [];
  const inputRecord = pair?.inputRecord;
  const scoreRecord = pair?.scoreRecord;
  if (inputRecord?.parseError) {
    return [`Confidence input JSON is invalid: ${inputRecord.parseError}`];
  }
  if (!normalizeString(inputRecord?.findingId)) {
    errors.push('Confidence input findingId is missing.');
  }
  if (inputRecord?.input === null || typeof inputRecord?.input !== 'object') {
    errors.push('Confidence input object is missing.');
  }
  if (scoreRecord === null || scoreRecord === undefined) {
    errors.push(
      `Confidence score record is missing for ${inputRecord?.findingId || 'unknown finding'}.`,
    );
    return errors;
  }
  if (scoreRecord.parseError) {
    errors.push(`Confidence score JSON is invalid: ${scoreRecord.parseError}`);
    return errors;
  }
  if (inputRecord.schemaVersion !== undefined && inputRecord.schemaVersion !== 1) {
    errors.push('Confidence input schemaVersion must be 1.');
  }
  if (scoreRecord.schemaVersion !== 1) {
    errors.push('Confidence score schemaVersion must be 1.');
  }
  if (scoreRecord.findingId !== inputRecord.findingId) {
    errors.push('Confidence score findingId does not match its input record.');
  }
  if (scoreRecord.envelope !== null && typeof scoreRecord.envelope === 'object') {
    if (scoreRecord.policyVersion !== scoreRecord.envelope.policyVersion) {
      errors.push('Confidence score policyVersion does not match its envelope.');
    }
    if (scoreRecord.inputDigest !== scoreRecord.envelope.inputDigest) {
      errors.push('Confidence score inputDigest does not match its envelope.');
    }
  }
  if (inputRecord?.input && scoreRecord.envelope) {
    errors.push(...validateConfidenceEnvelope(inputRecord.input, scoreRecord.envelope));
  }
  return errors;
}
