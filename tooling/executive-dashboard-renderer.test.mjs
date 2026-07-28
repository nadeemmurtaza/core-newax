import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutiveDashboard } from './executive-dashboard.mjs';
import {
  renderExecutiveDashboardHtml,
  renderExecutiveDashboardMarkdown,
} from './executive-dashboard-renderer.mjs';

function input() {
  return {
    snapshotAt: '2026-07-18T00:00:00Z',
    windowStart: '2026-07-01T00:00:00Z',
    windowEnd: '2026-07-18T00:00:00Z',
    period: 'week',
    occurrences: [
      {
        id: 'o1',
        rootCauseId: 'ROOT-X',
        category: 'planning',
        status: 'confirmed',
        occurredAt: '2026-07-02T00:00:00Z',
        sourceId: 'o1',
        sourceRefs: ['issue:1'],
      },
      {
        id: 'o2',
        rootCauseId: 'ROOT-X',
        category: 'planning',
        status: 'confirmed',
        occurredAt: '2026-07-10T00:00:00Z',
        sourceId: 'o2',
        sourceRefs: ['issue:2'],
      },
    ],
  };
}

test('renders requested sections in self-contained HTML', () => {
  const html = renderExecutiveDashboardHtml(buildExecutiveDashboard(input()));
  for (const heading of [
    'Top recurring root causes',
    'Most expensive categories',
    'Time lost by category',
    'Prevention effectiveness',
    'Rules frequently ignored',
    'Engineering quality trend',
    'AI accuracy trend',
    'Human review effectiveness',
  ]) {
    assert.match(html, new RegExp(heading));
  }
  assert.match(html, /<!doctype html>/i);
  assert.doesNotMatch(html, /https:\/\/.*\.js/);
});

test('escapes source-controlled labels', () => {
  const value = input();
  value.occurrences = [
    { ...value.occurrences[0], id: 'x', rootCauseId: '<b>x</b>' },
    { ...value.occurrences[1], id: 'y', rootCauseId: '<b>x</b>' },
  ];
  const html = renderExecutiveDashboardHtml(buildExecutiveDashboard(value));
  assert.doesNotMatch(html, /<b>x/);
  assert.match(html, /&lt;b&gt;/);
});

test('markdown preserves coverage gaps and digest', () => {
  const markdown = renderExecutiveDashboardMarkdown(buildExecutiveDashboard(input()));
  assert.match(markdown, /Most expensive categories: insufficient evidence/);
  assert.match(markdown, /Snapshot digest/);
});
