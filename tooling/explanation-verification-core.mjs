import {
  REQUIRED_ROLES,
  asArray,
  confidenceBand,
  normalizeEvidence,
  normalizeString,
  roleScore,
  strongestAlternative,
  unique,
  verifyRole,
} from './explanation-verification-support.mjs';

export function verifyExplanation({ assessment, explanation, evidence = [] }) {
  if (explanation === null || typeof explanation !== 'object' || Array.isArray(explanation)) {
    throw new TypeError('Explanation must be an object.');
  }

  const normalizedEvidence = evidence.map(normalizeEvidence);
  const evidenceById = new Map();
  for (const item of normalizedEvidence) {
    if (evidenceById.has(item.id)) {
      throw new TypeError(`Duplicate evidence ID: ${item.id}.`);
    }
    evidenceById.set(item.id, item);
  }

  const rootCauseId = normalizeString(explanation.rootCauseId);
  const selectedRootCauseId = normalizeString(assessment?.selected?.rootCauseId);
  const statement = normalizeString(explanation.statement);
  const referencedIds = unique(asArray(explanation.evidenceReferences).map(normalizeString));
  const referencedEvidence = referencedIds.map((id) => evidenceById.get(id)).filter(Boolean);
  const unavailableReferences = referencedIds.filter((id) => !evidenceById.has(id));
  const supportingEvidence = normalizedEvidence.filter(
    (item) => item.status === 'verified' && item.supports.includes(rootCauseId),
  );
  const contradictoryEvidence = normalizedEvidence.filter(
    (item) =>
      (item.status === 'verified' || item.status === 'contradictory') &&
      item.contradicts.includes(rootCauseId),
  );
  const alternative = strongestAlternative(assessment, rootCauseId, normalizedEvidence);
  const alternativeReviewed = explanation.alternativesReviewed === true;
  const alternativeMoreLikely =
    alternative.alternative !== null &&
    alternative.alternative.adjustedScore > alternative.selectedScore;
  const alternativeUnresolved =
    alternative.alternative !== null &&
    (alternative.scoreDelta === null || alternative.scoreDelta <= 5 || !alternativeReviewed);

  const roles = Object.fromEntries(
    REQUIRED_ROLES.map((role) => [
      role,
      verifyRole({ role, explanation, evidenceById, rootCauseId }),
    ]),
  );

  const errors = [];
  const challenges = [];
  if (rootCauseId.length === 0 || rootCauseId !== selectedRootCauseId) {
    errors.push('The explanation does not match the selected evidence-backed root cause.');
  }
  if (statement.length < 12) {
    challenges.push('The explanation statement is not specific enough to verify.');
  }
  if (referencedIds.length === 0) {
    challenges.push('The explanation cites no evidence.');
  }
  if (unavailableReferences.length > 0) {
    challenges.push(`Unavailable evidence references: ${unavailableReferences.join(', ')}.`);
  }
  if (supportingEvidence.length === 0) {
    challenges.push('No verified evidence supports the selected root cause.');
  }
  if (contradictoryEvidence.length > 0) {
    errors.push(
      `Unresolved contradictory evidence: ${contradictoryEvidence.map((item) => item.id).join(', ')}.`,
    );
  }
  if (alternativeMoreLikely) {
    errors.push(
      `Alternative ${alternative.alternative.rootCauseId} is more strongly supported than ${rootCauseId}.`,
    );
  } else if (alternativeUnresolved || assessment?.ambiguous === true) {
    challenges.push('A competing explanation remains unresolved or has not been reviewed.');
  }
  for (const [role, result] of Object.entries(roles)) {
    if (!['verified', 'approved-exception'].includes(result.answer)) {
      challenges.push(`${role}: ${result.reason}`);
    }
  }

  const hypothesisScore = Math.max(0, Math.min(20, Math.round(alternative.selectedScore * 0.2)));
  const supportKinds = new Set(supportingEvidence.map((item) => item.type));
  const supportScore = Math.min(20, supportKinds.size * 10);
  const referenceScore =
    referencedIds.length === 0
      ? 0
      : Math.round(
          (referencedEvidence.filter((item) => item.status === 'verified').length /
            referencedIds.length) *
            10,
        );
  let score =
    hypothesisScore +
    supportScore +
    referenceScore +
    roleScore(roles.proofLog.answer) +
    roleScore(roles.introducedByCommit.answer) +
    roleScore(roles.reproducingTest.answer) +
    (alternative.alternative === null || (alternativeReviewed && (alternative.scoreDelta ?? 0) > 5)
      ? 5
      : 0);
  score -= Math.min(30, contradictoryEvidence.length * 15);
  score -= Math.min(20, unavailableReferences.length * 5);
  score = Math.max(0, Math.min(100, score));

  if (
    REQUIRED_ROLES.some((role) => !['verified', 'approved-exception'].includes(roles[role].answer))
  ) {
    score = Math.min(score, 49);
  }
  if (alternativeUnresolved || assessment?.ambiguous === true) {
    score = Math.min(score, 59);
  }
  if (contradictoryEvidence.length > 0) {
    score = Math.min(score, 39);
  }
  if (alternativeMoreLikely || rootCauseId !== selectedRootCauseId) {
    score = Math.min(score, 29);
  }

  const status =
    errors.length > 0
      ? 'rejected'
      : challenges.length > 0 || score < 80
        ? 'challenged'
        : 'accepted';
  const evidenceAnswer =
    contradictoryEvidence.length > 0
      ? 'contradicted'
      : supportingEvidence.length > 0
        ? 'supported'
        : 'insufficient';
  const alternativeAnswer =
    alternative.alternative === null
      ? 'no-alternative'
      : alternativeMoreLikely
        ? 'alternative-more-likely'
        : alternativeUnresolved
          ? 'unresolved'
          : 'selected-more-likely';

  return {
    status,
    confidenceScore: score,
    confidenceBand: confidenceBand(score),
    confidenceMeaning: 'Evidence-support score, not a statistical probability of truth.',
    errors,
    challenges,
    unsupportedClaims: unique([...unavailableReferences, ...challenges]),
    contradictions: contradictoryEvidence.map((item) => item.id),
    missingEvidence: challenges,
    strongestAlternative:
      alternative.alternative === null
        ? null
        : {
            rootCauseId: alternative.alternative.rootCauseId,
            score: alternative.alternative.adjustedScore,
            selectedScore: alternative.selectedScore,
            scoreDelta: alternative.scoreDelta,
          },
    questions: {
      evidenceSupport: {
        answer: evidenceAnswer,
        evidenceIds: supportingEvidence.map((item) => item.id),
      },
      alternativeLikelihood: {
        answer: alternativeAnswer,
        reviewed: alternativeReviewed,
        rootCauseId: alternative.alternative?.rootCauseId ?? null,
        scoreDelta: alternative.scoreDelta,
      },
      proofLog: roles.proofLog,
      introducingCommit: roles.introducedByCommit,
      reproducingTest: roles.reproducingTest,
      confidence: {
        score,
        band: confidenceBand(score),
        meaning: 'Evidence-support score, not a statistical probability of truth.',
      },
    },
  };
}
