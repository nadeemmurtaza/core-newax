import {
  KNOWLEDGE_GRAPH_CANONICAL_EDGE_TYPES,
  KNOWLEDGE_GRAPH_NODE_TYPES,
} from './knowledge-graph-schema.mjs';

function mapsForGraph(graph, verifiedOnly = false) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = graph.edges.filter((edge) => !verifiedOnly || edge.status === 'verified');
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  for (const values of [...outgoing.values(), ...incoming.values()]) {
    values.sort((left, right) => left.id.localeCompare(right.id));
  }
  return { nodes, outgoing, incoming };
}

function componentNodeIds(graph, focusNodeId) {
  if (focusNodeId === null || focusNodeId === undefined) {
    return new Set(graph.nodes.map((node) => node.id));
  }
  const { nodes, outgoing, incoming } = mapsForGraph(graph);
  if (!nodes.has(focusNodeId)) {
    throw new TypeError(`Knowledge graph focus node does not exist: ${focusNodeId}.`);
  }
  const visited = new Set();
  const queue = [focusNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const edge of [...outgoing.get(current), ...incoming.get(current)]) {
      const neighbor = edge.from === current ? edge.to : edge.from;
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

function targets(outgoing, nodes, fromId, type, targetKind) {
  return (outgoing.get(fromId) ?? [])
    .filter((edge) => edge.status === 'verified' && edge.type === type)
    .map((edge) => nodes.get(edge.to))
    .filter((node) => node?.kind === targetKind)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function uniqueAllowed(values, allowedIds) {
  return values.filter(
    (node, index) =>
      allowedIds.has(node.id) &&
      values.findIndex((candidate) => candidate.id === node.id) === index,
  );
}

function firstCompleteChain(graph, allowedIds) {
  const { nodes, outgoing } = mapsForGraph(graph, true);
  const requirements = graph.nodes
    .filter((node) => allowedIds.has(node.id) && node.kind === 'requirement')
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const requirement of requirements) {
    for (const commit of targets(outgoing, nodes, requirement.id, 'implemented-by', 'commit')) {
      if (!allowedIds.has(commit.id)) {
        continue;
      }
      for (const pullRequest of targets(
        outgoing,
        nodes,
        commit.id,
        'included-in',
        'pull-request',
      )) {
        if (!allowedIds.has(pullRequest.id)) {
          continue;
        }
        const reviews = targets(outgoing, nodes, pullRequest.id, 'reviewed-by', 'review').filter(
          (node) => allowedIds.has(node.id),
        );
        const ciRuns = uniqueAllowed(
          [
            ...targets(outgoing, nodes, pullRequest.id, 'validated-by', 'ci-run'),
            ...targets(outgoing, nodes, commit.id, 'validated-by', 'ci-run'),
          ],
          allowedIds,
        );
        for (const review of reviews) {
          for (const ciRun of ciRuns) {
            const bugs = uniqueAllowed(
              [
                ...targets(outgoing, nodes, ciRun.id, 'revealed', 'bug'),
                ...targets(outgoing, nodes, review.id, 'revealed', 'bug'),
              ],
              allowedIds,
            );
            for (const bug of bugs) {
              for (const rootCause of targets(
                outgoing,
                nodes,
                bug.id,
                'classified-as',
                'root-cause',
              )) {
                if (!allowedIds.has(rootCause.id)) {
                  continue;
                }
                const fixes = uniqueAllowed(
                  [
                    ...targets(outgoing, nodes, rootCause.id, 'resolved-by', 'fix'),
                    ...targets(outgoing, nodes, bug.id, 'resolved-by', 'fix'),
                  ],
                  allowedIds,
                );
                for (const fix of fixes) {
                  for (const verification of targets(
                    outgoing,
                    nodes,
                    fix.id,
                    'verified-by',
                    'verification',
                  )) {
                    if (!allowedIds.has(verification.id)) {
                      continue;
                    }
                    for (const lesson of targets(
                      outgoing,
                      nodes,
                      verification.id,
                      'captured-as',
                      'lesson',
                    )) {
                      if (!allowedIds.has(lesson.id)) {
                        continue;
                      }
                      for (const rule of targets(
                        outgoing,
                        nodes,
                        lesson.id,
                        'materialized-as',
                        'rule',
                      )) {
                        if (!allowedIds.has(rule.id)) {
                          continue;
                        }
                        for (const prevention of targets(
                          outgoing,
                          nodes,
                          rule.id,
                          'enforced-by',
                          'prevention',
                        )) {
                          if (!allowedIds.has(prevention.id)) {
                            continue;
                          }
                          return [
                            requirement,
                            commit,
                            pullRequest,
                            review,
                            ciRun,
                            bug,
                            rootCause,
                            fix,
                            verification,
                            lesson,
                            rule,
                            prevention,
                          ];
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function stageSummary(graph, allowedIds) {
  return Object.fromEntries(
    KNOWLEDGE_GRAPH_NODE_TYPES.map((kind) => [
      kind,
      graph.nodes
        .filter((node) => allowedIds.has(node.id) && node.kind === kind)
        .sort((left, right) => left.id.localeCompare(right.id)),
    ]),
  );
}

function expectedEdgeGaps(stages, graph) {
  const verified = graph.edges.filter((edge) => edge.status === 'verified');
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const has = (types, fromKinds, toKinds) =>
    verified.some((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      return (
        types.includes(edge.type) && fromKinds.includes(from?.kind) && toKinds.includes(to?.kind)
      );
    });
  const checks = [
    ['requirement-to-commit', ['implemented-by'], ['requirement'], ['commit']],
    ['commit-to-pull-request', ['included-in'], ['commit'], ['pull-request']],
    ['pull-request-to-review', ['reviewed-by'], ['pull-request'], ['review']],
    ['change-to-ci-run', ['validated-by'], ['pull-request', 'commit'], ['ci-run']],
    ['ci-or-review-to-bug', ['revealed'], ['ci-run', 'review'], ['bug']],
    ['bug-to-root-cause', ['classified-as'], ['bug'], ['root-cause']],
    ['bug-or-root-cause-to-fix', ['resolved-by'], ['bug', 'root-cause'], ['fix']],
    ['fix-to-verification', ['verified-by'], ['fix'], ['verification']],
    ['verification-to-lesson', ['captured-as'], ['verification'], ['lesson']],
    ['lesson-to-rule', ['materialized-as'], ['lesson'], ['rule']],
    ['rule-to-prevention', ['enforced-by'], ['rule'], ['prevention']],
  ];
  return checks
    .filter(
      ([, , fromKinds, toKinds]) =>
        fromKinds.some((kind) => stages[kind].length > 0) &&
        toKinds.some((kind) => stages[kind].length > 0),
    )
    .filter(([, types, fromKinds, toKinds]) => !has(types, fromKinds, toKinds))
    .map(([id]) => `missing-verified-edge:${id}`);
}

export function analyzeKnowledgeHistory(graph, focusNodeId = null) {
  const allowedIds = componentNodeIds(graph, focusNodeId);
  const stages = stageSummary(graph, allowedIds);
  const chain = firstCompleteChain(graph, allowedIds);
  const displayedChain =
    chain ?? KNOWLEDGE_GRAPH_NODE_TYPES.flatMap((kind) => stages[kind].slice(0, 1));
  const missingStages = KNOWLEDGE_GRAPH_NODE_TYPES.filter((kind) => stages[kind].length === 0);
  const scopedGraph = {
    ...graph,
    nodes: graph.nodes.filter((node) => allowedIds.has(node.id)),
    edges: graph.edges.filter((edge) => allowedIds.has(edge.from) && allowedIds.has(edge.to)),
  };
  const edgeGaps = expectedEdgeGaps(stages, scopedGraph);
  const selectedIds = new Set(displayedChain.map((node) => node.id));
  const branches = graph.nodes
    .filter((node) => allowedIds.has(node.id) && !selectedIds.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const candidateEdges = graph.edges
    .filter(
      (edge) => allowedIds.has(edge.from) && allowedIds.has(edge.to) && edge.status === 'candidate',
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const verifiedCanonicalEdges = graph.edges.filter(
    (edge) =>
      allowedIds.has(edge.from) &&
      allowedIds.has(edge.to) &&
      edge.status === 'verified' &&
      KNOWLEDGE_GRAPH_CANONICAL_EDGE_TYPES.includes(edge.type),
  );
  return {
    focusNodeId,
    status: chain === null ? 'incomplete' : 'complete',
    complete: chain !== null,
    chain: displayedChain,
    stages,
    missingStages,
    gaps: [
      ...missingStages.map((kind) => `missing-stage:${kind}`),
      ...edgeGaps,
      ...(chain === null && missingStages.length === 0 && edgeGaps.length === 0
        ? ['missing-complete-verified-chain']
        : []),
    ].sort(),
    branches,
    candidateEdges,
    verifiedCanonicalEdgeCount: verifiedCanonicalEdges.length,
    connectedNodeCount: allowedIds.size,
  };
}
