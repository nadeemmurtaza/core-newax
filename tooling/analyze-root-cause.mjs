import { readFileSync } from 'node:fs';

import { confidenceForRootCauseOutput } from './confidence-finding-adapters.mjs';
import { loadCatalog } from './engineering-learning-core.mjs';
import { analyzeRootCause, compareRootCauseOccurrences } from './root-cause-engine.mjs';

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const argumentsMap = parseArguments(process.argv.slice(2));
let input;
if (argumentsMap.file !== undefined) {
  input = readJson(argumentsMap.file);
} else if (argumentsMap.json !== undefined) {
  input = JSON.parse(argumentsMap.json);
} else if (!process.stdin.isTTY) {
  const text = (await readStdin()).trim();
  if (text.length > 0) {
    input = JSON.parse(text);
  }
}

if (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input)) {
  throw new TypeError('Provide one root-cause evidence object through --file, --json, or stdin.');
}

const catalog = argumentsMap.catalog === undefined ? loadCatalog() : readJson(argumentsMap.catalog);
const assessment = analyzeRootCause(input, catalog);
const comparison =
  argumentsMap.compare === undefined
    ? null
    : compareRootCauseOccurrences(
        {
          category: assessment.selected.category,
          fingerprint: input.fingerprint,
          matchedSignatures: assessment.selected.matchedSignatures,
          prNumber: input.prNumber,
          rootCauseId: assessment.selected.rootCauseId,
          sourceId: input.sourceId,
          status: assessment.status,
        },
        readJson(argumentsMap.compare),
      );
const confidenceScores = confidenceForRootCauseOutput({ input, assessment, comparison });

console.log(
  JSON.stringify(
    {
      assessment,
      comparison,
      confidenceScores,
      completionClaim:
        assessment.status === 'machine-supported'
          ? 'Machine evidence supports this catalog classification; semantic causality still remains reviewable.'
          : 'This is a candidate assessment and must not be represented as a confirmed root cause.',
    },
    null,
    2,
  ),
);
