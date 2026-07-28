import {
  causeNodeIdForRootCause,
  cleanGraphArray,
  cleanGraphText,
  impactNodeIdForEvent,
  normalizeErrorImpacts,
  normalizeGraphEdgeType,
  normalizeGraphStatus,
  normalizeRelationshipHints,
  occurrenceNodeIdForEvent,
} from './error-graph-normalization.mjs';
import {
  addObservedErrorImpact,
  errorGraphEdgeKey,
  errorGraphEventContext,
  errorGraphEventStatus,
  mergeGraphEdge,
  mergeGraphNode,
  resolveErrorGraphParentNodeId,
  validateErrorGraphCausalCycles,
} from './error-graph-model-support.mjs';

export function buildErrorRelationshipGraph(eventValues, options = {}) {
  if (!Array.isArray(eventValues)) {
    throw new TypeError('Error relationship graph input must be an array of engineering events.');
  }
  const nodes = new Map();
  const edges = new Map();
  const normalizedEvents = eventValues.map((event) => {
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      throw new TypeError('Every graph event must be an object.');
    }
    return {
      ...event,
      relationshipHints: normalizeRelationshipHints(event.relationshipHints ?? event.relationships),
      impacts: normalizeErrorImpacts(event.impacts),
    };
  });

  function addNode(node) {
    nodes.set(node.id, mergeGraphNode(nodes.get(node.id), node));
  }
  function addEdge(edge) {
    edges.set(errorGraphEdgeKey(edge), mergeGraphEdge(edges.get(errorGraphEdgeKey(edge)), edge));
  }

  for (const event of normalizedEvents) {
    const occurrenceId = occurrenceNodeIdForEvent(event);
    const causeId = causeNodeIdForRootCause(event.rootCauseId ?? 'ROOT-UNCLASSIFIED-UNKNOWN');
    const status = errorGraphEventStatus(event, normalizeGraphStatus);
    const context = errorGraphEventContext(event);
    addNode({
      id: causeId,
      kind: 'root-cause',
      label: cleanGraphText(
        event.rootCauseCandidate ?? event.rootCauseId,
        'rootCauseCandidate',
        1_000,
      ),
      rootCauseId: event.rootCauseId ?? 'ROOT-UNCLASSIFIED-UNKNOWN',
      category: event.category ?? 'unknown',
      status,
      evidence: event.matchedSignatures ?? [],
      context: null,
    });
    addNode({
      id: occurrenceId,
      kind: 'occurrence',
      label: cleanGraphText(event.symptom ?? event.stepName ?? event.fingerprint, 'symptom', 1_000),
      fingerprint: event.fingerprint,
      rootCauseId: event.rootCauseId ?? 'ROOT-UNCLASSIFIED-UNKNOWN',
      category: event.category ?? 'unknown',
      status,
      evidence: event.rootCauseAssessment?.observedFacts ?? [],
      context,
    });
    addEdge({
      from: causeId,
      to: occurrenceId,
      type: 'causes',
      status,
      evidence:
        event.rootCauseAssessment?.evidenceFor?.length > 0
          ? event.rootCauseAssessment.evidenceFor
          : ['The occurrence carries this root-cause classification.'],
      source: 'classification',
    });

    for (const hint of event.relationshipHints) {
      const parentId = resolveErrorGraphParentNodeId(hint);
      if (!nodes.has(parentId)) {
        addNode({
          id: parentId,
          kind: hint.referenceType === 'parentRootCauseId' ? 'root-cause' : 'occurrence-reference',
          label: `Referenced upstream node ${hint.referenceValue}`,
          rootCauseId: hint.referenceType === 'parentRootCauseId' ? hint.referenceValue : null,
          category: 'unknown',
          status: hint.status,
          evidence: hint.evidence,
          context: null,
        });
      }
      addEdge({
        from: parentId,
        to: hint.referenceType === 'parentRootCauseId' ? causeId : occurrenceId,
        type: hint.type,
        status: hint.status,
        evidence: hint.evidence,
        source: 'explicit-relationship',
      });
    }

    const impacts = addObservedErrorImpact(event.impacts, event);
    for (const impact of impacts) {
      const impactId = impactNodeIdForEvent(event, impact.id);
      const parentId =
        impact.parentImpactId === null
          ? occurrenceId
          : impactNodeIdForEvent(event, impact.parentImpactId);
      addNode({
        id: impactId,
        kind: impact.kind,
        label: impact.label,
        status: impact.status,
        evidence: impact.evidence,
        context,
      });
      addEdge({
        from: parentId,
        to: impactId,
        type: impact.type,
        status: impact.status,
        evidence: impact.evidence,
        source: 'observed-impact',
      });
    }
  }

  for (const edge of options.explicitEdges ?? []) {
    if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) {
      throw new TypeError('Every explicit graph edge must be an object.');
    }
    addEdge({
      from: cleanGraphText(edge.from, 'explicit edge from', 1_000),
      to: cleanGraphText(edge.to, 'explicit edge to', 1_000),
      type: normalizeGraphEdgeType(edge.type),
      status: normalizeGraphStatus(edge.status),
      evidence: cleanGraphArray(edge.evidence, 'explicit edge evidence'),
      source: 'explicit-edge',
    });
  }

  for (const edge of edges.values()) {
    if (!nodes.has(edge.from)) {
      throw new TypeError(`Error relationship edge references missing parent node: ${edge.from}.`);
    }
    if (!nodes.has(edge.to)) {
      throw new TypeError(`Error relationship edge references missing child node: ${edge.to}.`);
    }
  }
  validateErrorGraphCausalCycles(nodes, edges);
  return {
    version: 1,
    nodes: [...nodes.values()].sort((first, second) => first.id.localeCompare(second.id)),
    edges: [...edges.values()].sort((first, second) =>
      errorGraphEdgeKey(first).localeCompare(errorGraphEdgeKey(second)),
    ),
  };
}
