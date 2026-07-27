export const CONFIDENCE_POLICY = Object.freeze({
  version: 'CONFIDENCE-1.0.0',
  scoreRange: Object.freeze({ minimum: 0, maximum: 100 }),
  bands: Object.freeze({ high: 80, medium: 60 }),
  evidenceQuality: Object.freeze({
    verifiedCoverage: 35,
    sourceDiversity: 20,
    primaryDurable: 15,
    provenanceCompleteness: 15,
    requiredRoleCoverage: 15,
    contradictionPenalty: 20,
    unavailablePenalty: 10,
    claimedOnlyCap: 49,
  }),
  rootCause: Object.freeze({
    assessmentWeight: 0.75,
    evidenceQualityWeight: 0.25,
    unclassifiedCap: 49,
    missingEvidenceSetCap: 49,
    ambiguousCap: 59,
    contradictionCap: 39,
    candidateCap: 69,
    missingEvidenceCap: 79,
  }),
  duplicate: Object.freeze({
    insufficientEvidenceCap: 60,
    unverifiedSharedRootCap: 70,
  }),
  explanation: Object.freeze({
    challengedCap: 79,
    rejectedCap: 39,
    contradictionCap: 39,
  }),
  automation: Object.freeze({
    completenessWeight: 35,
    validationWeight: 20,
    exactFilesWeight: 15,
    executableEnforcementWeight: 15,
    verificationWeight: 10,
    governanceWeight: 5,
    incompleteCap: 49,
    candidateExecutableCap: 79,
    unverifiedFilesCap: 89,
    unverifiedGovernanceCap: 94,
  }),
  requiredAutomationControlTypes: Object.freeze([
    'ci-check',
    'pr-checklist',
    'review-checklist',
    'coding-standard',
    'verification-rule',
    'static-analysis-rule',
    'test-template',
  ]),
  executableAutomationControlTypes: Object.freeze(['ci-check', 'static-analysis-rule']),
});

export const CONFIDENCE_MEANINGS = Object.freeze({
  rootCauseConfidence:
    'Evidence support for the selected root-cause classification under the current policy; not a probability of truth.',
  duplicateConfidence:
    'Evidence support that this finding is the same occurrence or shares a verified root cause with another finding; not a probability.',
  evidenceQuality:
    'Quality and completeness of the evidence set, including verification, diversity, provenance, required roles, and contradictions.',
  explanationConfidence:
    'Evidence support for the written causal explanation after required proof roles and competing explanations are evaluated; not a probability.',
  automationConfidence:
    'Evidence support that prevention controls are complete, current, enforceable, verified, and governed; not a probability.',
});
