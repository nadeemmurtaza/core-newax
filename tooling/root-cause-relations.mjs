const UNCLASSIFIED_PREFIX = 'ROOT-UNCLASSIFIED-';

function isClassifiedRootCause(rootCauseId) {
  return (
    typeof rootCauseId === 'string' &&
    rootCauseId.length > 0 &&
    !rootCauseId.startsWith(UNCLASSIFIED_PREFIX)
  );
}

function isVerifiedStatus(status) {
  return status === 'confirmed' || status === 'machine-supported';
}

function normalizeOccurrence(value) {
  const matchedSignatures = Array.isArray(value?.matchedSignatures)
    ? value.matchedSignatures
    : String(value?.['matched-signatures'] ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    category: value?.category ?? value?.['failure-category'] ?? null,
    fingerprint: value?.fingerprint ?? null,
    matchedSignatures,
    prNumber: String(value?.prNumber ?? value?.['pr-number'] ?? 'none'),
    rootCauseId: value?.rootCauseId ?? value?.['root-cause-id'] ?? null,
    sourceId: String(value?.sourceId ?? value?.['source-id'] ?? 'none'),
    status: value?.status ?? value?.['root-cause-status'] ?? 'candidate',
  };
}

export function compareRootCauseOccurrences(currentValue, previousValue) {
  const current = normalizeOccurrence(currentValue);
  const previous = normalizeOccurrence(previousValue);
  const evidence = [];

  if (
    current.fingerprint !== null &&
    current.fingerprint === previous.fingerprint &&
    current.sourceId === previous.sourceId &&
    current.prNumber === previous.prNumber
  ) {
    return {
      evidence: ['Fingerprint, source occurrence, and pull request are identical.'],
      relation: 'exact-occurrence',
      score: 100,
      sharedRootCause: true,
    };
  }

  const currentClassified = isClassifiedRootCause(current.rootCauseId);
  const previousClassified = isClassifiedRootCause(previous.rootCauseId);
  const bothVerified = isVerifiedStatus(current.status) && isVerifiedStatus(previous.status);

  if (currentClassified && previousClassified && current.rootCauseId === previous.rootCauseId) {
    evidence.push(`Both occurrences use classified root-cause ID ${current.rootCauseId}.`);
    if (bothVerified) {
      return {
        evidence,
        relation: 'shared-root-cause',
        score: 95,
        sharedRootCause: true,
      };
    }
    return {
      evidence: [
        ...evidence,
        'Both occurrences must be confirmed or machine-supported before root-cause consolidation.',
      ],
      relation: 'insufficient-evidence',
      score: 70,
      sharedRootCause: false,
    };
  }

  if (currentClassified && previousClassified && current.rootCauseId !== previous.rootCauseId) {
    const differingEvidence = `Classified root-cause IDs differ: ${current.rootCauseId} and ${previous.rootCauseId}.`;
    if (bothVerified) {
      return {
        evidence: [differingEvidence],
        relation: 'unrelated',
        score: 0,
        sharedRootCause: false,
      };
    }
    return {
      evidence: [
        differingEvidence,
        'One or both classifications remain candidates, so the relationship is not definitive.',
      ],
      relation: 'insufficient-evidence',
      score: 20,
      sharedRootCause: false,
    };
  }

  const signatureOverlap = current.matchedSignatures.filter((signature) =>
    previous.matchedSignatures.includes(signature),
  );
  if (signatureOverlap.length > 0) {
    evidence.push(`Occurrences share ${signatureOverlap.length} observed signature(s).`);
  }
  if (current.category !== null && current.category === previous.category) {
    evidence.push(`Occurrences share category ${current.category}.`);
  }

  return {
    evidence: [
      ...evidence,
      'Unclassified or incomplete evidence cannot establish a shared root cause.',
    ],
    relation: 'insufficient-evidence',
    score: Math.min(
      60,
      signatureOverlap.length * 20 + (current.category === previous.category ? 10 : 0),
    ),
    sharedRootCause: false,
  };
}
