import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import { analyzeKnowledgeHistory } from './knowledge-graph-traversal.mjs';

function node(id, kind) {
  return { id, kind, label: id, sourceRef: `${kind}:${id}`, status: 'verified' };
}
function edge(from, to, type, status = 'verified') {
  return { from, to, type, status, provenance: 'fixture', evidenceRefs: [`${from}:${to}`] };
}
function fullGraph() {
  const nodes = [
    node('req', 'requirement'),
    node('commit', 'commit'),
    node('pr', 'pull-request'),
    node('review', 'review'),
    node('ci', 'ci-run'),
    node('bug', 'bug'),
    node('root', 'root-cause'),
    node('fix', 'fix'),
    node('verify', 'verification'),
    node('lesson', 'lesson'),
    node('rule', 'rule'),
    node('prevent', 'prevention'),
  ];
  const edges = [
    edge('req', 'commit', 'implemented-by'),
    edge('commit', 'pr', 'included-in'),
    edge('pr', 'review', 'reviewed-by'),
    edge('pr', 'ci', 'validated-by'),
    edge('ci', 'bug', 'revealed'),
    edge('bug', 'root', 'classified-as'),
    edge('root', 'fix', 'resolved-by'),
    edge('fix', 'verify', 'verified-by'),
    edge('verify', 'lesson', 'captured-as'),
    edge('lesson', 'rule', 'materialized-as'),
    edge('rule', 'prevent', 'enforced-by'),
  ];
  return buildKnowledgeGraph(nodes, edges);
}

test('finds the complete ordered history', () => {
  const result = analyzeKnowledgeHistory(fullGraph(), 'bug');
  assert.equal(result.complete, true);
  assert.deepEqual(
    result.chain.map((node) => node.kind),
    [
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
    ],
  );
  assert.deepEqual(result.gaps, []);
});

test('missing review stays incomplete', () => {
  const graph = fullGraph();
  const reduced = buildKnowledgeGraph(
    graph.nodes.filter((item) => item.kind !== 'review'),
    graph.edges.filter((item) => item.from !== 'review' && item.to !== 'review'),
  );
  const result = analyzeKnowledgeHistory(reduced);
  assert.equal(result.complete, false);
  assert.ok(result.gaps.includes('missing-stage:review'));
});

test('candidate root cause does not satisfy completeness', () => {
  const graph = fullGraph();
  const edges = graph.edges.map((item) =>
    item.type === 'classified-as' ? { ...item, status: 'candidate', id: undefined } : item,
  );
  const result = analyzeKnowledgeHistory(buildKnowledgeGraph(graph.nodes, edges));
  assert.equal(result.complete, false);
  assert.equal(result.candidateEdges.length, 1);
  assert.ok(result.gaps.includes('missing-verified-edge:bug-to-root-cause'));
});

test('fix without verification reports the missing stage', () => {
  const graph = fullGraph();
  const reduced = buildKnowledgeGraph(
    graph.nodes.filter((item) => item.kind !== 'verification'),
    graph.edges.filter((item) => item.from !== 'verify' && item.to !== 'verify'),
  );
  assert.ok(analyzeKnowledgeHistory(reduced).gaps.includes('missing-stage:verification'));
});

test('lesson without rule reports the missing stage', () => {
  const graph = fullGraph();
  const reduced = buildKnowledgeGraph(
    graph.nodes.filter((item) => item.kind !== 'rule'),
    graph.edges.filter((item) => item.from !== 'rule' && item.to !== 'rule'),
  );
  assert.ok(analyzeKnowledgeHistory(reduced).gaps.includes('missing-stage:rule'));
});

test('rule without prevention reports the missing stage', () => {
  const graph = fullGraph();
  const reduced = buildKnowledgeGraph(
    graph.nodes.filter((item) => item.kind !== 'prevention'),
    graph.edges.filter((item) => item.to !== 'prevent'),
  );
  assert.ok(analyzeKnowledgeHistory(reduced).gaps.includes('missing-stage:prevention'));
});

test('focus node limits analysis to its connected component', () => {
  const graph = fullGraph();
  const combined = buildKnowledgeGraph([...graph.nodes, node('other', 'bug')], graph.edges);
  const result = analyzeKnowledgeHistory(combined, 'other');
  assert.equal(result.connectedNodeCount, 1);
  assert.equal(result.complete, false);
  assert.equal(result.chain.length, 1);
});

test('additional connected nodes are exposed as branches', () => {
  const graph = fullGraph();
  const combined = buildKnowledgeGraph(
    [...graph.nodes, node('review-2', 'review')],
    [...graph.edges, edge('pr', 'review-2', 'reviewed-by')],
  );
  const result = analyzeKnowledgeHistory(combined);
  assert.ok(result.branches.some((item) => item.id === 'review-2'));
});

test('fragmented verified stages report the missing canonical edge', () => {
  const graph = fullGraph();
  const fragmented = buildKnowledgeGraph(
    graph.nodes,
    graph.edges
      .map((item) =>
        item.type === 'included-in' ? edge('commit', 'pr', 'included-in', 'candidate') : item,
      )
      .concat(edge('commit', 'pr', 'references')),
  );
  const result = analyzeKnowledgeHistory(fragmented);
  assert.equal(result.complete, false);
  assert.ok(result.gaps.includes('missing-verified-edge:commit-to-pull-request'));
});

test('incomplete primary timeline nodes are not repeated as branches', () => {
  const graph = fullGraph();
  const reduced = buildKnowledgeGraph(
    graph.nodes.filter((item) => item.kind !== 'review'),
    graph.edges.filter((item) => item.from !== 'review' && item.to !== 'review'),
  );
  const result = analyzeKnowledgeHistory(reduced);
  assert.equal(result.branches.length, 0);
});
