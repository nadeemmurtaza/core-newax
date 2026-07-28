import { readFileSync } from 'node:fs';

import { deliverExternalFailure } from './deliver-engineering-event.mjs';
import { parseEngineeringEventInput } from './external-failure-intake.mjs';

function parseArguments(values) {
  const result = { positional: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      result.positional.push(value);
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

const argumentsMap = parseArguments(process.argv.slice(2));
let rawInput = '';
if (argumentsMap.file !== undefined) {
  rawInput = readFileSync(argumentsMap.file, 'utf8');
} else if (argumentsMap.json !== undefined) {
  rawInput = argumentsMap.json;
} else if (!process.stdin.isTTY) {
  rawInput = await readStdin();
}

let payloads = parseEngineeringEventInput(rawInput);
if (payloads.length === 0 && argumentsMap.summary !== undefined) {
  payloads = [
    {
      sourceType: argumentsMap['source-type'] ?? argumentsMap.sourceType ?? 'manual',
      environment: argumentsMap.environment,
      severity: argumentsMap.severity,
      sourceId: argumentsMap['source-id'],
      repository: argumentsMap.repository,
      prNumber: argumentsMap['pr-number'],
      commitSha: argumentsMap['commit-sha'],
      service: argumentsMap.service,
      component: argumentsMap.component,
      operation: argumentsMap.operation,
      release: argumentsMap.release,
      traceId: argumentsMap['trace-id'],
      summary: argumentsMap.summary,
      details: argumentsMap.details,
      evidence: argumentsMap.evidence,
    },
  ];
}
if (payloads.length === 0) {
  throw new Error('Provide --file, --json, NDJSON through stdin, or a --summary event definition.');
}

const results = [];
for (const payload of payloads) {
  results.push(await deliverExternalFailure(payload));
}

console.log(
  JSON.stringify({
    accepted: results.length,
    results: results.map((result) => ({
      delivery: result.delivery,
      issueNumber: result.issueNumber ?? null,
      path: result.path ?? null,
      sourceId: result.event.sourceId,
    })),
  }),
);
