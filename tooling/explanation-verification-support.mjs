const EVIDENCE_TYPES = new Set(['artifact', 'commit', 'issue', 'log', 'review', 'runtime', 'test']);
const EVIDENCE_STATUSES = new Set(['claimed', 'contradictory', 'unavailable', 'verified']);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
export const REQUIRED_ROLES = ['proofLog', 'introducedByCommit', 'reproducingTest'];

export function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeEvidence(record, index) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`evidence[${index}] must be an object.`);
  }

  const id = normalizeString(record.id);
  const type = normalizeString(record.type);
  const status = normalizeString(record.status);
  if (id.length === 0) {
    throw new TypeError(`evidence[${index}].id must be a non-empty string.`);
  }
  if (!EVIDENCE_TYPES.has(type)) {
    throw new TypeError(`evidence[${index}].type is unsupported.`);
  }
  if (!EVIDENCE_STATUSES.has(status)) {
    throw new TypeError(`evidence[${index}].status is unsupported.`);
  }

  return {
    ...record,
    id,
    type,
    status,
    supports: unique(asArray(record.supports).map(normalizeString)),
    contradicts: unique(asArray(record.contradicts).map(normalizeString)),
  };
}

function normalizeException(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return {
    approved: value.approved === true,
    reason: normalizeString(value.reason),
    evidenceReferences: unique(asArray(value.evidenceReferences).map(normalizeString)),
  };
}

export function strongestAlternative(assessment, rootCauseId, evidence) {
  const hypotheses = asArray(assessment?.hypotheses);
  const selected =
    hypotheses.find((hypothesis) => hypothesis.rootCauseId === rootCauseId) ?? assessment?.selected;
  const alternatives = hypotheses.filter((hypothesis) => hypothesis.rootCauseId !== rootCauseId);

  const adjustedScore = (hypothesis) => {
    const base = Number.isFinite(hypothesis?.score) ? hypothesis.score : 0;
    const support = evidence.filter(
      (item) => item.status === 'verified' && item.supports.includes(hypothesis?.rootCauseId),
    ).length;
    const contradiction = evidence.filter(
      (item) =>
        (item.status === 'verified' || item.status === 'contradictory') &&
        item.contradicts.includes(hypothesis?.rootCauseId),
    ).length;
    return Math.max(0, Math.min(100, base + Math.min(20, support * 10) - contradiction * 15));
  };

  const selectedScore = adjustedScore(selected);
  const alternative = alternatives
    .map((hypothesis) => ({
      ...hypothesis,
      adjustedScore: adjustedScore(hypothesis),
    }))
    .sort(
      (first, second) =>
        second.adjustedScore - first.adjustedScore ||
        String(first.rootCauseId).localeCompare(String(second.rootCauseId)),
    )[0];

  return {
    alternative: alternative ?? null,
    selectedScore,
    scoreDelta: alternative === undefined ? null : selectedScore - alternative.adjustedScore,
  };
}

function verifyException(role, exception, evidenceById, rootCauseId) {
  if (exception === null || exception.approved !== true || exception.reason.length < 20) {
    return { accepted: false, evidenceIds: [], reason: null };
  }
  const records = exception.evidenceReferences.map((id) => evidenceById.get(id)).filter(Boolean);
  const accepted =
    records.length > 0 &&
    records.every((record) => record.status === 'verified') &&
    records.some((record) => record.supports.includes(rootCauseId));
  return {
    accepted,
    evidenceIds: records.map((record) => record.id),
    reason: accepted ? `${role} exception approved: ${exception.reason}` : null,
  };
}

export function verifyRole({ role, explanation, evidenceById, rootCauseId }) {
  const referenceField = {
    proofLog: 'proofLogId',
    introducedByCommit: 'introducedByCommitEvidenceId',
    reproducingTest: 'reproducingTestId',
  }[role];
  const reference = normalizeString(explanation?.[referenceField]);
  const evidence = evidenceById.get(reference);
  const exception = verifyException(
    role,
    normalizeException(explanation?.exceptions?.[role]),
    evidenceById,
    rootCauseId,
  );

  if (exception.accepted) {
    return {
      answer: 'approved-exception',
      evidenceIds: exception.evidenceIds,
      reason: exception.reason,
    };
  }
  if (evidence === undefined || evidence.status !== 'verified') {
    return {
      answer: 'missing',
      evidenceIds: reference.length === 0 ? [] : [reference],
      reason: `${role} lacks a verified evidence record.`,
    };
  }
  if (!evidence.supports.includes(rootCauseId)) {
    return {
      answer: 'unsupported',
      evidenceIds: [evidence.id],
      reason: `${role} evidence does not support the selected root cause.`,
    };
  }

  if (role === 'proofLog' && evidence.type !== 'log') {
    return {
      answer: 'invalid',
      evidenceIds: [evidence.id],
      reason: 'Proof-log evidence is not a log.',
    };
  }
  if (role === 'introducedByCommit') {
    const introducedByCommit = normalizeString(explanation?.introducedByCommit);
    if (
      evidence.type !== 'commit' ||
      !SHA_PATTERN.test(introducedByCommit) ||
      normalizeString(evidence.commitSha) !== introducedByCommit
    ) {
      return {
        answer: 'invalid',
        evidenceIds: [evidence.id],
        reason: 'Introducing-commit evidence does not verify the claimed full commit SHA.',
      };
    }
  }
  if (
    role === 'reproducingTest' &&
    (evidence.type !== 'test' || evidence.reproduces !== true || evidence.outcome !== 'passed')
  ) {
    return {
      answer: 'invalid',
      evidenceIds: [evidence.id],
      reason: 'Reproducing-test evidence must identify a passing test that reproduces the failure.',
    };
  }

  return {
    answer: 'verified',
    evidenceIds: [evidence.id],
    reason: `${role} evidence verified.`,
  };
}

export function roleScore(answer) {
  if (answer === 'verified') {
    return 15;
  }
  if (answer === 'approved-exception') {
    return 5;
  }
  return 0;
}

export function confidenceBand(score) {
  if (score >= 80) {
    return 'high';
  }
  if (score >= 60) {
    return 'medium';
  }
  return 'low';
}
