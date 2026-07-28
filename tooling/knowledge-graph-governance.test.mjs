import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import {
  renderKnowledgeGraphInputRecord,
  collectKnowledgeGraphRecord,
} from './knowledge-graph-record.mjs';
import { renderKnowledgeGraphSection } from './knowledge-graph-renderer.mjs';
import {
  knowledgeGraphGovernanceErrors,
  knowledgeReferenceErrors,
} from './verify-pr-knowledge-graph.mjs';

function recordForIssue(issueNumber = 10) {
  const nodes = [
    {
      id: `bug:issue:${issueNumber}`,
      kind: 'bug',
      label: `Issue ${issueNumber}`,
      url: `https://github.com/newax/core/issues/${issueNumber}`,
      status: 'open',
      metadata: { issueNumber },
    },
  ];
  const graph = buildKnowledgeGraph(nodes, []);
  return collectKnowledgeGraphRecord(
    { body: renderKnowledgeGraphInputRecord({ recordId: 'KG-1', nodes, edges: [] }) },
    [{ body: renderKnowledgeGraphSection(graph) }],
  );
}

test('draft without findings does not require a record', () => {
  assert.deepEqual(knowledgeGraphGovernanceErrors({ pullRequest: { draft: true, body: '' } }), []);
});

test('review-ready finding-bearing pull request requires a record', () => {
  const errors = knowledgeGraphGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10`\n- Knowledge graph records: `not-required`',
    },
  });
  assert.match(errors.join('\n'), /requires a knowledge graph record/);
});

test('valid record with finding coverage passes', () => {
  const errors = knowledgeGraphGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10`\n- Knowledge graph records: `#20`',
    },
    records: [recordForIssue(10)],
    repository: 'newax/core',
  });
  assert.deepEqual(errors, []);
});

test('missing linked issue coverage is reported', () => {
  const errors = knowledgeGraphGovernanceErrors({
    pullRequest: {
      draft: false,
      body: '- Learning issues: `#10, #11`\n- Knowledge graph records: `#20`',
    },
    records: [recordForIssue(10)],
    repository: 'newax/core',
  });
  assert.match(errors.join('\n'), /#11 is not represented/);
});

test('unsupported source reference is reported', () => {
  const graph = buildKnowledgeGraph(
    [{ id: 'x', kind: 'bug', label: 'x', sourceRef: 'mystery-value' }],
    [],
  );
  assert.match(knowledgeReferenceErrors(graph, 'newax/core').join('\n'), /sourceRef/);
});

test('URL from another repository is reported', () => {
  const graph = buildKnowledgeGraph(
    [{ id: 'x', kind: 'bug', label: 'x', url: 'https://github.com/other/repo/issues/1' }],
    [],
  );
  assert.match(knowledgeReferenceErrors(graph, 'newax/core').join('\n'), /does not belong/);
});

test('record validation errors propagate through governance', () => {
  const record = recordForIssue(10);
  record.renderedRecord.graph.digest = 'bad';
  const errors = knowledgeGraphGovernanceErrors({
    pullRequest: { draft: true, body: '' },
    records: [record],
    repository: 'newax/core',
  });
  assert.match(errors.join('\n'), /digest/);
});
