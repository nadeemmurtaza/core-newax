import { readFileSync } from 'node:fs';

import { collectKnowledgeGraphForPullRequest } from './knowledge-graph-github.mjs';
import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import { renderKnowledgeGraphSection } from './knowledge-graph-renderer.mjs';
import { analyzeKnowledgeHistory } from './knowledge-graph-traversal.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function readGraph() {
  const file = argumentValue('--file');
  if (file !== null) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && parsed.digest) {
      return parsed;
    }
    const input = parsed.input ?? parsed;
    return buildKnowledgeGraph(input.nodes ?? [], input.edges ?? [], {
      source: input.source ?? null,
    });
  }
  const prNumber = argumentValue('--pr');
  if (prNumber !== null) {
    return collectKnowledgeGraphForPullRequest(Number(prNumber));
  }
  throw new Error('Provide --file <graph.json> or --pr <number>.');
}

const graph = await readGraph();
const focusNodeId = argumentValue('--focus');
const analysis = analyzeKnowledgeHistory(graph, focusNodeId);
const output = {
  graph,
  analysis,
  markdown: renderKnowledgeGraphSection(graph, {
    focusNodeId,
    recordUrl: argumentValue('--record-url'),
  }),
};
console.log(JSON.stringify(output, null, 2));
if (
  !process.argv.includes('--report-only') &&
  process.argv.includes('--require-complete') &&
  !analysis.complete
) {
  process.exitCode = 1;
}
