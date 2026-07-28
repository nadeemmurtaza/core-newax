import {
  buildErrorRelationshipGraph,
  findCommonErrorRootAncestors,
  findErrorPath,
  findErrorRootAncestors,
  findLowestCommonErrorAncestors,
  occurrenceNodeIdForEvent,
} from './error-relationship-graph.mjs';
import { parseMetadata, toOptionalInteger } from './engineering-learning-core.mjs';

export function parseErrorGraphMetadata(body) {
  const match = String(body ?? '').match(/<!-- newax-error-relationship-graph\n([\s\S]*?)\n-->/);
  if (match === null) {
    return {};
  }
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        return separator === -1
          ? [line, '']
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

export function decodeGraphJson(value, fallback) {
  if (typeof value !== 'string' || value.length === 0 || value === 'none') {
    return fallback;
  }
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return fallback;
  }
}

export function engineeringEventFromIssue(issue) {
  const metadata = parseMetadata(issue.body);
  const graphMetadata = parseErrorGraphMetadata(issue.body);
  if (metadata.fingerprint === undefined || metadata['root-cause-id'] === undefined) {
    return null;
  }
  return {
    fingerprint: metadata.fingerprint,
    sourceType: metadata['source-type'] ?? 'unknown',
    sourceId: metadata['source-id'] ?? null,
    repository: null,
    prNumber: toOptionalInteger(metadata['pr-number']),
    commitSha: metadata['commit-sha'] === 'none' ? null : metadata['commit-sha'],
    workflowRunId: toOptionalInteger(metadata['workflow-run-id']),
    workflowName: null,
    jobName: null,
    stepName: metadata['step-name'] === 'none' ? null : metadata['step-name'],
    category: metadata['failure-category'] ?? 'unknown',
    symptom: issue.title,
    rootCauseId: metadata['root-cause-id'],
    rootCauseCandidate: metadata['root-cause-id'],
    rootCauseDeterministic: metadata['root-cause-status'] === 'machine-supported',
    rootCauseAssessment: { observedFacts: [], evidenceFor: [] },
    matchedSignatures:
      metadata['matched-signatures'] === undefined || metadata['matched-signatures'] === 'none'
        ? []
        : metadata['matched-signatures'].split('|').filter(Boolean),
    status: metadata['root-cause-status'] ?? 'candidate',
    relationshipHints: decodeGraphJson(graphMetadata['graph-links'], []),
    impacts: decodeGraphJson(graphMetadata['graph-impacts'], []),
    issueNumber: issue.number,
  };
}

function sameScope(current, candidate) {
  if (current.prNumber !== null && candidate.prNumber === current.prNumber) {
    return true;
  }
  return current.commitSha !== null && candidate.commitSha === current.commitSha;
}

function primaryCommonAncestor(currentNodeId, graph, issueEvents) {
  const counts = new Map();
  const relatedIssues = new Map();
  for (const candidate of issueEvents) {
    const candidateNodeId = occurrenceNodeIdForEvent(candidate);
    const ancestors = findCommonErrorRootAncestors(graph, [currentNodeId, candidateNodeId]);
    for (const ancestorId of ancestors) {
      counts.set(ancestorId, (counts.get(ancestorId) ?? 0) + 1);
      const issues = relatedIssues.get(ancestorId) ?? [];
      issues.push(candidate.issueNumber);
      relatedIssues.set(ancestorId, issues);
    }
  }
  const selected = [...counts.entries()].sort(
    (first, second) => second[1] - first[1] || first[0].localeCompare(second[0]),
  )[0];
  if (selected === undefined) {
    return { ancestorId: null, relatedIssueNumbers: [] };
  }
  return {
    ancestorId: selected[0],
    relatedIssueNumbers: Array.from(new Set(relatedIssues.get(selected[0]) ?? [])).sort(
      (first, second) => first - second,
    ),
  };
}

export function createErrorGraphContext(event, issues) {
  const currentNodeId = occurrenceNodeIdForEvent(event);
  const existingEvents = issues
    .map(engineeringEventFromIssue)
    .filter(Boolean)
    .filter(
      (candidate) => candidate.fingerprint !== event.fingerprint && sameScope(event, candidate),
    );
  const graph = buildErrorRelationshipGraph([...existingEvents, event]);
  const rootAncestorIds = findErrorRootAncestors(graph, currentNodeId).filter(
    (nodeId) => graph.nodes.find((node) => node.id === nodeId)?.kind === 'root-cause',
  );
  const primary = primaryCommonAncestor(currentNodeId, graph, existingEvents);
  const directParentIds = graph.edges
    .filter(
      (edge) =>
        edge.to === currentNodeId &&
        ['causes', 'contributes-to', 'blocks'].includes(edge.type) &&
        ['confirmed', 'machine-supported'].includes(edge.status),
    )
    .map((edge) => edge.from)
    .sort();
  const downstreamNodeIds = graph.nodes
    .map((node) => node.id)
    .filter((nodeId) => nodeId.startsWith(`${currentNodeId}:impact:`))
    .sort();
  const chainTargets = downstreamNodeIds.length === 0 ? [currentNodeId] : downstreamNodeIds;
  const relatedOccurrenceNodeIds = existingEvents
    .filter((candidate) => primary.relatedIssueNumbers.includes(candidate.issueNumber))
    .map(occurrenceNodeIdForEvent);
  const ancestorFocusNodeIds =
    chainTargets.length >= 2 ? chainTargets : [currentNodeId, ...relatedOccurrenceNodeIds];
  const lowestCommonAncestorIds =
    ancestorFocusNodeIds.length < 2
      ? []
      : findLowestCommonErrorAncestors(graph, ancestorFocusNodeIds);
  const chains = rootAncestorIds.flatMap((rootId) =>
    chainTargets.map((targetId) => findErrorPath(graph, rootId, targetId)).filter(Boolean),
  );
  return {
    graph,
    currentNodeId,
    directParentIds,
    downstreamNodeIds,
    lowestCommonAncestorIds,
    rootAncestorIds,
    primaryCommonAncestorId: primary.ancestorId,
    relatedIssueNumbers: primary.relatedIssueNumbers,
    chains,
  };
}
