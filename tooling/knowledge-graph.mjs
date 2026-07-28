import {
  KNOWLEDGE_GRAPH_CAUSAL_EDGE_TYPES,
  KNOWLEDGE_GRAPH_MAX_EDGES,
  KNOWLEDGE_GRAPH_MAX_NODES,
  KNOWLEDGE_GRAPH_SCHEMA_VERSION,
  isAllowedKnowledgeTransition,
} from './knowledge-graph-schema.mjs';
import {
  knowledgeEdgeId,
  knowledgeGraphDigest,
  mergeKnowledgeNode,
  normalizeKnowledgeEdge,
  normalizeKnowledgeNode,
  normalizeKnowledgeMetadata,
  stableKnowledgeValue,
} from './knowledge-graph-normalization.mjs';

function validateVerifiedCycles(nodes, edges) {
  const adjacency = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const edge of edges.values()) {
    if (edge.status === 'verified' && KNOWLEDGE_GRAPH_CAUSAL_EDGE_TYPES.includes(edge.type)) {
      adjacency.get(edge.from).push(edge.to);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const path = [];
  function visit(nodeId) {
    if (visiting.has(nodeId)) {
      const start = path.indexOf(nodeId);
      throw new TypeError(
        `Verified knowledge graph cycle: ${[...path.slice(start), nodeId].join(' -> ')}.`,
      );
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    for (const child of adjacency.get(nodeId) ?? []) {
      visit(child);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const nodeId of adjacency.keys()) {
    visit(nodeId);
  }
}

function earliestTimestamp(values) {
  return values.filter(Boolean).sort()[0] ?? null;
}

function mergeKnowledgeEdge(previous, incoming) {
  if (previous === undefined) {
    return incoming;
  }
  const provenance = [...new Set([previous.provenance, incoming.provenance])].sort().join(' | ');
  const merged = {
    ...previous,
    provenance,
    evidenceRefs: [...new Set([...previous.evidenceRefs, ...incoming.evidenceRefs])].sort(),
    occurredAt: earliestTimestamp([previous.occurredAt, incoming.occurredAt]),
  };
  return { ...merged, id: knowledgeEdgeId(merged) };
}

export function buildKnowledgeGraph(nodeValues = [], edgeValues = [], options = {}) {
  if (!Array.isArray(nodeValues) || !Array.isArray(edgeValues)) {
    throw new TypeError('Knowledge graph nodes and edges must be arrays.');
  }
  if (nodeValues.length > KNOWLEDGE_GRAPH_MAX_NODES) {
    throw new TypeError(`Knowledge graph exceeds ${KNOWLEDGE_GRAPH_MAX_NODES} nodes.`);
  }
  if (edgeValues.length > KNOWLEDGE_GRAPH_MAX_EDGES) {
    throw new TypeError(`Knowledge graph exceeds ${KNOWLEDGE_GRAPH_MAX_EDGES} edges.`);
  }
  const nodes = new Map();
  nodeValues.map(normalizeKnowledgeNode).forEach((node) => {
    nodes.set(node.id, mergeKnowledgeNode(nodes.get(node.id), node));
  });
  const edges = new Map();
  edgeValues.map(normalizeKnowledgeEdge).forEach((edge) => {
    if (edge.from === edge.to) {
      throw new TypeError(`Knowledge edge ${edge.id} cannot be a self-link.`);
    }
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (fromNode === undefined) {
      throw new TypeError(`Knowledge edge ${edge.id} references missing source ${edge.from}.`);
    }
    if (toNode === undefined) {
      throw new TypeError(`Knowledge edge ${edge.id} references missing target ${edge.to}.`);
    }
    if (!isAllowedKnowledgeTransition(edge.type, fromNode.kind, toNode.kind)) {
      throw new TypeError(
        `Illegal knowledge transition ${fromNode.kind} -[${edge.type}]-> ${toNode.kind}.`,
      );
    }
    const key = `${edge.from}|${edge.type}|${edge.to}|${edge.status}`;
    edges.set(key, mergeKnowledgeEdge(edges.get(key), edge));
  });
  validateVerifiedCycles(nodes, edges);
  const graphCore = stableKnowledgeValue({
    schemaVersion: KNOWLEDGE_GRAPH_SCHEMA_VERSION,
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
    source:
      options.source === undefined || options.source === null
        ? null
        : normalizeKnowledgeMetadata(options.source, 'source'),
  });
  return { ...graphCore, digest: knowledgeGraphDigest(graphCore) };
}

export function validateKnowledgeGraph(graph) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = buildKnowledgeGraph(graph?.nodes ?? [], graph?.edges ?? [], {
      source: graph?.source ?? null,
    });
  } catch (error) {
    errors.push(String(error));
    return { errors, graph: null };
  }
  if (graph?.schemaVersion !== KNOWLEDGE_GRAPH_SCHEMA_VERSION) {
    errors.push(`Knowledge graph schemaVersion must be ${KNOWLEDGE_GRAPH_SCHEMA_VERSION}.`);
  }
  if (graph?.digest !== rebuilt.digest) {
    errors.push('Knowledge graph digest does not match normalized content.');
  }
  return { errors, graph: rebuilt };
}
