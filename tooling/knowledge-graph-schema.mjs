export const KNOWLEDGE_GRAPH_SCHEMA_VERSION = 1;
export const KNOWLEDGE_GRAPH_MAX_NODES = 250;
export const KNOWLEDGE_GRAPH_MAX_EDGES = 500;
export const KNOWLEDGE_GRAPH_MAX_MARKER_DATA_LENGTH = 45_000;

export const KNOWLEDGE_GRAPH_NODE_TYPES = Object.freeze([
  'requirement',
  'commit',
  'pull-request',
  'review',
  'ci-run',
  'bug',
  'root-cause',
  'fix',
  'verification',
  'lesson',
  'rule',
  'prevention',
]);

export const KNOWLEDGE_GRAPH_NODE_ORDER = Object.freeze(
  Object.fromEntries(KNOWLEDGE_GRAPH_NODE_TYPES.map((type, index) => [type, index])),
);

export const KNOWLEDGE_GRAPH_EDGE_STATUSES = Object.freeze(['candidate', 'verified']);

export const KNOWLEDGE_GRAPH_CANONICAL_EDGE_TYPES = Object.freeze([
  'implemented-by',
  'included-in',
  'reviewed-by',
  'validated-by',
  'revealed',
  'classified-as',
  'resolved-by',
  'verified-by',
  'captured-as',
  'materialized-as',
  'enforced-by',
]);

export const KNOWLEDGE_GRAPH_REFERENCE_EDGE_TYPES = Object.freeze([
  'references',
  'supersedes',
  'blocks',
  'relates-to',
]);

export const KNOWLEDGE_GRAPH_EDGE_TYPES = Object.freeze([
  ...KNOWLEDGE_GRAPH_CANONICAL_EDGE_TYPES,
  ...KNOWLEDGE_GRAPH_REFERENCE_EDGE_TYPES,
]);

export const KNOWLEDGE_GRAPH_ALLOWED_TRANSITIONS = Object.freeze({
  'implemented-by': Object.freeze([['requirement', 'commit']]),
  'included-in': Object.freeze([['commit', 'pull-request']]),
  'reviewed-by': Object.freeze([['pull-request', 'review']]),
  'validated-by': Object.freeze([
    ['pull-request', 'ci-run'],
    ['commit', 'ci-run'],
  ]),
  revealed: Object.freeze([
    ['ci-run', 'bug'],
    ['review', 'bug'],
  ]),
  'classified-as': Object.freeze([['bug', 'root-cause']]),
  'resolved-by': Object.freeze([
    ['bug', 'fix'],
    ['root-cause', 'fix'],
  ]),
  'verified-by': Object.freeze([['fix', 'verification']]),
  'captured-as': Object.freeze([
    ['verification', 'lesson'],
    ['root-cause', 'lesson'],
  ]),
  'materialized-as': Object.freeze([['lesson', 'rule']]),
  'enforced-by': Object.freeze([['rule', 'prevention']]),
});

export const KNOWLEDGE_GRAPH_CAUSAL_EDGE_TYPES = Object.freeze(
  KNOWLEDGE_GRAPH_EDGE_TYPES.filter((type) => !['references', 'relates-to'].includes(type)),
);

export function isCanonicalKnowledgeEdge(type) {
  return KNOWLEDGE_GRAPH_CANONICAL_EDGE_TYPES.includes(type);
}

export function isAllowedKnowledgeTransition(type, fromKind, toKind) {
  if (KNOWLEDGE_GRAPH_REFERENCE_EDGE_TYPES.includes(type)) {
    return true;
  }
  return (KNOWLEDGE_GRAPH_ALLOWED_TRANSITIONS[type] ?? []).some(
    ([allowedFrom, allowedTo]) => allowedFrom === fromKind && allowedTo === toKind,
  );
}
