import { verifyExplanation } from './explanation-verification-core.mjs';
import { asArray } from './explanation-verification-support.mjs';

export function createEventExplanationVerification(event) {
  const input = createEventExplanationInput(event);
  return verifyExplanation(input);
}

export function renderExplanationVerification(report) {
  const alternative = report.strongestAlternative;
  const formatRole = (role) => {
    const value = report.questions[role];
    return `${value.answer}${value.evidenceIds.length === 0 ? '' : ` (${value.evidenceIds.join(', ')})`}`;
  };

  return `## Explanation verification

- Explanation decision: \`${report.status}\`
- Does the evidence support this?: \`${report.questions.evidenceSupport.answer}\`
- Is another explanation more likely?: \`${report.questions.alternativeLikelihood.answer}\`
- Strongest alternative: ${alternative === null ? 'None identified' : `\`${alternative.rootCauseId}\` (delta ${alternative.scoreDelta})`}
- Which log proves this?: ${formatRole('proofLog')}
- Which commit introduced it?: ${formatRole('introducingCommit')}
- Which test reproduces it?: ${formatRole('reproducingTest')}
- Confidence score: \`${report.confidenceScore}/100\` (${report.confidenceBand}; evidence support, not probability of truth)
- Missing or challenged evidence: ${report.missingEvidence.length === 0 ? 'None' : report.missingEvidence.join(' | ')}
`;
}

export function createEventExplanationInput(event) {
  const logId =
    Number.isSafeInteger(event?.workflowRunId) && Number.isSafeInteger(event?.jobId)
      ? `log:${event.workflowRunId}:${event.jobId}:${event.stepName ?? 'unknown'}`
      : null;
  const evidence =
    logId === null
      ? []
      : [
          {
            id: logId,
            type: 'log',
            status: 'verified',
            supports: event.matchedSignatures?.length > 0 ? [event.rootCauseId] : [],
            contradicts: [],
            workflowRunId: event.workflowRunId,
            jobId: event.jobId,
            stepName: event.stepName,
          },
        ];
  const hypotheses = asArray(event?.rootCauseAssessment?.hypotheses).map((hypothesis) => ({
    rootCauseId: hypothesis.rootCauseId,
    score: hypothesis.score,
  }));
  const alternatives = hypotheses.filter(
    (hypothesis) => hypothesis.rootCauseId !== event.rootCauseId,
  );

  return {
    version: 1,
    assessment: {
      ambiguous: event?.rootCauseAssessment?.ambiguous === true,
      selected: {
        rootCauseId: event.rootCauseId,
        score: event?.rootCauseAssessment?.selected?.score ?? 0,
      },
      hypotheses,
    },
    explanation: {
      rootCauseId: event.rootCauseId,
      statement: event.rootCauseCandidate,
      evidenceReferences: evidence.map((item) => item.id),
      proofLogId: logId,
      introducedByCommit: null,
      introducedByCommitEvidenceId: null,
      reproducingTestId: null,
      alternativesReviewed: alternatives.length === 0,
      exceptions: {},
      review: {
        status: 'unreviewed',
        reviewedBy: null,
        reviewedAt: null,
      },
    },
    evidence,
  };
}

export function renderExplanationEvidenceRecord(record) {
  return `<!-- newax-explanation-evidence\n${JSON.stringify(record)}\n-->`;
}

export function parseExplanationEvidenceRecord(body) {
  const match = String(body ?? '').match(/<!-- newax-explanation-evidence\n([\s\S]*?)\n-->/);
  if (match === null) {
    return null;
  }
  try {
    const record = JSON.parse(match[1]);
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

const EXPLANATION_SECTION_MARKER = 'newax-explanation-verification';

export function renderExplanationSection(event) {
  const record = createEventExplanationInput(event);
  const report = verifyExplanation(record);
  return `<!-- ${EXPLANATION_SECTION_MARKER} -->
${renderExplanationEvidenceRecord(record)}
${renderExplanationVerification(report)}
<!-- /${EXPLANATION_SECTION_MARKER} -->`;
}

function hasCompletedReview(record) {
  const review = record?.explanation?.review;
  return (
    review?.status === 'reviewed' &&
    typeof review.reviewedBy === 'string' &&
    review.reviewedBy.trim().length > 0 &&
    typeof review.reviewedAt === 'string' &&
    review.reviewedAt.trim().length > 0
  );
}

export function ensureExplanationSection(body, section) {
  const normalizedBody = String(body ?? '').trimEnd();
  const pattern = new RegExp(
    `<!-- ${EXPLANATION_SECTION_MARKER} -->[\\s\\S]*?<!-- \\/${EXPLANATION_SECTION_MARKER} -->`,
  );
  const existing = normalizedBody.match(pattern);
  if (existing === null) {
    return `${normalizedBody}\n\n${section}\n`;
  }

  const record = parseExplanationEvidenceRecord(existing[0]);
  if (record === null || hasCompletedReview(record)) {
    return normalizedBody;
  }
  return normalizedBody.replace(pattern, section);
}
