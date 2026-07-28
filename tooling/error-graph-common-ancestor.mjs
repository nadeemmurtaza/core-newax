import {
  assertErrorGraphNode,
  createErrorGraphIndex,
  errorGraphHasPath,
  findErrorPath,
  findErrorRootAncestors,
  listErrorAncestors,
} from './error-graph-traversal.mjs';

function intersection(sets) {
  if (sets.length === 0) {
    return new Set();
  }
  return new Set([...sets[0]].filter((value) => sets.every((set) => set.has(value))));
}

export function findLowestCommonErrorAncestors(graph, nodeIds, options = {}) {
  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new TypeError('Nearest common ancestor analysis requires at least two node IDs.');
  }
  const index = createErrorGraphIndex(graph, options);
  for (const nodeId of nodeIds) {
    assertErrorGraphNode(index, nodeId);
  }
  const common = intersection(
    nodeIds.map(
      (nodeId) => new Set(listErrorAncestors(graph, nodeId, { ...options, includeSelf: true })),
    ),
  );
  return [...common]
    .filter(
      (candidate) =>
        ![...common].some(
          (other) => other !== candidate && errorGraphHasPath(index, candidate, other),
        ),
    )
    .sort();
}

export function findCommonErrorRootAncestors(graph, nodeIds, options = {}) {
  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new TypeError('Common root analysis requires at least two node IDs.');
  }
  const rootSets = nodeIds.map((nodeId) => new Set(findErrorRootAncestors(graph, nodeId, options)));
  return [...intersection(rootSets)].sort();
}

export function analyzeErrorRelationshipGraph(graph, focusNodeIds = [], options = {}) {
  const index = createErrorGraphIndex(graph, options);
  const focus = focusNodeIds.length === 0 ? [...index.nodes.keys()] : focusNodeIds;
  for (const nodeId of focus) {
    assertErrorGraphNode(index, nodeId);
  }
  const rootsByNode = Object.fromEntries(
    focus.map((nodeId) => [nodeId, findErrorRootAncestors(graph, nodeId, options)]),
  );
  const commonRootAncestorIds =
    focus.length < 2
      ? (rootsByNode[focus[0]] ?? [])
      : findCommonErrorRootAncestors(graph, focus, options);
  const lowestCommonAncestorIds =
    focus.length < 2 ? [] : findLowestCommonErrorAncestors(graph, focus, options);
  const chains = [];
  for (const rootId of commonRootAncestorIds) {
    for (const targetId of focus) {
      const path = findErrorPath(graph, rootId, targetId, options);
      if (path !== null) {
        chains.push({ rootId, targetId, path });
      }
    }
  }
  return {
    verifiedOnly: options.verifiedOnly !== false,
    focusNodeIds: focus,
    commonRootAncestorIds,
    lowestCommonAncestorIds,
    rootsByNode,
    chains,
  };
}
