import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import {
  parseKnowledgeGraphMarker,
  renderKnowledgeGraphSection,
  replaceKnowledgeGraphSection,
} from './knowledge-graph-renderer.mjs';

const graph = buildKnowledgeGraph(
  [
    {
      id: 'req',
      kind: 'requirement',
      label: 'Requirement 1',
      url: 'https://github.com/o/r/issues/1',
      status: 'verified',
    },
    {
      id: 'commit',
      kind: 'commit',
      label: 'abc123',
      url: 'https://github.com/o/r/commit/abc',
      status: 'verified',
    },
  ],
  [
    {
      from: 'req',
      to: 'commit',
      type: 'implemented-by',
      status: 'verified',
      provenance: 'fixture',
    },
  ],
);

test('renders linked history, Mermaid, gaps, and marker', () => {
  const section = renderKnowledgeGraphSection(graph, {
    recordUrl: 'https://github.com/o/r/issues/2',
  });
  assert.match(section, /Open the complete engineering history/);
  assert.match(section, /```mermaid/);
  assert.match(section, /missing-stage:pull-request/);
  assert.match(section, /Requirement 1/);
  assert.match(section, /graph-data:/);
});

test('marker round trips graph content', () => {
  const section = renderKnowledgeGraphSection(graph);
  const parsed = parseKnowledgeGraphMarker(section);
  assert.equal(parsed.metadata['graph-digest'], graph.digest);
  assert.deepEqual(parsed.graph, graph);
});

test('replacement is idempotent', () => {
  const first = replaceKnowledgeGraphSection('Header', renderKnowledgeGraphSection(graph));
  const second = replaceKnowledgeGraphSection(first, renderKnowledgeGraphSection(graph));
  assert.equal((second.match(/## Engineering knowledge graph/g) ?? []).length, 1);
});

test('candidate edges are visible and do not claim completeness', () => {
  const candidate = buildKnowledgeGraph(graph.nodes, [
    {
      from: 'req',
      to: 'commit',
      type: 'implemented-by',
      status: 'candidate',
      provenance: 'fixture',
    },
  ]);
  const section = renderKnowledgeGraphSection(candidate);
  assert.match(section, /History status: `incomplete`/);
  assert.match(section, /Candidate links/);
  assert.match(section, /implemented-by/);
});

test('incomplete overview uses dashed timeline links instead of fictional verified arrows', () => {
  const section = renderKnowledgeGraphSection(graph);
  assert.match(section, /timeline or missing link/);
});

test('rejects marker payloads too large for a durable issue record', () => {
  const oversized = buildKnowledgeGraph(
    Array.from({ length: 80 }, (_, index) => ({
      id: `bug-${index}`,
      kind: 'bug',
      label: `Bug ${index} ${'x'.repeat(900)}`,
      sourceRef: `issue:${index}`,
      metadata: { detail: 'y'.repeat(900) },
    })),
    [],
  );
  assert.throws(() => renderKnowledgeGraphSection(oversized), /marker data exceeds/);
});

test('missing stages cannot inherit a neighboring verified edge in Mermaid', () => {
  const section = renderKnowledgeGraphSection(graph);
  assert.doesNotMatch(section, /n2 --> n3/);
  assert.match(section, /n2 -\. timeline or missing link \.-> n3/);
});
