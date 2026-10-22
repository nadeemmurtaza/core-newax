import { stableKnowledgeStringify } from './knowledge-graph-normalization.mjs';
import {
  KNOWLEDGE_GRAPH_MAX_MARKER_DATA_LENGTH,
  KNOWLEDGE_GRAPH_NODE_TYPES,
} from './knowledge-graph-schema.mjs';
import { analyzeKnowledgeHistory } from './knowledge-graph-traversal.mjs';

const MARKER = 'newax-engineering-knowledge-graph';

function base64url(value) {
  return Buffer.from(stableKnowledgeStringify(value), 'utf8').toString('base64url');
}

function escapeTable(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function linkForNode(node) {
  if (node === undefined) {
    return 'Missing';
  }
  const label = escapeTable(node.label);
  return node.url ? `[${label}](${node.url})` : `\`${escapeTable(node.sourceRef)}\``;
}

function mermaidId(index) {
  return `n${index}`;
}

function mermaidLabel(node) {
  return String(node?.label ?? 'Missing')
    .replace(/["\n\r]/g, ' ')
    .slice(0, 80);
}

export function parseKnowledgeGraphMarker(body) {
  const match = String(body ?? '').match(/<!-- newax-engineering-knowledge-graph\n([\s\S]*?)\n-->/);
  if (match === null) {
    return null;
  }
  const metadata = Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf(':');
        return index === -1
          ? [line, '']
          : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
  let graph = null;
  try {
    graph = JSON.parse(Buffer.from(metadata['graph-data'] ?? '', 'base64url').toString('utf8'));
  } catch {
    graph = null;
  }
  return { metadata, graph };
}

export function renderKnowledgeGraphSection(graph, options = {}) {
  const analysis = analyzeKnowledgeHistory(graph, options.focusNodeId ?? null);
  const primaryByKind = new Map(analysis.chain.map((node) => [node.kind, node]));
  const timelineRows = KNOWLEDGE_GRAPH_NODE_TYPES.map((kind) => {
    const node = primaryByKind.get(kind);
    return `| ${kind} | ${linkForNode(node)} | ${escapeTable(node?.status ?? 'missing')} | ${escapeTable(
      node?.evidenceRefs?.join(', ') || 'none',
    )} |`;
  }).join('\n');

  const mermaidNodes = KNOWLEDGE_GRAPH_NODE_TYPES.map((kind, index) => {
    const node = primaryByKind.get(kind);
    return `  ${mermaidId(index)}["${kind}: ${mermaidLabel(node)}"]`;
  });
  const mermaidEdges = KNOWLEDGE_GRAPH_NODE_TYPES.slice(0, -1).map((kind, index) => {
    const from = primaryByKind.get(kind);
    const to = primaryByKind.get(KNOWLEDGE_GRAPH_NODE_TYPES[index + 1]);
    const verified =
      from !== undefined &&
      to !== undefined &&
      graph.edges.some(
        (edge) => edge.from === from.id && edge.to === to.id && edge.status === 'verified',
      );
    return verified
      ? `  ${mermaidId(index)} --> ${mermaidId(index + 1)}`
      : `  ${mermaidId(index)} -. timeline or missing link .-> ${mermaidId(index + 1)}`;
  });
  const branches = analysis.branches.length
    ? analysis.branches.map((node) => `- ${node.kind}: ${linkForNode(node)}`).join('\n')
    : '- None.';
  const candidates = analysis.candidateEdges.length
    ? analysis.candidateEdges
        .map(
          (edge) =>
            `- \`${edge.from}\` -[${edge.type}]-> \`${edge.to}\`: ${
              edge.evidenceRefs.join(', ') || 'no evidence reference'
            }`,
        )
        .join('\n')
    : '- None.';
  const gaps = analysis.gaps.length
    ? analysis.gaps.map((gap) => `- \`${gap}\``).join('\n')
    : '- None.';
  const encodedGraph = base64url(graph);
  if (encodedGraph.length > KNOWLEDGE_GRAPH_MAX_MARKER_DATA_LENGTH) {
    throw new TypeError(
      `Knowledge graph marker data exceeds ${KNOWLEDGE_GRAPH_MAX_MARKER_DATA_LENGTH} characters.`,
    );
  }
  const canonicalRecord = options.recordUrl
    ? `[Open the complete engineering history](${options.recordUrl})`
    : 'This issue is the canonical complete-history view.';

  return `<!-- ${MARKER}
schema-version: ${graph.schemaVersion}
graph-digest: ${graph.digest}
focus-node-id: ${analysis.focusNodeId ?? 'none'}
history-status: ${analysis.status}
graph-data: ${encodedGraph}
-->
## Engineering knowledge graph

${canonicalRecord}

- History status: \`${analysis.status}\`
- Graph digest: \`${graph.digest}\`
- Connected nodes: \`${analysis.connectedNodeCount}\`
- Verified canonical edges: \`${analysis.verifiedCanonicalEdgeCount}\`
- Candidate links do not satisfy completeness.

### Complete history

| Stage | Artifact | Status | Evidence |
|---|---|---|---|
${timelineRows}

### Overview

\`\`\`mermaid
flowchart TD
${[...mermaidNodes, ...mermaidEdges].join('\n')}
\`\`\`

### Gaps

${gaps}

### Additional branches

${branches}

### Candidate links

${candidates}
<!-- /${MARKER} -->`;
}

export function replaceKnowledgeGraphSection(body, section) {
  const pattern = new RegExp(`<!-- ${MARKER}\\n[\\s\\S]*?<!-- /${MARKER} -->`);
  const normalized = String(body ?? '').trimEnd();
  return pattern.test(normalized)
    ? normalized.replace(pattern, section)
    : `${normalized}\n\n${section}\n`;
}
