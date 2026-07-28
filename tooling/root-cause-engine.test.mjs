import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  analyzeRootCause,
  compareRootCauseOccurrences,
  evaluateLearningOutcome,
  validateRootCauseCatalog,
  verifyRootCauseExplanation,
} from './root-cause-engine.mjs';

const catalog = JSON.parse(
  readFileSync(
    new URL('../docs/verification/engineering-learning-catalog.json', import.meta.url),
    'utf8',
  ),
);

function createCatalog(rootCauses) {
  return {
    version: 'test',
    categories: Array.from(new Set(rootCauses.map((rootCause) => rootCause.category))),
    rootCauses,
  };
}

function createRootCause(overrides = {}) {
  return {
    id: 'ROOT-TEST-ONE',
    ledgerEntry: 'EL-9001',
    category: 'unit-integration-tests',
    confidence: 'high',
    deterministic: false,
    signatures: ['test signature'],
    rootCause: 'A test root cause occurred.',
    unsuccessfulMethod: 'Use the failed test method.',
    successfulMethod: 'Use the verified test method.',
    preventionControl: 'Keep the regression test.',
    ...overrides,
  };
}

test('promotes a complete deterministic signature only when evidence is contradiction-free', () => {
  const assessment = analyzeRootCause(
    {
      workflowName: 'Continuous Integration',
      jobName: 'Verify monorepo',
      stepName: 'Install dependencies',
      logText: 'ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile.',
    },
    catalog,
  );

  assert.equal(assessment.selected.rootCauseId, 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED');
  assert.equal(assessment.status, 'machine-supported');
  assert.equal(assessment.deterministic, true);
  assert.deepEqual(assessment.evidenceAgainst, []);
});

test('keeps a partial deterministic signature as a candidate with missing evidence', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Install dependencies',
      logText: 'alpha was observed',
    },
    createCatalog([
      createRootCause({
        id: 'ROOT-TEST-DETERMINISTIC',
        deterministic: true,
        signatures: ['alpha', 'beta'],
      }),
    ]),
  );

  assert.equal(assessment.selected.rootCauseId, 'ROOT-TEST-DETERMINISTIC');
  assert.equal(assessment.status, 'candidate');
  assert.equal(assessment.deterministic, false);
  assert.match(assessment.evidenceAgainst[0], /beta/);
  assert.match(assessment.missingEvidence[0], /beta/);
});

test('ranks matching hypotheses and marks near-equal candidates ambiguous', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Run tests',
      logText: 'shared signature happened',
    },
    createCatalog([
      createRootCause({
        id: 'ROOT-TEST-ALPHA',
        ledgerEntry: 'EL-9001',
        signatures: ['shared signature'],
      }),
      createRootCause({
        id: 'ROOT-TEST-BETA',
        ledgerEntry: 'EL-9002',
        signatures: ['shared signature'],
      }),
    ]),
  );

  assert.equal(assessment.ambiguous, true);
  assert.equal(assessment.status, 'candidate');
  assert.equal(assessment.hypotheses.length, 2);
  assert.match(assessment.evidenceAgainst[0], /Alternative/);
});

test('uses stage evidence only for an unclassified candidate, not a known cause', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Type-check',
      logText: 'A compiler failure with no catalog signature.',
    },
    catalog,
  );

  assert.equal(assessment.selected.rootCauseId, 'ROOT-UNCLASSIFIED-TYPECHECK_COMPILATION');
  assert.equal(assessment.selected.category, 'typecheck-compilation');
  assert.equal(assessment.status, 'candidate');
  assert.equal(assessment.selected.ledgerEntry, null);
});

test('treats identical occurrence evidence as the same occurrence', () => {
  const relationship = compareRootCauseOccurrences(
    {
      fingerprint: 'same',
      sourceId: 'run:job:step',
      prNumber: 57,
      rootCauseId: 'ROOT-TEST-ONE',
    },
    {
      fingerprint: 'same',
      'source-id': 'run:job:step',
      'pr-number': '57',
      'root-cause-id': 'ROOT-TEST-ONE',
    },
  );

  assert.equal(relationship.relation, 'exact-occurrence');
  assert.equal(relationship.sharedRootCause, true);
  assert.equal(relationship.score, 100);
});

test('groups classified root causes but refuses to consolidate unknowns', () => {
  const classified = compareRootCauseOccurrences(
    { rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED', status: 'confirmed' },
    {
      'root-cause-id': 'ROOT-FORMATTING-NOT-APPLIED',
      'root-cause-status': 'machine-supported',
    },
  );
  const unknown = compareRootCauseOccurrences(
    {
      rootCauseId: 'ROOT-UNCLASSIFIED-UNKNOWN',
      category: 'unknown',
      matchedSignatures: [],
    },
    {
      'root-cause-id': 'ROOT-UNCLASSIFIED-UNKNOWN',
      category: 'unknown',
      'matched-signatures': '',
    },
  );

  assert.equal(classified.relation, 'shared-root-cause');
  assert.equal(classified.sharedRootCause, true);
  assert.equal(unknown.relation, 'insufficient-evidence');
  assert.equal(unknown.sharedRootCause, false);
});

test('does not consolidate matching candidate classifications', () => {
  const relationship = compareRootCauseOccurrences(
    { rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED', status: 'candidate' },
    {
      'root-cause-id': 'ROOT-FORMATTING-NOT-APPLIED',
      'root-cause-status': 'candidate',
    },
  );

  assert.equal(relationship.relation, 'insufficient-evidence');
  assert.equal(relationship.sharedRootCause, false);
  assert.match(relationship.evidence.join(' '), /confirmed or machine-supported/);
});

test('does not declare differing candidate classifications unrelated', () => {
  const relationship = compareRootCauseOccurrences(
    { rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED', status: 'candidate' },
    {
      'root-cause-id': 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
      'root-cause-status': 'candidate',
    },
  );

  assert.equal(relationship.relation, 'insufficient-evidence');
  assert.equal(relationship.sharedRootCause, false);
});

test('marks different classified root-cause IDs unrelated', () => {
  const relationship = compareRootCauseOccurrences(
    { rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED', status: 'confirmed' },
    {
      'root-cause-id': 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
      'root-cause-status': 'machine-supported',
    },
  );

  assert.equal(relationship.relation, 'unrelated');
  assert.equal(relationship.sharedRootCause, false);
});

test('rejects a written explanation that contradicts the selected cause', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Install dependencies',
      logText: 'ERR_PNPM_OUTDATED_LOCKFILE',
    },
    catalog,
  );
  const verification = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED',
      rootCauseStatus: 'machine-supported',
      evidenceReferences: ['run-1'],
    },
    availableEvidence: ['run-1'],
  });

  assert.equal(verification.status, 'unsupported');
  assert.match(verification.errors.join(' '), /does not match/);
});

test('rejects confirmation while a competing hypothesis remains unresolved', () => {
  const assessment = {
    ambiguous: true,
    deterministic: false,
    evidenceAgainst: ['A competing cause remains.'],
    selected: { rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED' },
  };
  const verification = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED',
      rootCauseStatus: 'confirmed',
      confirmedRootCause: 'Formatting was not applied to the changed source files.',
      resolutionStatus: 'verified',
      fixCommit: 'not-applicable: formatter output was applied before the final commit',
      successfulVerification: 'Formatting and complete CI passed on the corrected head.',
      reviewerConfirmation: 'Reviewer confirmed the evidence and successful verification.',
      evidenceReferences: ['run-1'],
    },
    availableEvidence: ['run-1'],
  });

  assert.equal(verification.status, 'unsupported');
  assert.match(verification.errors.join(' '), /ambiguous hypothesis/);
});

test('supports a deterministic machine explanation without pretending to verify semantic truth', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Install dependencies',
      logText: 'ERR_PNPM_OUTDATED_LOCKFILE',
    },
    catalog,
  );
  const verification = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
      rootCauseStatus: 'machine-supported',
      evidenceReferences: ['workflow-run-1'],
    },
    availableEvidence: ['workflow-run-1'],
  });

  assert.equal(verification.status, 'supported');
  assert.equal(verification.machineEvidenceVerified, true);
  assert.equal(verification.semanticTruthVerified, false);
});

test('requires verified resolution evidence before confirming a heuristic cause', () => {
  const assessment = analyzeRootCause(
    {
      stepName: 'Check formatting',
      logText: 'Code style issues found',
    },
    catalog,
  );
  const incomplete = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED',
      rootCauseStatus: 'confirmed',
      confirmedRootCause: 'Formatting was not applied.',
      resolutionStatus: 'unverified',
      fixCommit: 'not-applicable: metadata correction',
      successfulVerification: 'Pending.',
      reviewerConfirmation: 'Pending.',
      evidenceReferences: ['run-1'],
    },
    availableEvidence: ['run-1'],
  });
  const complete = verifyRootCauseExplanation({
    assessment,
    diagnosis: {
      rootCauseId: 'ROOT-FORMATTING-NOT-APPLIED',
      rootCauseStatus: 'confirmed',
      confirmedRootCause: 'Changed files were not processed by the repository formatter.',
      resolutionStatus: 'verified',
      fixCommit: 'not-applicable: formatter artifact was applied before the final commit',
      successfulVerification: 'Formatting check and complete CI passed on the final source head.',
      reviewerConfirmation: 'Reviewer confirmed the formatter artifact and final successful run.',
      evidenceReferences: ['run-1'],
    },
    availableEvidence: ['run-1'],
  });

  assert.equal(incomplete.status, 'unsupported');
  assert.equal(complete.status, 'supported');
  assert.equal(complete.semanticTruthVerified, false);
});

test('blocks a false none outcome when observable failure evidence exists', () => {
  const decision = evaluateLearningOutcome({
    declaredOutcome: 'none',
    failedRuns: [{ id: 1 }],
    linkedIssues: [{ number: 2 }],
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.evidenceCount, 2);
  assert.match(decision.errors[0], /cannot be none/);
});

test('allows none only when no observable evidence exists', () => {
  const decision = evaluateLearningOutcome({ declaredOutcome: 'none' });

  assert.equal(decision.allowed, true);
  assert.equal(decision.evidenceCount, 0);
});

test('rejects duplicate catalog identifiers and ledger entries', () => {
  const duplicated = createRootCause({
    id: 'ROOT-TEST-DUPLICATE',
    ledgerEntry: 'EL-9999',
  });
  const duplicateId = createRootCause({
    id: 'ROOT-TEST-DUPLICATE',
    ledgerEntry: 'EL-9998',
  });

  assert.throws(
    () => validateRootCauseCatalog(createCatalog([duplicated, duplicateId])),
    /Duplicate root-cause ID/,
  );
  assert.throws(
    () =>
      validateRootCauseCatalog(
        createCatalog([
          duplicated,
          createRootCause({ id: 'ROOT-TEST-OTHER', ledgerEntry: 'EL-9999' }),
        ]),
      ),
    /Duplicate ledger entry/,
  );
});
