import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOrUpdatePreventionPack,
  buildPreventionRegistry,
  validatePreventionPack,
} from './prevention-engine.mjs';
import { PREVENTION_CONTROL_TYPES } from './prevention-engine-support.mjs';

function resolved(overrides = {}) {
  return {
    id: 'ISSUE-1',
    issueNumber: 1,
    rootCauseId: 'ROOT-EXAMPLE-FAILURE',
    ledgerEntry: 'EL-9001',
    category: 'unit-integration-tests',
    status: 'closed',
    rootCauseStatus: 'confirmed',
    resolutionStatus: 'verified',
    resolvedAt: '2026-07-17T10:00:00Z',
    fixCommit: 'a'.repeat(40),
    reviewer: 'reviewer-1',
    reviewedAt: '2026-07-17T10:05:00Z',
    verificationRefs: ['workflow:1/job:2/step:test'],
    regressionRefs: ['test:example-regression'],
    preventionControl: 'Require the bounded regression before merge.',
    successfulMethod: 'Run the focused regression and complete suite.',
    unsuccessfulMethod: 'Trust the absence of a current failure.',
    evidenceRefs: ['issue:1'],
    ...overrides,
  };
}

test('requires evidence beyond a closed issue', () => {
  const result = buildOrUpdatePreventionPack({ status: 'closed', rootCauseId: 'ROOT-X' });
  assert.equal(result.status, 'insufficient-evidence');
  assert.ok(result.missingEvidence.includes('confirmed-root-cause'));
  assert.equal(result.pack, null);
});

test('generates exactly the seven required controls', () => {
  const result = buildOrUpdatePreventionPack(resolved());
  assert.equal(result.status, 'ready');
  assert.deepEqual(
    result.pack.controls.map((control) => control.type),
    PREVENTION_CONTROL_TYPES,
  );
  assert.equal(result.pack.controls.length, 7);
});

test('uses deterministic stable identities and paths', () => {
  const first = buildOrUpdatePreventionPack(resolved()).pack;
  const second = buildOrUpdatePreventionPack(resolved()).pack;
  assert.deepEqual(first, second);
  assert.equal(first.controls[0].targetPath, '.newax/prevention/ci/root-example-failure.json');
});

test('updates one pack for a recurrence instead of duplicating it', () => {
  const first = buildOrUpdatePreventionPack(resolved()).pack;
  const second = buildOrUpdatePreventionPack(
    resolved({
      id: 'ISSUE-2',
      issueNumber: 2,
      resolvedAt: '2026-07-18T10:00:00Z',
      fixCommit: 'b'.repeat(40),
      evidenceRefs: ['issue:2'],
    }),
    first,
  ).pack;
  assert.equal(second.id, first.id);
  assert.equal(second.revision, 2);
  assert.equal(second.occurrences.length, 2);
});

test('replaying the same occurrence is idempotent', () => {
  const first = buildOrUpdatePreventionPack(resolved()).pack;
  const secondResult = buildOrUpdatePreventionPack(resolved(), first);
  assert.equal(secondResult.changed, false);
  assert.deepEqual(secondResult.pack, first);
});

test('executable controls remain candidate without implementation evidence', () => {
  const pack = buildOrUpdatePreventionPack(resolved()).pack;
  assert.equal(pack.controls.find((control) => control.type === 'ci-check').state, 'candidate');
  assert.equal(
    pack.controls.find((control) => control.type === 'static-analysis-rule').state,
    'candidate',
  );
});

test('executable controls become enforced with ownership and verification', () => {
  const options = {
    controls: {
      'ci-check': {
        owner: 'platform',
        reviewer: 'security',
        implementationRef: 'tooling/check.mjs',
        verificationRefs: ['workflow:2/job:3/step:check'],
      },
    },
  };
  const pack = buildOrUpdatePreventionPack(resolved(), null, options).pack;
  assert.equal(pack.controls.find((control) => control.type === 'ci-check').state, 'enforced');
});

test('rejects arbitrary executable fields in declarative controls', () => {
  assert.throws(
    () =>
      buildOrUpdatePreventionPack(resolved(), null, {
        controls: { 'ci-check': { definition: { command: 'run something' } } },
      }),
    /arbitrary executable field/i,
  );
});

test('rejects nested arbitrary executable fields in declarative controls', () => {
  assert.throws(
    () =>
      buildOrUpdatePreventionPack(resolved(), null, {
        controls: {
          'static-analysis-rule': {
            definition: { selector: { steps: [{ shell: 'hidden executable' }] } },
          },
        },
      }),
    /selector\.steps\.0\.shell/i,
  );
});

test('preserves an enforced definition until supersession is approved', () => {
  const originalDefinition = {
    kind: 'bounded-check',
    assertion: 'original enforced rule',
  };
  const enforced = buildOrUpdatePreventionPack(resolved(), null, {
    controls: {
      'ci-check': {
        owner: 'platform',
        reviewer: 'reviewer',
        implementationRef: 'tooling/check.mjs',
        verificationRefs: ['workflow:2'],
        definition: originalDefinition,
      },
    },
  }).pack;
  const updated = buildOrUpdatePreventionPack(
    resolved({
      id: 'ISSUE-2',
      issueNumber: 2,
      fixCommit: 'b'.repeat(40),
      preventionControl: 'A different lesson that must not rewrite the enforced rule silently.',
    }),
    enforced,
    {
      controls: {
        'ci-check': {
          owner: 'different-owner',
          reviewer: 'different-reviewer',
          implementationRef: 'tooling/replacement.mjs',
          verificationRefs: ['workflow:3'],
          definition: { kind: 'bounded-check', assertion: 'unapproved replacement' },
        },
      },
    },
  ).pack;
  const control = updated.controls.find((entry) => entry.type === 'ci-check');
  assert.deepEqual(control.definition, originalDefinition);
  assert.equal(control.owner, 'platform');
  assert.equal(control.implementationRef, 'tooling/check.mjs');
  assert.deepEqual(control.verificationRefs, ['workflow:2', 'workflow:3']);
});

test('does not weaken an enforced control without approved supersession', () => {
  const enforced = buildOrUpdatePreventionPack(resolved(), null, {
    controls: {
      'ci-check': {
        owner: 'platform',
        reviewer: 'reviewer',
        implementationRef: 'tooling/check.mjs',
        verificationRefs: ['workflow:2'],
      },
    },
  }).pack;
  const updated = buildOrUpdatePreventionPack(
    resolved({ id: 'ISSUE-2', issueNumber: 2, fixCommit: 'b'.repeat(40) }),
    enforced,
  ).pack;
  assert.equal(updated.controls.find((control) => control.type === 'ci-check').state, 'enforced');
});

test('allows a downgrade only with explicit supersession approval', () => {
  const enforced = buildOrUpdatePreventionPack(resolved(), null, {
    controls: {
      'ci-check': {
        owner: 'platform',
        reviewer: 'reviewer',
        implementationRef: 'tooling/check.mjs',
        verificationRefs: ['workflow:2'],
      },
    },
  }).pack;
  const updated = buildOrUpdatePreventionPack(
    resolved({ id: 'ISSUE-2', issueNumber: 2, fixCommit: 'b'.repeat(40) }),
    enforced,
    {
      controls: {
        'ci-check': {
          supersession: {
            approver: 'owner',
            reason: 'The enforced implementation is being replaced safely.',
            effectiveAt: '2026-07-18T12:00:00Z',
          },
        },
      },
    },
  ).pack;
  const control = updated.controls.find((entry) => entry.type === 'ci-check');
  assert.equal(control.state, 'candidate');
  assert.equal(control.supersession.approver, 'owner');
});

test('validation catches an incomplete pack', () => {
  const pack = buildOrUpdatePreventionPack(resolved()).pack;
  const incomplete = { ...pack, controls: pack.controls.slice(0, 6) };
  assert.match(validatePreventionPack(incomplete).join('\n'), /Missing prevention control type/);
});

test('builds separate packs for separate root causes', () => {
  const registry = buildPreventionRegistry([
    resolved(),
    resolved({ id: 'ISSUE-2', rootCauseId: 'ROOT-OTHER', fixCommit: 'b'.repeat(40) }),
  ]);
  assert.equal(registry.packs.length, 2);
});

test('produces the same recurrence pack regardless of input retrieval order', () => {
  const early = resolved({ id: 'ISSUE-1', resolvedAt: '2026-07-17T10:00:00Z' });
  const late = resolved({
    id: 'ISSUE-2',
    issueNumber: 2,
    resolvedAt: '2026-07-18T10:00:00Z',
    fixCommit: 'b'.repeat(40),
  });
  const forward = buildPreventionRegistry([early, late]).packs[0];
  const reverse = buildPreventionRegistry([late, early]).packs[0];
  assert.deepEqual(reverse, forward);
});
