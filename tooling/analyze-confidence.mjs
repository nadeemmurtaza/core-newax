import { readFileSync } from 'node:fs';

import { renderConfidenceInputRecord, renderConfidenceScoreRecord } from './confidence-record.mjs';
import { scoreConfidenceEnvelope } from './confidence-scoring.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const file = argumentValue('--file');
if (file === null) {
  throw new Error('Usage: node tooling/analyze-confidence.mjs --file <input.json>');
}
const parsed = JSON.parse(readFileSync(file, 'utf8'));
const input = parsed.input ?? parsed;
const findingId = argumentValue('--finding-id') ?? parsed.findingId ?? 'finding';
const envelope = scoreConfidenceEnvelope(input);
const output = { findingId, input, envelope };
if (process.argv.includes('--record')) {
  output.inputRecord = renderConfidenceInputRecord({
    findingId,
    sourceType: argumentValue('--source-type') ?? parsed.sourceType ?? 'file',
    sourceRef: argumentValue('--source-ref') ?? parsed.sourceRef ?? file,
    input,
  });
  output.scoreRecord = renderConfidenceScoreRecord({ findingId, input });
}
console.log(JSON.stringify(output, null, 2));
