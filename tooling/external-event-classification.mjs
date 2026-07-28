import { createFingerprint } from './engineering-learning-core.mjs';
import { EXTERNAL_FAILURE_SOURCE_TYPES } from './external-failure-intake.mjs';

const SOURCE_CLASSIFICATIONS = {
  'api-log': ['api-runtime', 'API_RUNTIME'],
  'browser-console': ['browser-runtime', 'BROWSER_RUNTIME'],
  'build-tool': ['production-build', 'BUILD_TOOL'],
  communication: ['process-communication-polling', 'PROCESS_COMMUNICATION_POLLING'],
  database: ['database-migration-live-behavior', 'DATABASE'],
  deployment: ['deployment', 'DEPLOYMENT'],
  'development-server': ['development-runtime', 'DEVELOPMENT_RUNTIME'],
  'external-tool': ['external-tool-operation', 'EXTERNAL_TOOL_OPERATION'],
  'local-command': ['local-command', 'LOCAL_COMMAND'],
  'local-verification': ['local-verification', 'LOCAL_VERIFICATION'],
  manual: ['unknown', 'UNKNOWN'],
  'package-manager': ['dependency-installation-lockfile', 'PACKAGE_MANAGER'],
  'performance-regression': ['performance-regression', 'PERFORMANCE_REGRESSION'],
  planning: ['planning-decision-quality', 'PLANNING_DECISION_QUALITY'],
  'runtime-exception': ['runtime-exception', 'RUNTIME_EXCEPTION'],
  'security-scanner': ['security-finding', 'SECURITY_SCANNER'],
};

export const EXTERNAL_EVENT_SOURCE_TYPES = EXTERNAL_FAILURE_SOURCE_TYPES;

export function applyExternalSourceClassification(baseEvent, sourceType, summary) {
  if (!baseEvent.rootCauseId.startsWith('ROOT-UNCLASSIFIED-')) {
    return baseEvent;
  }

  const [category, rootCauseSuffix] = SOURCE_CLASSIFICATIONS[sourceType] ?? ['unknown', 'UNKNOWN'];
  const classification = {
    category,
    rootCauseId: `ROOT-UNCLASSIFIED-${rootCauseSuffix}`,
  };
  const rootCauseCandidate =
    'The source and environment are known, but the true root cause requires evidence-backed confirmation.';
  const evidenceFor = [`Observable source type: ${sourceType}`, `Source category: ${category}`];
  const missingEvidence = [
    'Complete diagnostic evidence and a verified resolution are required before confirmation.',
  ];
  const selected = {
    ...baseEvent.rootCauseAssessment.selected,
    category,
    confidence: 'low',
    deterministic: false,
    evidenceAgainst: [],
    evidenceFor,
    ledgerEntry: null,
    matchedSignatures: [],
    missingEvidence,
    missingSignatures: [],
    rootCause: rootCauseCandidate,
    rootCauseId: classification.rootCauseId,
    score: 10,
  };

  return {
    ...baseEvent,
    ...classification,
    fingerprint: createFingerprint({
      classification,
      workflowName: baseEvent.workflowName,
      jobName: baseEvent.jobName,
      stepName: baseEvent.stepName,
      logText: summary,
    }),
    ledgerEntry: null,
    matchedSignatures: [],
    rootCauseAssessment: {
      ...baseEvent.rootCauseAssessment,
      ambiguous: false,
      deterministic: false,
      evidenceAgainst: [],
      evidenceFor,
      hypotheses: [selected],
      inferredCategory: category,
      missingEvidence,
      selected,
      status: 'candidate',
    },
    rootCauseCandidate,
    rootCauseConfidence: 'low',
    rootCauseDeterministic: false,
    status: 'candidate',
  };
}
