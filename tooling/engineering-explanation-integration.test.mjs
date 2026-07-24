import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEventExplanationInput,
  ensureExplanationSection,
  parseExplanationEvidenceRecord,
  renderExplanationEvidenceRecord,
  renderExplanationSection,
} from './explanation-verification.mjs';

function event() {
  return {
    rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
    rootCauseCandidate: 'The dependency manifest changed without the generated lockfile.',
    rootCauseAssessment: {
      ambiguous: false,
      selected: {
        rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
        score: 100,
      },
      hypotheses: [
        { rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED', score: 100 },
        { rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE', score: 30 },
      ],
    },
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE'],
    workflowRunId: 10,
    jobId: 11,
    stepName: 'Install dependencies',
  };
}

function changedEvent() {
  return {
    ...event(),
    rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE',
    rootCauseCandidate: 'The selected package versions have incompatible peer requirements.',
    rootCauseAssessment: {
      ambiguous: false,
      selected: {
        rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE',
        score: 95,
      },
      hypotheses: [
        { rootCauseId: 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE', score: 95 },
        { rootCauseId: 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED', score: 35 },
      ],
    },
    matchedSignatures: ['ERR_PNPM_PEER_DEP_ISSUES'],
  };
}

test('adds a machine-readable challenged explanation section to a new learning issue', () => {
  const section = renderExplanationSection(event());
  const body = ensureExplanationSection('# Issue', section);
  const record = parseExplanationEvidenceRecord(body);

  assert.equal(record.explanation.rootCauseId, 'ROOT-DEPENDENCY-LOCKFILE-OUTDATED');
  assert.equal(record.explanation.review.status, 'unreviewed');
  assert.match(body, /Explanation decision: `challenged`/);
  assert.match(body, /Which log proves this\?: verified/);
  assert.match(body, /Which commit introduced it\?: missing/);
  assert.match(body, /Which test reproduces it\?: missing/);
});

test('refreshes an unreviewed generated explanation when later graph evidence changes the cause', () => {
  const original = renderExplanationSection(event());
  const result = ensureExplanationSection(
    `# Issue\n\n${original}`,
    renderExplanationSection(changedEvent()),
  );
  const record = parseExplanationEvidenceRecord(result);

  assert.equal((result.match(/<!-- newax-explanation-verification -->/g) ?? []).length, 1);
  assert.equal(record.explanation.rootCauseId, 'ROOT-DEPENDENCY-PEER-INCOMPATIBLE');
  assert.doesNotMatch(result, /The dependency manifest changed without the generated lockfile/);
});

test('does not overwrite a machine-readable explanation after explicit review', () => {
  const record = createEventExplanationInput(event());
  record.explanation.review = {
    status: 'reviewed',
    reviewedBy: 'engineering-reviewer',
    reviewedAt: '2026-07-17T12:00:00.000Z',
  };
  const reviewed = `<!-- newax-explanation-verification -->
${renderExplanationEvidenceRecord(record)}
reviewed evidence
<!-- /newax-explanation-verification -->`;
  const result = ensureExplanationSection(
    `# Issue\n\n${reviewed}`,
    renderExplanationSection(changedEvent()),
  );

  assert.equal((result.match(/<!-- newax-explanation-verification -->/g) ?? []).length, 1);
  assert.match(result, /reviewed evidence/);
  assert.equal(
    parseExplanationEvidenceRecord(result).explanation.rootCauseId,
    'ROOT-DEPENDENCY-LOCKFILE-OUTDATED',
  );
});
