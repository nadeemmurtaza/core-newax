import {
  ERROR_GRAPH_CAUSAL_EDGE_TYPES,
  ERROR_GRAPH_VERIFIED_STATUSES,
} from './error-graph-model.mjs';

export function createErrorGraphIndex(graph, options = {}) {
  const verifiedOnly = options.verifiedOnly !== false;
  const nodes = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const causalEdges = (graph?.edges ?? []).filter(
    (edge) =>
      ERROR_GRAPH_CAUSAL_EDGE_TYPES.has(edge.type) &&
      (!verifiedOnly || ERROR_GRAPH_VERIFIED_STATUSES.has(edge.status)),
  );
  const outgoing = new Map([...nodes.keys()].map((nodeId) => [nodeId, []]));
  const incoming = new Map([...nodes.keys()].map((nodeId) => [nodeId, []]));
  for (const edge of causalEdges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  return { nodes, causalEdges, outgoing, incoming };
}

export function assertErrorGraphNode(index, nodeId) {
  if (!index.nodes.has(nodeId)) {
    throw new TypeError(`Unknown error relationship node: ${nodeId}.`);
  }
}

export function listErrorAncestors(graph, nodeId, options = {}) {
  const index = createErrorGraphIndex(graph, options);
  assertErrorGraphNode(index, nodeId);
  const includeSelf = options.includeSelf === true;
  const seen = new Set(includeSelf ? [nodeId] : []);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of index.incoming.get(current) ?? []) {
      if (!seen.has(edge.from)) {
        seen.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return [...seen].sort();
}

export function findErrorRootAncestors(graph, nodeId, options = {}) {
  const index = createErrorGraphIndex(graph, options);
  assertErrorGraphNode(index, nodeId);
  const ancestors = new Set(listErrorAncestors(graph, nodeId, { ...options, includeSelf: true }));
  return [...ancestors]
    .filter((candidate) =>
      (index.incoming.get(candidate) ?? []).every((edge) => !ancestors.has(edge.from)),
    )
    .sort();
}

export function errorGraphHasPath(index, from, to) {
  if (from === to) {
    return true;
  }
  const visited = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of index.outgoing.get(current) ?? []) {
      if (edge.to === to) {
        return true;
      }
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return false;
}

export function findErrorPath(graph, from, to, options = {}) {
  const index = createErrorGraphIndex(graph, options);
  assertErrorGraphNode(index, from);
  assertErrorGraphNode(index, to);
  const queue = [{ nodeId: from, path: [from] }];
  const visited = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.nodeId === to) {
      return current.path;
    }
    for (const edge of index.outgoing.get(current.nodeId) ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({ nodeId: edge.to, path: [...current.path, edge.to] });
      }
    }
  }
  return null;
}
