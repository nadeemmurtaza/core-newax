import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectCommunicationMistakes,
  pathMatchesCommunicationScope,
} from './communication-mistake-detector.mjs';

function event(id, type, topic, extra = {}) {
  return {
    id,
    type,
    topic,
    authority: 'reviewer',
    status: 'active',
    at: '2026-01-01T09:00:00Z',
    appliesTo: ['src'],
    ...extra,
  };
}

function commit(sha = 'a', at = '2026-01-01T10:00:00Z', files = ['src/a.ts']) {
  return { sha, timestamp: at, files: files.map((filename) => ({ filename })) };
}

function finding(result, type) {
  return result.findings.find((candidate) => candidate.type === type);
}

test('matches exact, prefix, and wildcard communication scopes', () => {
  assert.equal(pathMatchesCommunicationScope('src/a.ts', ['src']), true);
  assert.equal(pathMatchesCommunicationScope('apps/api/src/a.ts', ['apps/**/src/*.ts']), true);
  assert.equal(pathMatchesCommunicationScope('docs/a.md', ['src']), false);
});

test('detects requirement misunderstanding from authoritative pre-work evidence', () => {
  const result = detectCommunicationMistakes({
    phase: 'review',
    commits: [commit()],
    events: [
      event('REQ', 'requirement', 'auth-mode', { value: 'session', authority: 'owner' }),
      event('INT', 'interpretation', 'auth-mode', { value: 'token', authority: 'implementer' }),
    ],
  });
  assert.equal(finding(result, 'requirement-misunderstood').state, 'detected');
  assert.equal(result.status, 'detected');
});

test('detects wrong interpretation against an authoritative decision', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('DEC', 'decision', 'storage', {
        value: 'postgres',
        authority: 'architect',
        status: 'confirmed',
      }),
      event('INT', 'interpretation', 'storage', { value: 'sqlite', authority: 'implementer' }),
    ],
  });
  assert.equal(finding(result, 'wrong-interpretation').confidence, 'high');
});

test('does not apply a later instruction retroactively', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('INT', 'interpretation', 'storage', { value: 'sqlite', authority: 'implementer' }),
      event('DEC', 'decision', 'storage', {
        value: 'postgres',
        authority: 'architect',
        status: 'confirmed',
        at: '2026-01-01T11:00:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'wrong-interpretation'), undefined);
});

test('detects a confirmed retrospective misunderstanding correction', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('INT', 'interpretation', 'report', { value: 'pdf', authority: 'implementer' }),
      event('FIX', 'clarification', 'report', {
        value: 'xlsx',
        authority: 'owner',
        status: 'confirmed',
        at: '2026-01-01T11:00:00Z',
        references: ['INT'],
        confirmsMisunderstanding: true,
      }),
    ],
  });
  assert.match(finding(result, 'requirement-misunderstood').title, /corrected after/);
});

test('detects an assumption used before confirmation', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('ASM', 'assumption', 'tenant-scope', {
        value: 'global',
        authority: 'implementer',
        requiresConfirmation: true,
      }),
    ],
  });
  assert.equal(finding(result, 'assumption-not-confirmed').state, 'detected');
});

test('accepts confirmation recorded before dependent work', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('ASM', 'assumption', 'tenant-scope', {
        value: 'organization',
        authority: 'implementer',
        requiresConfirmation: true,
      }),
      event('CONF', 'confirmation', 'tenant-scope', {
        authority: 'owner',
        status: 'confirmed',
        references: ['ASM'],
        at: '2026-01-01T09:30:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'assumption-not-confirmed'), undefined);
});

test('detects an open question at implementation start', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [event('Q', 'question', 'retention', { status: 'open', value: '30-or-90-days' })],
  });
  assert.equal(finding(result, 'ambiguous-specification').state, 'detected');
});

test('reports unresolved draft ambiguity as suspected', () => {
  const result = detectCommunicationMistakes({
    phase: 'draft',
    events: [event('Q', 'question', 'retention', { status: 'open', appliesTo: [] })],
  });
  assert.equal(finding(result, 'ambiguous-specification').state, 'suspected');
  assert.equal(result.status, 'review-required');
});

test('detects work that begins without a required decision record', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [event('DR', 'decision-required', 'export-format', { requiresDecision: true })],
  });
  assert.equal(finding(result, 'decision-undocumented').confidence, 'high');
});

test('accepts a canonical decision before work', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('DR', 'decision-required', 'export-format', { requiresDecision: true }),
      event('DEC', 'decision', 'export-format', {
        value: 'xlsx',
        authority: 'owner',
        status: 'confirmed',
        references: ['DR'],
        at: '2026-01-01T09:30:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'decision-undocumented'), undefined);
});

test('detects unresolved conflicting authoritative instructions', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('I1', 'instruction', 'deletion', { value: 'hard-delete', authority: 'owner' }),
      event('I2', 'instruction', 'deletion', { value: 'soft-delete', authority: 'architect' }),
    ],
  });
  assert.equal(finding(result, 'conflicting-instructions').state, 'detected');
});

test('superseded instruction does not remain an active conflict', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('I1', 'instruction', 'deletion', { value: 'hard-delete', authority: 'owner' }),
      event('I2', 'instruction', 'deletion', {
        value: 'soft-delete',
        authority: 'owner',
        supersedes: ['I1'],
        at: '2026-01-01T09:30:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'conflicting-instructions'), undefined);
});

test('detects work that begins without required approval', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('AR', 'approval-request', 'schema-change', {
        requiresApproval: true,
        status: 'open',
      }),
    ],
  });
  assert.equal(finding(result, 'missing-approval').state, 'detected');
});

test('accepts explicit approval before work', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('AR', 'approval-request', 'schema-change', {
        requiresApproval: true,
        status: 'open',
      }),
      event('APP', 'approval', 'schema-change', {
        authority: 'approver',
        status: 'approved',
        references: ['AR'],
        at: '2026-01-01T09:30:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'missing-approval'), undefined);
});

test('missing work timestamps produce insufficient evidence rather than a blocker', () => {
  const result = detectCommunicationMistakes({
    commits: [commit('a', null)],
    events: [
      event('REQ', 'requirement', 'auth-mode', { value: 'session', authority: 'owner' }),
      event('INT', 'interpretation', 'auth-mode', { value: 'token', authority: 'implementer' }),
    ],
  });
  assert.equal(finding(result, 'requirement-misunderstood').state, 'suspected');
  assert.equal(result.blockers.length, 0);
  assert.ok(result.notices.some((notice) => notice.code === 'dependent-work-timestamp-missing'));
});

test('unstructured text without event fields cannot create a finding', () => {
  assert.throws(
    () => detectCommunicationMistakes({ events: [{ text: 'Maybe the client meant CSV.' }] }),
    /communication-id/,
  );
});

test('explicit resolution preserves the occurrence as resolved', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('Q', 'question', 'retention', { status: 'open' }),
      event('RES', 'resolution', 'retention', {
        authority: 'owner',
        status: 'confirmed',
        at: '2026-01-01T11:00:00Z',
        resolves: ['ambiguous-specification'],
      }),
    ],
  });
  assert.equal(finding(result, 'ambiguous-specification').state, 'resolved');
  assert.equal(result.blockers.length, 0);
});

test('reviewer waiver preserves but unblocks a finding', () => {
  const result = detectCommunicationMistakes({
    commits: [commit()],
    events: [
      event('AR', 'approval-request', 'schema-change', {
        requiresApproval: true,
        status: 'open',
      }),
      event('W', 'waiver', 'schema-change', {
        findingType: 'missing-approval',
        reviewer: 'architect',
        reason: 'Emergency remediation was authorized under the incident policy.',
        at: '2026-01-01T11:00:00Z',
      }),
    ],
  });
  assert.equal(finding(result, 'missing-approval').waived, true);
  assert.equal(result.blockers.length, 0);
});
