import assert from 'node:assert/strict';
import test from 'node:test';

import { collectKnowledgeGraphForPullRequest } from './knowledge-graph-github.mjs';
import { analyzeKnowledgeHistory } from './knowledge-graph-traversal.mjs';

const repository = 'newax/core';
const pr = {
  number: 12,
  title: 'Build feature',
  state: 'open',
  draft: true,
  merged: false,
  created_at: '2026-07-17T00:00:00Z',
  html_url: 'https://github.com/newax/core/pull/12',
  body: '- Planning issues: `#20`\n- Learning issues: `#21`',
  base: { ref: 'base' },
  head: { ref: 'head', sha: 'a'.repeat(40) },
};
const routes = new Map([
  ['/pulls/12', pr],
  [
    '/issues/20',
    {
      number: 20,
      title: 'Plan',
      state: 'open',
      created_at: '2026-07-16T00:00:00Z',
      html_url: 'https://github.com/newax/core/issues/20',
      body: '- [ ] REQ-1 Build it',
    },
  ],
  [
    '/issues/21',
    {
      number: 21,
      title: 'Finding',
      state: 'open',
      created_at: '2026-07-17T01:00:00Z',
      html_url: 'https://github.com/newax/core/issues/21',
      body: `<!-- newax-engineering-event\nfingerprint: f1\nworkflow-run-id: 30\nroot-cause-id: ROOT-X\nroot-cause-status: confirmed\n-->\n- Fix commit: ${'b'.repeat(40)}\n- Resolution status: unverified\n- Successful verification: pending\n- Ledger entry: EL-1\n- Prevention control: Add a rule`,
    },
  ],
]);
const lists = new Map([
  [
    '/pulls/12/commits',
    [
      {
        sha: 'a'.repeat(40),
        html_url: `https://github.com/newax/core/commit/${'a'.repeat(40)}`,
        commit: { message: 'Implement', committer: { date: '2026-07-17T00:10:00Z' } },
      },
    ],
  ],
  [
    '/pulls/12/reviews',
    [
      {
        id: 40,
        state: 'COMMENTED',
        submitted_at: '2026-07-17T00:20:00Z',
        html_url: 'https://github.com/newax/core/pull/12#pullrequestreview-40',
        user: { login: 'reviewer' },
      },
    ],
  ],
  ['/pulls/12/comments', []],
  ['/issues/12/comments', []],
  [
    '/actions/runs?event=pull_request&head_sha=' + 'a'.repeat(40),
    [
      {
        id: 30,
        name: 'CI',
        run_number: 1,
        conclusion: 'cancelled',
        created_at: '2026-07-17T00:30:00Z',
        html_url: 'https://github.com/newax/core/actions/runs/30',
        head_sha: 'a'.repeat(40),
      },
    ],
  ],
  [
    '/issues/20/comments',
    [
      {
        id: 1,
        body: `<!-- newax-knowledge-link\nfrom: requirement:20:REQ-1\nto: commit:${'a'.repeat(40)}\ntype: implemented-by\nstatus: verified\nprovenance: approved task-to-commit record\nevidence-refs: issue:20,commit:${'a'.repeat(40)}\n-->`,
      },
    ],
  ],
  ['/issues/21/comments', []],
  ['/actions/runs/30/jobs', [{ id: 31, name: 'Verify', conclusion: 'cancelled' }]],
]);

async function request(path) {
  if (!routes.has(path)) {
    throw new Error(`missing route ${path}`);
  }
  return routes.get(path);
}
async function listAll(path) {
  if (!lists.has(path)) {
    throw new Error(`missing list ${path}`);
  }
  return lists.get(path);
}

const catalog = {
  rootCauses: [{ id: 'ROOT-X', rootCause: 'Cause X', ledgerEntry: 'EL-1', signatures: ['sig'] }],
};

test('collects only exact GitHub and structured links', async () => {
  const graph = await collectKnowledgeGraphForPullRequest(12, {
    repository,
    request,
    listAll,
    catalog,
  });
  assert.ok(graph.nodes.some((node) => node.kind === 'requirement'));
  assert.ok(graph.nodes.some((node) => node.kind === 'review'));
  assert.ok(graph.nodes.some((node) => node.kind === 'ci-run'));
  assert.ok(graph.nodes.some((node) => node.kind === 'bug'));
  assert.ok(
    graph.edges.some((edge) => edge.type === 'implemented-by' && edge.status === 'verified'),
  );
  assert.ok(graph.edges.some((edge) => edge.type === 'revealed' && edge.status === 'verified'));
});

test('pre-step workflow remains a CI node without fabricated verification', async () => {
  const graph = await collectKnowledgeGraphForPullRequest(12, {
    repository,
    request,
    listAll,
    catalog,
  });
  const ci = graph.nodes.find((node) => node.kind === 'ci-run');
  assert.equal(ci.status, 'cancelled');
  assert.equal(
    graph.nodes.some((node) => node.kind === 'verification' && node.status === 'verified'),
    false,
  );
});

test('open unresolved learning issue keeps later lifecycle candidate', async () => {
  const graph = await collectKnowledgeGraphForPullRequest(12, {
    repository,
    request,
    listAll,
    catalog,
  });
  assert.equal(graph.edges.find((edge) => edge.type === 'resolved-by').status, 'candidate');
  assert.equal(graph.edges.find((edge) => edge.type === 'materialized-as').status, 'candidate');
  assert.equal(analyzeKnowledgeHistory(graph).complete, false);
});

test('does not infer requirement-to-commit without explicit marker', async () => {
  const withoutLink = new Map(lists);
  withoutLink.set('/issues/20/comments', []);
  const graph = await collectKnowledgeGraphForPullRequest(12, {
    repository,
    request,
    listAll: async (path) => withoutLink.get(path) ?? listAll(path),
    catalog,
  });
  assert.equal(
    graph.edges.some((edge) => edge.type === 'implemented-by'),
    false,
  );
});

test('ledger references do not invent file URLs and follow verification when present', async () => {
  const graph = await collectKnowledgeGraphForPullRequest(12, {
    repository,
    request,
    listAll,
    catalog,
  });
  const lesson = graph.nodes.find((node) => node.kind === 'lesson');
  assert.equal(lesson.url, null);
  assert.equal(lesson.sourceRef, 'ledger:EL-1');
  const captured = graph.edges.find((edge) => edge.type === 'captured-as');
  assert.match(captured.from, /^verification:/);
  assert.equal(captured.status, 'candidate');
});
