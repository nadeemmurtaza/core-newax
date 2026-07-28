import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnowledgeGraph, validateKnowledgeGraph } from './knowledge-graph.mjs';

function node(id, kind, overrides = {}) {
  return {
    id,
    kind,
    label: id,
    sourceRef: `${kind}:${id}`,
    status: 'verified',
    evidenceRefs: [`evidence:${id}`],
    ...overrides,
  };
}

function edge(from, to, type, overrides = {}) {
  return {
    from,
    to,
    type,
    status: 'verified',
    provenance: 'test-fixture',
    evidenceRefs: [`${from}->${to}`],
    ...overrides,
  };
}

const fullNodes = [
  node('req', 'requirement'),
  node('commit', 'commit'),
  node('pr', 'pull-request'),
  node('review', 'review'),
  node('ci', 'ci-run'),
  node('bug', 'bug'),
  node('root', 'root-cause'),
  node('fix', 'fix'),
  node('verification', 'verification'),
  node('lesson', 'lesson'),
  node('rule', 'rule'),
  node('prevention', 'prevention'),
];
const fullEdges = [
  edge('req', 'commit', 'implemented-by'),
  edge('commit', 'pr', 'included-in'),
  edge('pr', 'review', 'reviewed-by'),
  edge('pr', 'ci', 'validated-by'),
  edge('ci', 'bug', 'revealed'),
  edge('bug', 'root', 'classified-as'),
  edge('root', 'fix', 'resolved-by'),
  edge('fix', 'verification', 'verified-by'),
  edge('verification', 'lesson', 'captured-as'),
  edge('lesson', 'rule', 'materialized-as'),
  edge('rule', 'prevention', 'enforced-by'),
];

test('builds a deterministic full graph', () => {
  const first = buildKnowledgeGraph(fullNodes, fullEdges, { source: 'test' });
  const second = buildKnowledgeGraph([...fullNodes].reverse(), [...fullEdges].reverse(), {
    source: 'test',
  });
  assert.deepEqual(first, second);
  assert.equal(first.nodes.length, 12);
  assert.equal(first.edges.length, 11);
  assert.match(first.digest, /^[a-f0-9]{64}$/);
});

test('candidate links remain present', () => {
  const graph = buildKnowledgeGraph(fullNodes, [
    ...fullEdges.slice(0, 5),
    edge('bug', 'root', 'classified-as', { status: 'candidate' }),
  ]);
  assert.equal(graph.edges.find((item) => item.type === 'classified-as').status, 'candidate');
});

test('rejects illegal stage jumps', () => {
  assert.throws(
    () =>
      buildKnowledgeGraph(
        [node('req', 'requirement'), node('pr', 'pull-request')],
        [edge('req', 'pr', 'implemented-by')],
      ),
    /Illegal knowledge transition/,
  );
});

test('rejects missing endpoints', () => {
  assert.throws(
    () =>
      buildKnowledgeGraph([node('req', 'requirement')], [edge('req', 'commit', 'implemented-by')]),
    /missing target/,
  );
});

test('rejects self links', () => {
  assert.throws(
    () => buildKnowledgeGraph([node('req', 'requirement')], [edge('req', 'req', 'references')]),
    /self-link/,
  );
});

test('rejects duplicate node IDs with incompatible identity', () => {
  assert.throws(
    () => buildKnowledgeGraph([node('same', 'requirement'), node('same', 'commit')], []),
    /incompatible kind/,
  );
});

test('rejects verified causal cycles through cross-stage blocking', () => {
  assert.throws(
    () =>
      buildKnowledgeGraph(
        [node('a', 'requirement'), node('b', 'commit')],
        [edge('a', 'b', 'implemented-by'), edge('b', 'a', 'blocks')],
      ),
    /cycle/,
  );
});

test('allows non-causal reference cycles', () => {
  const graph = buildKnowledgeGraph(
    [node('a', 'requirement'), node('b', 'commit')],
    [edge('a', 'b', 'references'), edge('b', 'a', 'relates-to')],
  );
  assert.equal(graph.edges.length, 2);
});

test('requires durable URL or source reference', () => {
  assert.throws(
    () => buildKnowledgeGraph([{ id: 'x', kind: 'bug', label: 'x' }], []),
    /durable url or sourceRef/,
  );
});

test('rejects insecure URLs', () => {
  assert.throws(
    () =>
      buildKnowledgeGraph([node('x', 'bug', { sourceRef: null, url: 'http://example.com' })], []),
    /must use https/,
  );
});

test('detects digest tampering', () => {
  const graph = buildKnowledgeGraph(fullNodes, fullEdges);
  assert.match(validateKnowledgeGraph({ ...graph, digest: 'bad' }).errors.join('\n'), /digest/);
});

test('detects schema tampering', () => {
  const graph = buildKnowledgeGraph(fullNodes, fullEdges);
  assert.match(
    validateKnowledgeGraph({ ...graph, schemaVersion: 2 }).errors.join('\n'),
    /schemaVersion/,
  );
});

test('bounds graph source metadata', () => {
  assert.throws(
    () =>
      buildKnowledgeGraph([node('x', 'bug')], [], {
        source: { a: { b: { c: { d: 'too deep' } } } },
      }),
    /depth limit/,
  );
});

test('allows same-kind supersession when node IDs differ', () => {
  const graph = buildKnowledgeGraph(
    [node('rule-a', 'rule'), node('rule-b', 'rule')],
    [edge('rule-a', 'rule-b', 'supersedes')],
  );
  assert.equal(graph.edges[0].type, 'supersedes');
});

test('merges a node URL and source reference supplied by separate evidence', () => {
  const graph = buildKnowledgeGraph(
    [
      node('bug-x', 'bug', { url: 'https://github.com/o/r/issues/1', sourceRef: null }),
      node('bug-x', 'bug', { url: null, sourceRef: 'issue:1' }),
    ],
    [],
  );
  assert.equal(graph.nodes[0].url, 'https://github.com/o/r/issues/1');
  assert.equal(graph.nodes[0].sourceRef, 'issue:1');
});

test('duplicate edge provenance merges deterministically regardless of input order', () => {
  const nodes = [node('req-x', 'requirement'), node('commit-x', 'commit')];
  const first = edge('req-x', 'commit-x', 'implemented-by', {
    provenance: 'z-source',
    evidenceRefs: ['z'],
  });
  const second = edge('req-x', 'commit-x', 'implemented-by', {
    provenance: 'a-source',
    evidenceRefs: ['a'],
  });
  assert.deepEqual(
    buildKnowledgeGraph(nodes, [first, second]),
    buildKnowledgeGraph(nodes, [second, first]),
  );
});

test('rejects excessive graph cardinality', () => {
  const nodes = Array.from({ length: 251 }, (_, index) => node(`bug-${index}`, 'bug'));
  assert.throws(() => buildKnowledgeGraph(nodes, []), /exceeds 250 nodes/);
});

test('validation returns bounded errors for malformed rendered content', () => {
  const result = validateKnowledgeGraph({
    schemaVersion: 1,
    digest: 'bad',
    nodes: [node('req-only', 'requirement')],
    edges: [edge('req-only', 'missing', 'implemented-by')],
  });
  assert.equal(result.graph, null);
  assert.match(result.errors.join('\n'), /missing target/);
});
