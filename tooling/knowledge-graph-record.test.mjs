import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import {
  collectKnowledgeGraphRecord,
  parseKnowledgeGraphInputRecords,
  renderKnowledgeGraphInputRecord,
  validateKnowledgeGraphRecord,
} from './knowledge-graph-record.mjs';
import { renderKnowledgeGraphSection } from './knowledge-graph-renderer.mjs';

const nodes = [
  { id: 'req', kind: 'requirement', label: 'REQ-1', sourceRef: 'issue:1' },
  { id: 'commit', kind: 'commit', label: 'abc', sourceRef: 'commit:abc' },
];
const edges = [
  { from: 'req', to: 'commit', type: 'implemented-by', status: 'verified', provenance: 'fixture' },
];

test('structured input and rendered graph validate together', () => {
  const input = renderKnowledgeGraphInputRecord({ recordId: 'KG-1', nodes, edges });
  const graph = buildKnowledgeGraph(nodes, edges);
  const record = collectKnowledgeGraphRecord({ body: input }, [
    { body: renderKnowledgeGraphSection(graph) },
  ]);
  assert.deepEqual(validateKnowledgeGraphRecord(record), []);
});

test('issue-form JSON is parsed without a computed graph', () => {
  const body = `### Record ID\nKG-2\n\n### Focus node ID\nreq\n\n### Source reference\npr:2\n\n### Knowledge graph input JSON\n\n\`\`\`json\n${JSON.stringify({ nodes, edges })}\n\`\`\``;
  const [record] = parseKnowledgeGraphInputRecords(body);
  assert.equal(record.recordId, 'KG-2');
  assert.equal(record.focusNodeId, 'req');
});

test('tampered rendered digest fails', () => {
  const input = renderKnowledgeGraphInputRecord({ recordId: 'KG-3', nodes, edges });
  const graph = buildKnowledgeGraph(nodes, edges);
  const section = renderKnowledgeGraphSection({ ...graph, digest: 'bad' });
  const record = collectKnowledgeGraphRecord({ body: input }, [{ body: section }]);
  assert.match(validateKnowledgeGraphRecord(record).join('\n'), /digest/);
});

test('missing rendered section fails', () => {
  const input = renderKnowledgeGraphInputRecord({ recordId: 'KG-4', nodes, edges });
  const record = collectKnowledgeGraphRecord({ body: input }, []);
  assert.match(
    validateKnowledgeGraphRecord(record).join('\n'),
    /Rendered knowledge graph section is missing/,
  );
});

test('issue-form parser preserves structured source metadata', () => {
  const source = { type: 'github-pull-request', repository: 'o/r', prNumber: 2 };
  const body = `### Record ID\nKG-5\n\n### Source reference\npr:2\n\n### Knowledge graph input JSON\n\n\`\`\`json\n${JSON.stringify({ source, nodes, edges })}\n\`\`\``;
  const [record] = parseKnowledgeGraphInputRecords(body);
  assert.deepEqual(record.source, source);
});

test('canonical issue rendering does not link back to itself', async () => {
  const { attachKnowledgeGraphToIssue } = await import('./engineering-issue-knowledge-graph.mjs');
  const graph = buildKnowledgeGraph(nodes, edges);
  let patchedBody = '';
  const request = async (path, options = {}) => {
    if (options.method === 'PATCH') {
      patchedBody = JSON.parse(options.body).body;
      return {};
    }
    return { number: 7, html_url: 'https://github.com/o/r/issues/7', body: 'Header' };
  };
  await attachKnowledgeGraphToIssue(7, graph, { request });
  assert.match(patchedBody, /This issue is the canonical complete-history view/);
  assert.doesNotMatch(patchedBody, /Open the complete engineering history/);
});

test('record link insertion is idempotent for pull requests and issues', async () => {
  const { replaceKnowledgeGraphLink } = await import('./engineering-issue-knowledge-graph.mjs');
  const first = replaceKnowledgeGraphLink('Header', 9, 'https://github.com/o/r/issues/9');
  const second = replaceKnowledgeGraphLink(first, 9, 'https://github.com/o/r/issues/9');
  assert.equal((second.match(/Complete engineering history/g) ?? []).length, 1);
});
