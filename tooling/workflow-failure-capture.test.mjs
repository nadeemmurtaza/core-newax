import assert from 'node:assert/strict';
import test from 'node:test';

import { isSelfReferentialGovernanceStep } from './workflow-failure-capture.mjs';

test('classifies the self-referential governance bookkeeping steps', () => {
  assert.equal(isSelfReferentialGovernanceStep('Verify pull-request governance structure'), true);
  assert.equal(
    isSelfReferentialGovernanceStep('Reconcile workflow failures and learning evidence'),
    true,
  );
  assert.equal(isSelfReferentialGovernanceStep('Detect planning mistakes'), true);
});

test('does not classify real CI or evidence-bearing governance steps as self-referential', () => {
  assert.equal(isSelfReferentialGovernanceStep('Check formatting'), false);
  assert.equal(isSelfReferentialGovernanceStep('Lint'), false);
  assert.equal(isSelfReferentialGovernanceStep('Test'), false);
  assert.equal(isSelfReferentialGovernanceStep('Build'), false);
  assert.equal(isSelfReferentialGovernanceStep('Verify root-cause decisions'), false);
  assert.equal(isSelfReferentialGovernanceStep('Detect tool and AI mistakes'), false);
  assert.equal(isSelfReferentialGovernanceStep('Verify prevention controls'), false);
  assert.equal(isSelfReferentialGovernanceStep('Verify confidence scores'), false);
  assert.equal(isSelfReferentialGovernanceStep('Verify engineering knowledge graph'), false);
  assert.equal(isSelfReferentialGovernanceStep('Detect recurring engineering mistakes'), false);
  assert.equal(isSelfReferentialGovernanceStep('Verify executive dashboard records'), false);
});

test('rejects an unrelated or empty step name', () => {
  assert.equal(isSelfReferentialGovernanceStep('Some other step'), false);
  assert.equal(isSelfReferentialGovernanceStep(''), false);
  assert.equal(isSelfReferentialGovernanceStep(undefined), false);
});
