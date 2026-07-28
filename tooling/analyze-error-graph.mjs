import { readFileSync } from 'node:fs';

import {
  analyzeErrorRelationshipGraph,
  buildErrorRelationshipGraph,
} from './error-relationship-graph.mjs';

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const next = values[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      result[value.slice(2)] = next;
      index += 1;
    } else {
      result[value.slice(2)] = 'true';
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
const text =
  argumentsMap.file !== undefined
    ? readFileSync(argumentsMap.file, 'utf8')
    : argumentsMap.json !== undefined
      ? argumentsMap.json
      : await readStdin();
const input = JSON.parse(text);
const events = Array.isArray(input) ? input : input.events;
if (!Array.isArray(events)) {
  throw new TypeError('Graph analysis requires an event array or an object containing events.');
}
const graph = buildErrorRelationshipGraph(events, {
  explicitEdges: Array.isArray(input.explicitEdges) ? input.explicitEdges : [],
});
const focusNodeIds =
  argumentsMap.focus === undefined
    ? Array.isArray(input.focusNodeIds)
      ? input.focusNodeIds
      : []
    : argumentsMap.focus
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
const analysis = analyzeErrorRelationshipGraph(graph, focusNodeIds, {
  verifiedOnly: argumentsMap['include-candidates'] !== 'true',
});

console.log(JSON.stringify({ graph, analysis }, null, 2));
