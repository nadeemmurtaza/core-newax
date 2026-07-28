import {
  ERROR_GRAPH_CAUSAL_EDGE_TYPES,
  causeNodeIdForRootCause,
  cleanGraphText,
} from './error-graph-normalization.mjs';

function statusRank(status) {
  return status === 'confirmed' ? 3 : status === 'machine-supported' ? 2 : 1;
}

export function mergeGraphNode(existing, incoming) {
  if (existing === undefined) {
    return incoming;
  }
  return {
    ...existing,
    ...incoming,
    evidence: Array.from(new Set([...(existing.evidence ?? []), ...(incoming.evidence ?? [])])),
    status:
      statusRank(incoming.status) > statusRank(existing.status) ? incoming.status : existing.status,
  };
}

export function errorGraphEdgeKey(edge) {
  return `${edge.from}\u0000${edge.type}\u0000${edge.to}`;
}

export function mergeGraphEdge(existing, incoming) {
  if (existing === undefined) {
    return incoming;
  }
  return {
    ...existing,
    evidence: Array.from(new Set([...(existing.evidence ?? []), ...(incoming.evidence ?? [])])),
    status:
      statusRank(incoming.status) > statusRank(existing.status) ? incoming.status : existing.status,
  };
}

export function errorGraphEventStatus(event, normalizeGraphStatus) {
  return normalizeGraphStatus(
    event?.status ?? (event?.rootCauseDeterministic === true ? 'machine-supported' : 'candidate'),
  );
}

export function errorGraphEventContext(event) {
  return {
    repository: cleanGraphText(event.repository, 'repository', 500),
    prNumber: event.prNumber ?? null,
    commitSha: cleanGraphText(event.commitSha, 'commitSha', 80),
    workflowRunId: event.workflowRunId ?? null,
    sourceType: cleanGraphText(event.sourceType, 'sourceType', 120),
    sourceId: cleanGraphText(event.sourceId, 'sourceId', 500),
  };
}

export function resolveErrorGraphParentNodeId(hint) {
  if (hint.referenceType === 'parentNodeId') {
    return hint.referenceValue;
  }
  if (hint.referenceType === 'parentFingerprint') {
    return `occurrence:${hint.referenceValue}`;
  }
  return causeNodeIdForRootCause(hint.referenceValue);
}

export function addObservedErrorImpact(impacts, event) {
  if (event.sourceType !== 'ci-workflow' || event.workflowRunId === null) {
    return impacts;
  }
  const id = `ci-failure-${event.workflowRunId}`;
  if (impacts.some((impact) => impact.id === id)) {
    return impacts;
  }
  return [
    ...impacts,
    {
      id,
      kind: 'workflow-failure',
      label: `${event.workflowName ?? 'Continuous Integration'} failed`,
      parentImpactId: null,
      type: 'causes',
      status: 'machine-supported',
      evidence: [`Observed failed workflow run ${event.workflowRunId}.`],
    },
  ];
}

export function validateErrorGraphCausalCycles(nodes, edges) {
  const adjacency = new Map([...nodes.keys()].map((nodeId) => [nodeId, []]));
  for (const edge of edges.values()) {
    if (ERROR_GRAPH_CAUSAL_EDGE_TYPES.has(edge.type)) {
      adjacency.get(edge.from)?.push(edge.to);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(nodeId) {
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      const cycle = [...stack.slice(start), nodeId];
      throw new TypeError(
        `Error relationship graph contains a causal cycle: ${cycle.join(' -> ')}.`,
      );
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      visit(next);
    }
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const nodeId of adjacency.keys()) {
    visit(nodeId);
  }
}
