import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEventExplanationInput,
  createEventExplanationVerification,
  parseExplanationEvidenceRecord,
  renderExplanationEvidenceRecord,
  renderExplanationVerification,
  verifyExplanation,
} from './explanation-verification.mjs';

const selected = {
  ambiguous: false,
  selected: { rootCauseId: 'ROOT-ONE', score: 85 },
  hypotheses: [
    { rootCauseId: 'ROOT-ONE', score: 85 },
    { rootCauseId: 'ROOT-TWO', score: 45 },
  ],
};

function completeEvidence() {
  return [
    {
      id: 'log-1',
      type: 'log',
      status: 'verified',
      supports: ['ROOT-ONE'],
      contradicts: [],
    },
    {
      id: 'commit-1',
      type: 'commit',
      status: 'verified',
      supports: ['ROOT-ONE'],
      contradicts: [],
      commitSha: '1111111111111111111111111111111111111111',
    },
    {
      id: 'test-1',
      type: 'test',
      status: 'verified',
      supports: ['ROOT-ONE'],
      contradicts: [],
      reproduces: true,
      outcome: 'passed',
    },
  ];
}

function completeExplanation() {
  return {
    rootCauseId: 'ROOT-ONE',
    statement: 'The lockfile no longer matched the dependency manifest.',
    evidenceReferences: ['log-1', 'commit-1', 'test-1'],
    proofLogId: 'log-1',
    introducedByCommit: '1111111111111111111111111111111111111111',
    introducedByCommitEvidenceId: 'commit-1',
    reproducingTestId: 'test-1',
    alternativesReviewed: true,
  };
}

test('accepts an explanation only when evidence, log, commit, test, and alternatives are verified', () => {
  const result = verifyExplanation({
    assessment: selected,
    explanation: completeExplanation(),
    evidence: completeEvidence(),
  });

  assert.equal(result.status, 'accepted');
  assert.ok(result.confidenceScore >= 80);
  assert.equal(result.questions.evidenceSupport.answer, 'supported');
  assert.equal(result.questions.alternativeLikelihood.answer, 'selected-more-likely');
  assert.equal(result.questions.proofLog.answer, 'verified');
  assert.equal(result.questions.introducingCommit.answer, 'verified');
  assert.equal(result.questions.reproducingTest.answer, 'verified');
  assert.match(result.confidenceMeaning, /not a statistical probability/);
});

test('challenges unsupported prose and caps confidence when mandatory evidence is absent', () => {
  const result = verifyExplanation({
    assessment: selected,
    explanation: {
      rootCauseId: 'ROOT-ONE',
      statement: 'The lockfile caused the failure.',
      evidenceReferences: [],
      alternativesReviewed: false,
    },
  });

  assert.equal(result.status, 'challenged');
  assert.ok(result.confidenceScore <= 49);
  assert.match(result.challenges.join(' '), /cites no evidence/);
  assert.equal(result.questions.proofLog.answer, 'missing');
});

test('rejects an explanation when verified evidence supports another cause more strongly', () => {
  const evidence = completeEvidence();
  evidence.push({
    id: 'alt-log',
    type: 'log',
    status: 'verified',
    supports: ['ROOT-TWO'],
    contradicts: ['ROOT-ONE'],
  });
  evidence.push({
    id: 'alt-test',
    type: 'test',
    status: 'verified',
    supports: ['ROOT-TWO'],
    contradicts: ['ROOT-ONE'],
    reproduces: true,
    outcome: 'passed',
  });
  const assessment = {
    ambiguous: false,
    selected: { rootCauseId: 'ROOT-ONE', score: 55 },
    hypotheses: [
      { rootCauseId: 'ROOT-ONE', score: 55 },
      { rootCauseId: 'ROOT-TWO', score: 54 },
    ],
  };
  const result = verifyExplanation({
    assessment,
    explanation: completeExplanation(),
    evidence,
  });

  assert.equal(result.status, 'rejected');
  assert.ok(result.confidenceScore <= 39);
  assert.equal(result.questions.evidenceSupport.answer, 'contradicted');
  assert.match(result.errors.join(' '), /Alternative ROOT-TWO|contradictory evidence/);
});

test('refuses claimed or unavailable references as proof', () => {
  const result = verifyExplanation({
    assessment: selected,
    explanation: {
      ...completeExplanation(),
      evidenceReferences: ['log-1', 'missing'],
    },
    evidence: [
      {
        id: 'log-1',
        type: 'log',
        status: 'claimed',
        supports: ['ROOT-ONE'],
        contradicts: [],
      },
    ],
  });

  assert.equal(result.status, 'challenged');
  assert.ok(result.missingEvidence.some((item) => item.includes('Unavailable evidence')));
  assert.notEqual(result.questions.proofLog.answer, 'verified');
});

test('allows a reviewed evidence-backed exception but reduces confidence', () => {
  const explanation = completeExplanation();
  delete explanation.reproducingTestId;
  explanation.evidenceReferences = ['log-1', 'commit-1'];
  explanation.exceptions = {
    reproducingTest: {
      approved: true,
      reason:
        'The production-only race cannot be reproduced safely outside the isolated incident environment.',
      evidenceReferences: ['log-1'],
    },
  };
  const result = verifyExplanation({
    assessment: selected,
    explanation,
    evidence: completeEvidence().filter((item) => item.id !== 'test-1'),
  });

  assert.equal(result.questions.reproducingTest.answer, 'approved-exception');
  assert.ok(result.confidenceScore < 100);
  assert.equal(result.status, 'accepted');
});

test('creates a challenged intake report without inventing an introducing commit or test', () => {
  const report = createEventExplanationVerification({
    rootCauseId: 'ROOT-ONE',
    rootCauseCandidate: 'The lockfile no longer matched the dependency manifest.',
    rootCauseAssessment: selected,
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    workflowRunId: 44,
    jobId: 55,
    stepName: 'Install dependencies',
  });
  const rendered = renderExplanationVerification(report);

  assert.equal(report.status, 'challenged');
  assert.equal(report.questions.proofLog.answer, 'verified');
  assert.equal(report.questions.introducingCommit.answer, 'missing');
  assert.equal(report.questions.reproducingTest.answer, 'missing');
  assert.match(rendered, /Which commit introduced it\?: missing/);
  assert.match(rendered, /Confidence score/);
});

test('rejects duplicate evidence identifiers', () => {
  assert.throws(
    () =>
      verifyExplanation({
        assessment: selected,
        explanation: completeExplanation(),
        evidence: [completeEvidence()[0], completeEvidence()[0]],
      }),
    /Duplicate evidence ID/,
  );
});

test('round-trips the machine-readable explanation evidence record', () => {
  const input = createEventExplanationInput({
    rootCauseId: 'ROOT-ONE',
    rootCauseCandidate: 'The lockfile no longer matched the dependency manifest.',
    rootCauseAssessment: selected,
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    workflowRunId: 44,
    jobId: 55,
    stepName: 'Install dependencies',
  });
  const rendered = renderExplanationEvidenceRecord(input);
  assert.deepEqual(parseExplanationEvidenceRecord(rendered), input);
  assert.equal(parseExplanationEvidenceRecord('no record'), null);
  assert.equal(
    parseExplanationEvidenceRecord('<!-- newax-explanation-evidence\nnot-json\n-->'),
    null,
  );
});

test('challenges a strong but unreviewed competing explanation', () => {
  const explanation = { ...completeExplanation(), alternativesReviewed: false };
  const result = verifyExplanation({
    assessment: selected,
    explanation,
    evidence: completeEvidence(),
  });

  assert.equal(result.status, 'challenged');
  assert.equal(result.questions.alternativeLikelihood.answer, 'unresolved');
  assert.ok(result.confidenceScore <= 59);
});

test('does not accept a commit reference that fails exact SHA attribution', () => {
  const explanation = {
    ...completeExplanation(),
    introducedByCommit: '2'.repeat(40),
  };
  const result = verifyExplanation({
    assessment: selected,
    explanation,
    evidence: completeEvidence(),
  });

  assert.equal(result.status, 'challenged');
  assert.equal(result.questions.introducingCommit.answer, 'invalid');
  assert.ok(result.confidenceScore <= 49);
});
