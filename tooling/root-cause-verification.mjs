const UNCLASSIFIED_PREFIX = 'ROOT-UNCLASSIFIED-';

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isClassifiedRootCause(rootCauseId) {
  return (
    typeof rootCauseId === 'string' &&
    rootCauseId.length > 0 &&
    !rootCauseId.startsWith(UNCLASSIFIED_PREFIX)
  );
}

export function verifyRootCauseExplanation({ assessment, diagnosis, availableEvidence = [] }) {
  const errors = [];
  const warnings = [];
  const selected = assessment?.selected;
  if (selected === undefined) {
    errors.push('No selected root-cause assessment is available.');
  }

  const rootCauseId = diagnosis?.rootCauseId;
  if (selected !== undefined && rootCauseId !== selected.rootCauseId) {
    errors.push(
      'The written root-cause ID does not match the selected evidence-backed hypothesis.',
    );
  }
  if (!isClassifiedRootCause(rootCauseId)) {
    errors.push('An unclassified root cause cannot be verified as confirmed.');
  }

  const rootCauseStatus = diagnosis?.rootCauseStatus;
  if (!['confirmed', 'machine-supported'].includes(rootCauseStatus)) {
    errors.push('Root-cause status must be confirmed or machine-supported.');
  }
  if (rootCauseStatus === 'machine-supported') {
    if (assessment?.deterministic !== true || assessment?.evidenceAgainst?.length > 0) {
      errors.push(
        'Machine-supported status requires deterministic evidence without contradictions.',
      );
    }
  }
  if (rootCauseStatus === 'confirmed') {
    if (assessment?.ambiguous === true) {
      errors.push(
        'An ambiguous hypothesis cannot be confirmed until the competing cause is resolved.',
      );
    }
    if (String(diagnosis?.confirmedRootCause ?? '').trim().length < 12) {
      errors.push('Confirmed root cause must contain a specific evidence-backed explanation.');
    }
    if (diagnosis?.resolutionStatus !== 'verified') {
      errors.push('Confirmed root cause requires a verified resolution status.');
    }
    if (String(diagnosis?.successfulVerification ?? '').trim().length < 12) {
      errors.push('Confirmed root cause requires successful verification evidence.');
    }
    if (String(diagnosis?.reviewerConfirmation ?? '').trim().length < 8) {
      errors.push('Confirmed root cause requires reviewer confirmation.');
    }
    const fixCommit = String(diagnosis?.fixCommit ?? '');
    if (!/^[0-9a-f]{40}$/i.test(fixCommit) && !fixCommit.startsWith('not-applicable:')) {
      errors.push('Fix commit must be a full SHA or an explicit not-applicable explanation.');
    }
  }

  const evidenceReferences = unique(diagnosis?.evidenceReferences ?? []);
  if (availableEvidence.length > 0) {
    const missingReferences = evidenceReferences.filter(
      (reference) => !availableEvidence.includes(reference),
    );
    if (missingReferences.length > 0) {
      errors.push(
        `Written explanation references unavailable evidence: ${missingReferences.join(', ')}.`,
      );
    }
  }
  if (evidenceReferences.length === 0) {
    warnings.push('No explicit evidence references were supplied to the explanation verifier.');
  }
  if (assessment?.ambiguous === true) {
    warnings.push('The selected cause has a competing hypothesis and still requires human review.');
  }

  return {
    errors,
    machineEvidenceVerified:
      rootCauseStatus === 'machine-supported' &&
      assessment?.deterministic === true &&
      assessment?.evidenceAgainst?.length === 0,
    semanticTruthVerified: false,
    status:
      errors.length > 0 ? 'unsupported' : warnings.length > 0 ? 'partially-supported' : 'supported',
    warnings,
  };
}

export function evaluateLearningOutcome({
  declaredOutcome,
  observableEvents = [],
  failedRuns = [],
  linkedIssues = [],
}) {
  const evidenceCount = observableEvents.length + failedRuns.length + linkedIssues.length;
  const errors = [];
  const warnings = [];

  if (!['new', 'existing', 'none'].includes(declaredOutcome)) {
    errors.push('Learning outcome must be new, existing, or none.');
  }
  if (declaredOutcome === 'none' && evidenceCount > 0) {
    errors.push(
      `Learning outcome cannot be none while ${evidenceCount} observable failure occurrence(s) exist.`,
    );
  }
  if ((declaredOutcome === 'new' || declaredOutcome === 'existing') && evidenceCount === 0) {
    warnings.push('A learning outcome was declared without observable linked failure evidence.');
  }

  return {
    allowed: errors.length === 0,
    errors,
    evidenceCount,
    warnings,
  };
}
