import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreConfidenceEnvelope, validateConfidenceEnvelope } from './confidence-scoring.mjs';

function evidence(overrides = {}) {
  return {
    id: 'E-1',
    type: 'log',
    status: 'verified',
    primary: true,
    durable: true,
    provenanceComplete: true,
    roles: ['proof-log'],
    ...overrides,
  };
}

function rootAssessment(overrides = {}) {
  return {
    status: 'machine-supported',
    ambiguous: false,
    missingEvidence: [],
    selected: {
      rootCauseId: 'ROOT-X',
      score: 96,
      deterministic: true,
      matchedSignatures: ['signature-x'],
      evidenceAgainst: [],
      missingEvidence: [],
    },
    ...overrides,
  };
}

function explanation(overrides = {}) {
  return {
    status: 'accepted',
    confidenceScore: 89,
    missingEvidence: [],
    challenges: [],
    contradictions: [],
    questions: {
      evidenceSupport: { evidenceIds: ['E-1'] },
      proofLog: { evidenceIds: ['E-1'] },
      introducingCommit: { evidenceIds: ['E-2'] },
      reproducingTest: { evidenceIds: ['E-3'] },
    },
    ...overrides,
  };
}

function pack(overrides = {}) {
  const types = [
    'ci-check',
    'pr-checklist',
    'review-checklist',
    'coding-standard',
    'verification-rule',
    'static-analysis-rule',
    'test-template',
  ];
  return {
    id: 'PACK-ROOT-X',
    revision: 2,
    controls: types.map((type) => ({
      id: `CONTROL-${type}`,
      type,
      state: ['ci-check', 'static-analysis-rule'].includes(type) ? 'enforced' : 'generated',
      verificationRefs: [`verify:${type}`],
    })),
    ...overrides,
  };
}

test('produces all five canonical metrics', () => {
  const result = scoreConfidenceEnvelope({
    rootCauseAssessment: rootAssessment(),
    duplicateAssessment: {
      relation: 'shared-root-cause',
      score: 97,
      sharedRootCause: true,
      evidence: ['same classified root cause'],
    },
    evidenceRecords: [
      evidence(),
      evidence({ id: 'E-2', type: 'commit', roles: ['introducing-commit'] }),
      evidence({ id: 'E-3', type: 'test', roles: ['reproducing-test'] }),
    ],
    requiredEvidenceRoles: ['proof-log', 'introducing-commit', 'reproducing-test'],
    explanationVerification: explanation(),
    automationAssessment: {
      pack: pack(),
      validationErrors: [],
      exactFilesCurrent: true,
      governancePassed: true,
    },
  });
  assert.equal(result.policyVersion, 'CONFIDENCE-1.0.0');
  assert.equal(result.duplicateConfidence.display, '97%');
  assert.equal(result.evidenceQuality.level, 'High');
  assert.equal(result.explanationConfidence.display, '89%');
  assert.equal(result.automationConfidence.display, '100%');
  assert.ok(result.rootCauseConfidence.score >= 90);
});

test('scores are deterministic for equivalent input', () => {
  const input = {
    rootCauseAssessment: rootAssessment(),
    evidenceRecords: [evidence()],
  };
  assert.deepEqual(scoreConfidenceEnvelope(input), scoreConfidenceEnvelope(input));
});

test('root cause is capped when ambiguous', () => {
  const result = scoreConfidenceEnvelope({
    rootCauseAssessment: rootAssessment({ ambiguous: true }),
    evidenceRecords: [evidence()],
  });
  assert.equal(result.rootCauseConfidence.score, 59);
  assert.ok(
    result.rootCauseConfidence.capsApplied.some((cap) => cap.id === 'ambiguous-root-cause'),
  );
});

test('contradictory evidence caps root cause and lowers evidence quality', () => {
  const result = scoreConfidenceEnvelope({
    rootCauseAssessment: rootAssessment(),
    evidenceRecords: [evidence(), evidence({ id: 'E-C', status: 'contradictory' })],
  });
  assert.equal(result.rootCauseConfidence.score, 39);
  assert.equal(result.evidenceQuality.status, 'contradicted');
});

test('unrelated duplicate has zero duplicate support without becoming missing', () => {
  const result = scoreConfidenceEnvelope({
    duplicateAssessment: {
      relation: 'unrelated',
      score: 0,
      sharedRootCause: false,
      evidence: ['verified root-cause IDs differ'],
    },
  });
  assert.equal(result.duplicateConfidence.score, 0);
  assert.equal(result.duplicateConfidence.status, 'scored');
  assert.equal(result.duplicateConfidence.relation, 'unrelated');
});

test('incomplete duplicate evidence remains explicitly insufficient', () => {
  const result = scoreConfidenceEnvelope({
    duplicateAssessment: {
      relation: 'insufficient-evidence',
      score: 70,
      sharedRootCause: false,
      evidence: ['same category only'],
    },
  });
  assert.equal(result.duplicateConfidence.score, 60);
  assert.equal(result.duplicateConfidence.status, 'insufficient-evidence');
});

test('missing explanation does not borrow root-cause confidence', () => {
  const result = scoreConfidenceEnvelope({
    rootCauseAssessment: rootAssessment(),
    evidenceRecords: [evidence()],
  });
  assert.equal(result.explanationConfidence.score, 0);
  assert.equal(result.explanationConfidence.status, 'insufficient-evidence');
});

test('challenged explanation is capped below acceptance threshold', () => {
  const result = scoreConfidenceEnvelope({
    explanationVerification: explanation({ status: 'challenged', confidenceScore: 95 }),
  });
  assert.equal(result.explanationConfidence.score, 79);
});

test('candidate executable controls cap automation confidence', () => {
  const candidatePack = pack({
    controls: pack().controls.map((control) =>
      ['ci-check', 'static-analysis-rule'].includes(control.type)
        ? { ...control, state: 'candidate', verificationRefs: [] }
        : control,
    ),
  });
  const result = scoreConfidenceEnvelope({
    automationAssessment: {
      pack: candidatePack,
      validationErrors: [],
      exactFilesCurrent: true,
      governancePassed: true,
    },
  });
  assert.ok(result.automationConfidence.score <= 79);
  assert.ok(
    result.automationConfidence.capsApplied.some(
      (cap) => cap.id === 'candidate-executable-controls',
    ),
  );
});

test('automation cannot exceed 94 without exact governance success', () => {
  const result = scoreConfidenceEnvelope({
    automationAssessment: {
      pack: pack(),
      validationErrors: [],
      exactFilesCurrent: true,
      governancePassed: false,
    },
  });
  assert.equal(result.automationConfidence.score, 94);
});

test('evidence quality is insufficient when no evidence exists', () => {
  const result = scoreConfidenceEnvelope({});
  assert.equal(result.evidenceQuality.level, 'Insufficient');
  assert.equal(result.evidenceQuality.score, 0);
});

test('validation catches manually altered scores', () => {
  const input = { rootCauseAssessment: rootAssessment(), evidenceRecords: [evidence()] };
  const envelope = scoreConfidenceEnvelope(input);
  const tampered = {
    ...envelope,
    rootCauseConfidence: { ...envelope.rootCauseConfidence, score: 99, display: '99%' },
  };
  assert.match(validateConfidenceEnvelope(input, tampered).join('\n'), /rootCauseConfidence/);
});

test('validation catches policy or input digest mismatch', () => {
  const input = { evidenceRecords: [evidence()] };
  const envelope = scoreConfidenceEnvelope(input);
  assert.match(
    validateConfidenceEnvelope(input, { ...envelope, policyVersion: 'CONFIDENCE-0.0.1' }).join(
      '\n',
    ),
    /policy version/,
  );
  assert.match(
    validateConfidenceEnvelope(input, { ...envelope, inputDigest: 'bad' }).join('\n'),
    /input digest/,
  );
});

test('root cause cannot remain high without a canonical evidence set', () => {
  const result = scoreConfidenceEnvelope({ rootCauseAssessment: rootAssessment() });
  assert.equal(result.rootCauseConfidence.score, 49);
  assert.ok(
    result.rootCauseConfidence.capsApplied.some(
      (cap) => cap.id === 'missing-root-cause-evidence-set',
    ),
  );
});

test('validation catches confidence schema mismatch', () => {
  const input = { evidenceRecords: [evidence()] };
  const envelope = scoreConfidenceEnvelope(input);
  assert.match(
    validateConfidenceEnvelope(input, { ...envelope, schemaVersion: 2 }).join('\n'),
    /schema version/,
  );
});
