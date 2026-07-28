import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confidenceForRootCauseOutput,
  enrichAnalysisResult,
  enrichExplanationReport,
  enrichFindingConfidence,
  enrichPreventionRegistry,
  evidenceRecordsFromFinding,
} from './confidence-finding-adapters.mjs';

function preventionPack(state = 'candidate') {
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
    rootCauseId: 'ROOT-X',
    revision: 1,
    controls: types.map((type) => ({
      id: `CONTROL-${type}`,
      type,
      state: ['ci-check', 'static-analysis-rule'].includes(type) ? state : 'generated',
      verificationRefs: state === 'enforced' ? [`verify:${type}`] : [],
    })),
  };
}

test('enriches a detector finding with all five metrics', () => {
  const finding = enrichFindingConfidence({
    id: 'F-1',
    type: 'scope-creep',
    state: 'detected',
    confidence: 'high',
    evidence: ['Commit abc changed an undeclared path.'],
    missingEvidence: [],
  });
  assert.equal(finding.confidenceScores.policyVersion, 'CONFIDENCE-1.0.0');
  assert.equal(finding.confidenceScores.rootCauseConfidence.status, 'insufficient-evidence');
  assert.ok('automationConfidence' in finding.confidenceScores);
});

test('does not mark suspected finding prose as verified evidence', () => {
  const [record] = evidenceRecordsFromFinding({
    id: 'F-2',
    state: 'suspected',
    confidence: 'medium',
    evidence: ['A requirement might be missing.'],
  });
  assert.equal(record.status, 'claimed');
  assert.equal(record.provenanceComplete, false);
});

test('preserves blocker decisions while enriching findings', () => {
  const result = enrichAnalysisResult({
    findings: [{ id: 'F-1', state: 'detected', confidence: 'high', evidence: ['verified path'] }],
    blockers: [{ id: 'F-1', state: 'detected', confidence: 'high', evidence: ['verified path'] }],
  });
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].id, 'F-1');
  assert.ok(result.blockers[0].confidenceScores);
});

test('root-cause output combines assessment and duplicate relation', () => {
  const confidence = confidenceForRootCauseOutput({
    input: {
      workflowName: 'CI',
      jobName: 'test',
      stepName: 'unit tests',
      workflowRunId: '123',
      logText: 'known signature',
    },
    assessment: {
      status: 'machine-supported',
      ambiguous: false,
      missingEvidence: [],
      selected: {
        rootCauseId: 'ROOT-X',
        score: 95,
        deterministic: true,
        matchedSignatures: ['known signature'],
        missingEvidence: [],
      },
    },
    comparison: {
      relation: 'shared-root-cause',
      score: 95,
      sharedRootCause: true,
      evidence: ['same verified root'],
    },
  });
  assert.equal(confidence.duplicateConfidence.score, 95);
  assert.ok(confidence.rootCauseConfidence.score >= 80);
});

test('explanation adapter preserves original status and adds canonical envelope', () => {
  const report = enrichExplanationReport(
    {
      status: 'challenged',
      confidenceScore: 88,
      contradictions: [],
      challenges: ['missing test'],
      missingEvidence: ['missing test'],
      questions: {},
    },
    { evidence: [] },
  );
  assert.equal(report.status, 'challenged');
  assert.equal(report.confidenceScores.explanationConfidence.score, 79);
});

test('prevention adapter adds automation confidence to result and pack', () => {
  const registry = enrichPreventionRegistry(
    {
      results: [
        {
          status: 'ready',
          mistake: {
            rootCauseId: 'ROOT-X',
            evidenceRefs: ['issue:1'],
            verificationRefs: ['workflow:1'],
            regressionRefs: ['test:1'],
          },
          pack: preventionPack('enforced'),
        },
      ],
      packs: [preventionPack('enforced')],
    },
    { exactFilesCurrent: true, governancePassed: true },
  );
  assert.equal(registry.results[0].confidenceScores.automationConfidence.score, 100);
  assert.equal(registry.packs[0].automationConfidence.score, 100);
});

test('prevention adapter leaves candidate controls below 80', () => {
  const registry = enrichPreventionRegistry({
    results: [
      {
        status: 'ready',
        mistake: { rootCauseId: 'ROOT-X' },
        pack: preventionPack('candidate'),
      },
    ],
    packs: [preventionPack('candidate')],
  });
  assert.ok(registry.packs[0].automationConfidence.score <= 79);
});
