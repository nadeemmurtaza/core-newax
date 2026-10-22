import { createHash } from 'node:crypto';

import { scoreConfidenceEnvelope } from './confidence-scoring.mjs';
import { asArray, normalizeString, uniqueStrings } from './confidence-scoring-support.mjs';

function stableEvidenceId(prefix, value) {
  return `${prefix}-${createHash('sha256').update(String(value)).digest('hex').slice(0, 12)}`;
}

function evidenceTypeForText(value) {
  const text = normalizeString(value).toLowerCase();
  if (/\b(?:commit|sha)\b/.test(text)) {
    return 'commit';
  }
  if (/\b(?:workflow|job|step|log|runner)\b/.test(text)) {
    return 'log';
  }
  if (/\b(?:test|regression|assert)\b/.test(text)) {
    return 'test';
  }
  if (/\b(?:review|approval|reviewer)\b/.test(text)) {
    return 'review';
  }
  if (/\bissue\b/.test(text)) {
    return 'issue';
  }
  if (/\b(?:runtime|production|live)\b/.test(text)) {
    return 'runtime';
  }
  return 'artifact';
}

function findingEvidenceStatus(finding) {
  const state = normalizeString(finding?.state).toLowerCase();
  const confidence = normalizeString(finding?.confidence).toLowerCase();
  if (state === 'insufficient-evidence') {
    return 'unavailable';
  }
  if (state === 'suspected') {
    return 'claimed';
  }
  if (['detected', 'resolved', 'waived', 'clear'].includes(state) && confidence === 'high') {
    return 'verified';
  }
  return 'claimed';
}

export function evidenceRecordsFromFinding(finding = {}) {
  const status = findingEvidenceStatus(finding);
  return asArray(finding.evidence).map((entry, index) => {
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      return {
        id: normalizeString(entry.id) || `finding-evidence-${index + 1}`,
        type: normalizeString(entry.type) || 'artifact',
        status: normalizeString(entry.status) || status,
        source: normalizeString(entry.source) || normalizeString(finding.id),
        primary: entry.primary === true,
        durable: entry.durable === true,
        provenanceComplete: entry.provenanceComplete === true,
        roles: uniqueStrings(entry.roles),
        supports: uniqueStrings(entry.supports),
        contradicts: uniqueStrings(entry.contradicts),
      };
    }
    const text = normalizeString(entry);
    return {
      id: stableEvidenceId('finding-evidence', `${finding.id ?? 'unknown'}:${text}`),
      type: evidenceTypeForText(text),
      status,
      source: normalizeString(finding.id),
      primary: false,
      durable: true,
      provenanceComplete: false,
      roles: [],
      supports: [],
      contradicts: [],
    };
  });
}

export function evidenceRecordsFromRootCauseInput(input = {}) {
  const records = [];
  const workflow = normalizeString(input.workflowName);
  const job = normalizeString(input.jobName);
  const step = normalizeString(input.stepName);
  const logText = normalizeString(input.logText);
  if (workflow || job || step || logText) {
    records.push({
      id: stableEvidenceId('root-log', `${workflow}:${job}:${step}:${logText}`),
      type: 'log',
      status: logText ? 'verified' : 'claimed',
      source: [workflow, job, step].filter(Boolean).join('/'),
      primary: true,
      durable: normalizeString(input.workflowRunId).length > 0,
      provenanceComplete: Boolean(workflow && job && step && input.workflowRunId),
      roles: ['proof-log'],
      supports: [],
      contradicts: [],
    });
  }
  if (normalizeString(input.commitSha)) {
    records.push({
      id: stableEvidenceId('root-commit', input.commitSha),
      type: 'commit',
      status: /^[0-9a-f]{40}$/i.test(normalizeString(input.commitSha)) ? 'verified' : 'claimed',
      source: normalizeString(input.commitSha),
      primary: true,
      durable: true,
      provenanceComplete: /^[0-9a-f]{40}$/i.test(normalizeString(input.commitSha)),
      roles: ['introducing-commit'],
      supports: [],
      contradicts: [],
    });
  }
  return records;
}

export function evidenceRecordsFromExplanationInput(input = {}) {
  return asArray(input.evidence).map((record, index) => ({
    id: normalizeString(record?.id) || `explanation-evidence-${index + 1}`,
    type: normalizeString(record?.type) || 'artifact',
    status: normalizeString(record?.status) || 'claimed',
    source: normalizeString(record?.source),
    primary: ['log', 'commit', 'test', 'runtime'].includes(normalizeString(record?.type)),
    durable: normalizeString(record?.id).length > 0,
    provenanceComplete:
      normalizeString(record?.id).length > 0 && normalizeString(record?.type).length > 0,
    roles: uniqueStrings([
      ...(record?.type === 'log' ? ['proof-log'] : []),
      ...(record?.type === 'commit' ? ['introducing-commit'] : []),
      ...(record?.type === 'test' ? ['reproducing-test'] : []),
    ]),
    supports: uniqueStrings(record?.supports),
    contradicts: uniqueStrings(record?.contradicts),
  }));
}

export function evidenceRecordsFromPreventionMistake(mistake = {}) {
  return uniqueStrings([
    ...asArray(mistake.evidenceRefs),
    ...asArray(mistake.verificationRefs),
    ...asArray(mistake.regressionRefs),
  ]).map((reference) => ({
    id: stableEvidenceId('prevention-evidence', reference),
    type: evidenceTypeForText(reference),
    status: 'verified',
    source: reference,
    primary: true,
    durable: true,
    provenanceComplete: true,
    roles: [/regression|test/i.test(reference) ? 'reproducing-test' : 'verification'],
    supports: uniqueStrings([mistake.rootCauseId]),
    contradicts: [],
  }));
}

function withoutConfidenceScores(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const rest = { ...value };
  delete rest.confidenceScores;
  return rest;
}

export function enrichFindingConfidence(finding, context = {}) {
  const cleanFinding = withoutConfidenceScores(finding);
  return {
    ...cleanFinding,
    confidenceScores: scoreConfidenceEnvelope({
      finding: cleanFinding,
      rootCauseAssessment: context.rootCauseAssessment,
      duplicateAssessment: context.duplicateAssessment,
      evidenceRecords: context.evidenceRecords ?? evidenceRecordsFromFinding(cleanFinding),
      requiredEvidenceRoles: context.requiredEvidenceRoles,
      explanationVerification: context.explanationVerification,
      automationAssessment: context.automationAssessment,
    }),
  };
}

export function enrichAnalysisResult(result, contextFactory = () => ({})) {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }
  const findings = asArray(result.findings).map((finding, index) =>
    enrichFindingConfidence(finding, contextFactory(finding, index)),
  );
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const blockers = asArray(result.blockers).map((blocker) => {
    if (typeof blocker === 'string') {
      return blocker;
    }
    if (blocker !== null && typeof blocker === 'object' && byId.has(blocker.id)) {
      return byId.get(blocker.id);
    }
    return blocker;
  });
  return { ...result, findings, blockers };
}

export function confidenceForRootCauseOutput({ input, assessment, comparison = null }) {
  return scoreConfidenceEnvelope({
    rootCauseAssessment: assessment,
    duplicateAssessment: comparison,
    evidenceRecords: evidenceRecordsFromRootCauseInput(input),
    requiredEvidenceRoles: ['proof-log'],
  });
}

export function enrichExplanationReport(report, input) {
  return {
    ...report,
    confidenceScores: scoreConfidenceEnvelope({
      rootCauseAssessment: input?.assessment,
      evidenceRecords: evidenceRecordsFromExplanationInput(input),
      requiredEvidenceRoles: ['proof-log', 'introducing-commit', 'reproducing-test'],
      explanationVerification: report,
    }),
  };
}

export function enrichPreventionRegistry(registry, context = {}) {
  const packByRoot = new Map(asArray(registry?.packs).map((pack) => [pack.rootCauseId, pack]));
  const results = asArray(registry?.results).map((result) => {
    const pack = result.pack ?? packByRoot.get(result.mistake?.rootCauseId) ?? null;
    return {
      ...result,
      confidenceScores: scoreConfidenceEnvelope({
        finding: result.mistake,
        evidenceRecords: evidenceRecordsFromPreventionMistake(result.mistake),
        automationAssessment: {
          pack,
          validationErrors:
            context.validationErrorsByRootCause?.[result.mistake?.rootCauseId] ?? [],
          exactFilesCurrent: context.exactFilesCurrent === true,
          governancePassed: context.governancePassed === true,
        },
      }),
    };
  });
  const resultByRoot = new Map(results.map((result) => [result.mistake?.rootCauseId, result]));
  const packs = asArray(registry?.packs).map((pack) => ({
    ...pack,
    automationConfidence:
      resultByRoot.get(pack.rootCauseId)?.confidenceScores?.automationConfidence ??
      scoreConfidenceEnvelope({ automationAssessment: { pack } }).automationConfidence,
  }));
  return { ...registry, results, packs };
}
