import { CONFIDENCE_MEANINGS, CONFIDENCE_POLICY } from './confidence-scoring-policy.mjs';
import {
  applyCaps,
  asArray,
  clampScore,
  inputDigest,
  metric,
  normalizeEvidence,
  normalizeString,
  qualityLabel,
  stableStringify,
  uniqueStrings,
} from './confidence-scoring-support.mjs';

function evidenceQuality(evidenceRecords, requiredRoles = []) {
  const evidence = asArray(evidenceRecords).map(normalizeEvidence);
  if (evidence.length === 0) {
    return metric({
      score: 0,
      status: 'insufficient-evidence',
      meaning: CONFIDENCE_MEANINGS.evidenceQuality,
      missingEvidence: ['evidence-records'],
      extra: { level: 'Insufficient' },
    });
  }

  const verified = evidence.filter((item) => item.status === 'verified');
  const contradictory = evidence.filter((item) => item.status === 'contradictory');
  const unavailable = evidence.filter((item) => item.status === 'unavailable');
  const verifiedRatio = verified.length / evidence.length;
  const verifiedTypes = new Set(verified.map((item) => item.type));
  const primaryDurable = verified.filter((item) => item.primary && item.durable).length;
  const provenanceComplete = verified.filter((item) => item.provenanceComplete).length;
  const observedRoles = new Set(verified.flatMap((item) => item.roles));
  const normalizedRequiredRoles = uniqueStrings(requiredRoles);
  const coveredRoles = normalizedRequiredRoles.filter((role) => observedRoles.has(role));

  let score =
    verifiedRatio * CONFIDENCE_POLICY.evidenceQuality.verifiedCoverage +
    Math.min(1, verifiedTypes.size / 3) * CONFIDENCE_POLICY.evidenceQuality.sourceDiversity +
    (verified.length === 0 ? 0 : primaryDurable / verified.length) *
      CONFIDENCE_POLICY.evidenceQuality.primaryDurable +
    (verified.length === 0 ? 0 : provenanceComplete / verified.length) *
      CONFIDENCE_POLICY.evidenceQuality.provenanceCompleteness +
    (normalizedRequiredRoles.length === 0
      ? CONFIDENCE_POLICY.evidenceQuality.requiredRoleCoverage
      : (coveredRoles.length / normalizedRequiredRoles.length) *
        CONFIDENCE_POLICY.evidenceQuality.requiredRoleCoverage);
  score -= Math.min(
    40,
    contradictory.length * CONFIDENCE_POLICY.evidenceQuality.contradictionPenalty,
  );
  score -= Math.min(20, unavailable.length * CONFIDENCE_POLICY.evidenceQuality.unavailablePenalty);

  const caps = [
    {
      id: 'claimed-only',
      applies: verified.length === 0,
      maximum: CONFIDENCE_POLICY.evidenceQuality.claimedOnlyCap,
      reason: 'No evidence record is verified.',
    },
  ];
  const capped = applyCaps(score, caps);
  const missing = [
    ...(verified.length === 0 ? ['verified-evidence'] : []),
    ...(normalizedRequiredRoles.length > coveredRoles.length
      ? normalizedRequiredRoles
          .filter((role) => !observedRoles.has(role))
          .map((role) => `role:${role}`)
      : []),
  ];
  const status =
    contradictory.length > 0 ? 'contradicted' : missing.length > 0 ? 'partial' : 'scored';
  return metric({
    score: capped.score,
    status,
    meaning: CONFIDENCE_MEANINGS.evidenceQuality,
    evidenceRefs: verified.map((item) => item.id),
    missingEvidence: missing,
    capsApplied: capped.capsApplied,
    extra: {
      level: qualityLabel(capped.score, status === 'insufficient-evidence' ? status : 'scored'),
      verifiedCount: verified.length,
      evidenceCount: evidence.length,
      sourceTypeCount: verifiedTypes.size,
      contradictionCount: contradictory.length,
      unavailableCount: unavailable.length,
    },
  });
}

function rootCauseConfidence(input, quality) {
  const assessment = input.rootCauseAssessment;
  const selected = assessment?.selected;
  if (selected === undefined || selected === null) {
    return metric({
      score: 0,
      status: 'insufficient-evidence',
      meaning: CONFIDENCE_MEANINGS.rootCauseConfidence,
      missingEvidence: ['root-cause-assessment'],
    });
  }
  const rootCauseId = normalizeString(selected.rootCauseId);
  const assessmentScore = clampScore(selected.score);
  const raw =
    assessmentScore * CONFIDENCE_POLICY.rootCause.assessmentWeight +
    quality.score * CONFIDENCE_POLICY.rootCause.evidenceQualityWeight;
  const contradictory =
    quality.status === 'contradicted' || asArray(assessment?.contradictions).length > 0;
  const missing = uniqueStrings([
    ...asArray(assessment?.missingEvidence),
    ...asArray(selected.missingEvidence),
    ...(quality.status === 'insufficient-evidence' ? quality.missingEvidence : []),
  ]);
  const caps = [
    {
      id: 'unclassified-root-cause',
      applies: rootCauseId.length === 0 || rootCauseId.startsWith('ROOT-UNCLASSIFIED-'),
      maximum: CONFIDENCE_POLICY.rootCause.unclassifiedCap,
      reason: 'The selected root cause is absent or unclassified.',
    },
    {
      id: 'ambiguous-root-cause',
      applies: assessment?.ambiguous === true,
      maximum: CONFIDENCE_POLICY.rootCause.ambiguousCap,
      reason: 'A competing root-cause hypothesis remains within the ambiguity threshold.',
    },
    {
      id: 'missing-root-cause-evidence-set',
      applies: quality.status === 'insufficient-evidence',
      maximum: CONFIDENCE_POLICY.rootCause.missingEvidenceSetCap,
      reason: 'The canonical evidence set for the root-cause assessment is absent.',
    },
    {
      id: 'contradictory-root-cause-evidence',
      applies: contradictory,
      maximum: CONFIDENCE_POLICY.rootCause.contradictionCap,
      reason: 'Contradictory root-cause evidence remains unresolved.',
    },
    {
      id: 'candidate-root-cause',
      applies: assessment?.status !== 'machine-supported' && selected.deterministic !== true,
      maximum: CONFIDENCE_POLICY.rootCause.candidateCap,
      reason: 'The root-cause classification remains a candidate.',
    },
    {
      id: 'missing-root-cause-evidence',
      applies: missing.length > 0,
      maximum: CONFIDENCE_POLICY.rootCause.missingEvidenceCap,
      reason: 'The root-cause assessment declares missing evidence.',
    },
  ];
  const capped = applyCaps(raw, caps);
  return metric({
    score: capped.score,
    status: contradictory ? 'contradicted' : missing.length > 0 ? 'partial' : 'scored',
    meaning: CONFIDENCE_MEANINGS.rootCauseConfidence,
    evidenceRefs: [...asArray(selected.matchedSignatures), ...quality.evidenceRefs],
    missingEvidence: missing,
    capsApplied: capped.capsApplied,
    extra: { rootCauseId: rootCauseId || null },
  });
}

function duplicateConfidence(input) {
  const comparison = input.duplicateAssessment;
  if (comparison === undefined || comparison === null) {
    return metric({
      score: 0,
      status: 'insufficient-evidence',
      meaning: CONFIDENCE_MEANINGS.duplicateConfidence,
      missingEvidence: ['duplicate-assessment'],
      extra: { relation: 'unknown', sharedRootCause: false },
    });
  }
  const relation = normalizeString(comparison.relation) || 'unknown';
  const caps = [
    {
      id: 'duplicate-insufficient-evidence',
      applies: relation === 'insufficient-evidence',
      maximum: CONFIDENCE_POLICY.duplicate.insufficientEvidenceCap,
      reason: 'The duplicate relationship is not established by verified classification evidence.',
    },
    {
      id: 'duplicate-unverified-shared-root',
      applies: comparison.sharedRootCause !== true && Number(comparison.score) >= 70,
      maximum: CONFIDENCE_POLICY.duplicate.unverifiedSharedRootCap,
      reason: 'Shared-root consolidation is not verified.',
    },
  ];
  const capped = applyCaps(comparison.score, caps);
  return metric({
    score: capped.score,
    status: relation === 'insufficient-evidence' ? 'insufficient-evidence' : 'scored',
    meaning: CONFIDENCE_MEANINGS.duplicateConfidence,
    evidenceRefs: asArray(comparison.evidence),
    missingEvidence:
      relation === 'insufficient-evidence' ? ['verified-duplicate-or-unrelated-decision'] : [],
    capsApplied: capped.capsApplied,
    extra: {
      relation,
      sharedRootCause: comparison.sharedRootCause === true,
    },
  });
}

function explanationConfidence(input) {
  const verification = input.explanationVerification;
  if (verification === undefined || verification === null) {
    return metric({
      score: 0,
      status: 'insufficient-evidence',
      meaning: CONFIDENCE_MEANINGS.explanationConfidence,
      missingEvidence: ['explanation-verification'],
    });
  }
  const status = normalizeString(verification.status) || 'challenged';
  const contradictions = asArray(verification.contradictions);
  const missing = uniqueStrings([
    ...asArray(verification.missingEvidence),
    ...asArray(verification.challenges),
  ]);
  const caps = [
    {
      id: 'challenged-explanation',
      applies: status === 'challenged',
      maximum: CONFIDENCE_POLICY.explanation.challengedCap,
      reason: 'The explanation remains challenged.',
    },
    {
      id: 'rejected-explanation',
      applies: status === 'rejected',
      maximum: CONFIDENCE_POLICY.explanation.rejectedCap,
      reason: 'The explanation was rejected.',
    },
    {
      id: 'contradictory-explanation-evidence',
      applies: contradictions.length > 0,
      maximum: CONFIDENCE_POLICY.explanation.contradictionCap,
      reason: 'Contradictory explanation evidence remains unresolved.',
    },
  ];
  const capped = applyCaps(verification.confidenceScore, caps);
  return metric({
    score: capped.score,
    status,
    meaning: CONFIDENCE_MEANINGS.explanationConfidence,
    evidenceRefs: uniqueStrings([
      ...asArray(verification.questions?.evidenceSupport?.evidenceIds),
      ...asArray(verification.questions?.proofLog?.evidenceIds),
      ...asArray(verification.questions?.introducingCommit?.evidenceIds),
      ...asArray(verification.questions?.reproducingTest?.evidenceIds),
    ]),
    missingEvidence: missing,
    capsApplied: capped.capsApplied,
  });
}

function automationConfidence(input) {
  const automation = input.automationAssessment;
  const pack = automation?.pack;
  if (pack === undefined || pack === null) {
    return metric({
      score: 0,
      status: 'insufficient-evidence',
      meaning: CONFIDENCE_MEANINGS.automationConfidence,
      missingEvidence: ['prevention-pack'],
    });
  }
  const controls = asArray(pack.controls);
  const byType = new Map(controls.map((control) => [control.type, control]));
  const requiredTypes = CONFIDENCE_POLICY.requiredAutomationControlTypes;
  const present = requiredTypes.filter((type) => byType.has(type));
  const validationErrors = uniqueStrings(automation.validationErrors);
  const exactFilesCurrent = automation.exactFilesCurrent === true;
  const governancePassed = automation.governancePassed === true;
  const executableTypes = CONFIDENCE_POLICY.executableAutomationControlTypes;
  const enforcedExecutable = executableTypes.filter(
    (type) => byType.get(type)?.state === 'enforced',
  );
  const verifiedControls = controls.filter(
    (control) => asArray(control.verificationRefs).length > 0,
  );

  const raw =
    (present.length / requiredTypes.length) * CONFIDENCE_POLICY.automation.completenessWeight +
    (validationErrors.length === 0 && present.length === requiredTypes.length
      ? CONFIDENCE_POLICY.automation.validationWeight
      : 0) +
    (exactFilesCurrent ? CONFIDENCE_POLICY.automation.exactFilesWeight : 0) +
    (enforcedExecutable.length / executableTypes.length) *
      CONFIDENCE_POLICY.automation.executableEnforcementWeight +
    (controls.length === 0 ? 0 : verifiedControls.length / controls.length) *
      CONFIDENCE_POLICY.automation.verificationWeight +
    (governancePassed ? CONFIDENCE_POLICY.automation.governanceWeight : 0);

  const missingTypes = requiredTypes.filter((type) => !byType.has(type));
  const candidateExecutable = executableTypes.filter(
    (type) => byType.get(type)?.state !== 'enforced',
  );
  const caps = [
    {
      id: 'incomplete-prevention-pack',
      applies: missingTypes.length > 0 || validationErrors.length > 0,
      maximum: CONFIDENCE_POLICY.automation.incompleteCap,
      reason: 'The prevention pack is incomplete or invalid.',
    },
    {
      id: 'candidate-executable-controls',
      applies: candidateExecutable.length > 0,
      maximum: CONFIDENCE_POLICY.automation.candidateExecutableCap,
      reason: 'One or more executable prevention controls remain candidates.',
    },
    {
      id: 'unverified-generated-files',
      applies: !exactFilesCurrent,
      maximum: CONFIDENCE_POLICY.automation.unverifiedFilesCap,
      reason: 'The exact generated prevention files are not verified current.',
    },
    {
      id: 'unverified-prevention-governance',
      applies: !governancePassed,
      maximum: CONFIDENCE_POLICY.automation.unverifiedGovernanceCap,
      reason: 'Exact Prevention Engine governance has not passed.',
    },
  ];
  const capped = applyCaps(raw, caps);
  return metric({
    score: capped.score,
    status:
      missingTypes.length > 0 || validationErrors.length > 0
        ? 'incomplete'
        : candidateExecutable.length > 0 || !exactFilesCurrent || !governancePassed
          ? 'partial'
          : 'scored',
    meaning: CONFIDENCE_MEANINGS.automationConfidence,
    evidenceRefs: uniqueStrings([
      ...controls.map((control) => control.id),
      ...controls.flatMap((control) => asArray(control.verificationRefs)),
    ]),
    missingEvidence: uniqueStrings([
      ...missingTypes.map((type) => `control:${type}`),
      ...validationErrors.map((error) => `validation:${error}`),
      ...candidateExecutable.map((type) => `enforced:${type}`),
      ...(!exactFilesCurrent ? ['exact-generated-files'] : []),
      ...(!governancePassed ? ['exact-governance-success'] : []),
    ]),
    capsApplied: capped.capsApplied,
    extra: {
      packId: pack.id ?? null,
      packRevision: pack.revision ?? null,
      controlCount: controls.length,
      enforcedExecutableCount: enforcedExecutable.length,
    },
  });
}

export function scoreConfidenceEnvelope(input = {}) {
  const normalizedInput = {
    finding: input.finding ?? null,
    rootCauseAssessment: input.rootCauseAssessment ?? null,
    duplicateAssessment: input.duplicateAssessment ?? null,
    evidenceRecords: asArray(input.evidenceRecords).map(normalizeEvidence),
    requiredEvidenceRoles: uniqueStrings(input.requiredEvidenceRoles),
    explanationVerification: input.explanationVerification ?? null,
    automationAssessment: input.automationAssessment ?? null,
  };
  const quality = evidenceQuality(
    normalizedInput.evidenceRecords,
    normalizedInput.requiredEvidenceRoles,
  );
  const envelope = {
    schemaVersion: 1,
    policyVersion: CONFIDENCE_POLICY.version,
    inputDigest: inputDigest(normalizedInput),
    rootCauseConfidence: rootCauseConfidence(normalizedInput, quality),
    duplicateConfidence: duplicateConfidence(normalizedInput),
    evidenceQuality: quality,
    explanationConfidence: explanationConfidence(normalizedInput),
    automationConfidence: automationConfidence(normalizedInput),
  };
  return envelope;
}

export function validateConfidenceEnvelope(input, envelope) {
  const expected = scoreConfidenceEnvelope(input);
  const errors = [];
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return ['Confidence envelope is missing or invalid.'];
  }
  if (envelope.schemaVersion !== expected.schemaVersion) {
    errors.push(`Confidence schema version must be ${expected.schemaVersion}.`);
  }
  if (envelope.policyVersion !== expected.policyVersion) {
    errors.push(`Confidence policy version must be ${expected.policyVersion}.`);
  }
  if (envelope.inputDigest !== expected.inputDigest) {
    errors.push('Confidence input digest does not match the recalculated input.');
  }
  for (const key of [
    'rootCauseConfidence',
    'duplicateConfidence',
    'evidenceQuality',
    'explanationConfidence',
    'automationConfidence',
  ]) {
    if (stableStringify(envelope[key]) !== stableStringify(expected[key])) {
      errors.push(`${key} does not match the recalculated score.`);
    }
  }
  return errors;
}
