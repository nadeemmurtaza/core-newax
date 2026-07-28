import { appendLocalEvent, createEngineeringEvent } from './engineering-learning-core.mjs';
import { normalizeErrorImpacts, normalizeRelationshipHints } from './error-relationship-graph.mjs';
import { applyExternalSourceClassification } from './external-event-classification.mjs';
import { normalizeExternalFailurePayload } from './external-failure-intake.mjs';
import { sanitizeEngineeringEvidence } from './sanitize-engineering-evidence.mjs';
import { submitEngineeringEvent } from './submit-engineering-event.mjs';

function createContextLabel(event) {
  return [event.environment, event.service, event.release].filter(Boolean).join(' / ');
}

function sanitizeContextValue(value) {
  return value === null ? null : sanitizeEngineeringEvidence(value);
}

export function createLearningEventFromExternalFailure(payload, options = {}) {
  const normalized = normalizeExternalFailurePayload(payload, {
    environment: options.environment,
    repository: options.repository ?? process.env.GITHUB_REPOSITORY,
    sourceType: options.sourceType,
    now: options.now,
  });
  const relationshipHints = normalizeRelationshipHints(
    payload.relationshipHints ?? payload.relationship_hints ?? payload.relationships,
  );
  const impacts = normalizeErrorImpacts(payload.impacts);
  const logText = [normalized.summary, normalized.details].filter(Boolean).join('\n');
  const workflowName = `External intake: ${normalized.sourceType}`;
  const jobName = createContextLabel(normalized) || 'unknown environment';
  const baseEvent = createEngineeringEvent({
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    occurredAt: normalized.occurredAt,
    repository: normalized.repository,
    prNumber: normalized.prNumber,
    commitSha: normalized.commitSha,
    workflowName,
    jobName,
    stepName: normalized.operation,
    logText,
    summary: normalized.summary,
    unsuccessfulMethod: normalized.unsuccessfulMethod ?? undefined,
    successfulMethod: normalized.successfulMethod ?? undefined,
    preventionControl: normalized.preventionControl ?? undefined,
    evidenceUrls: normalized.evidenceUrls,
  });

  return {
    ...applyExternalSourceClassification(baseEvent, normalized.sourceType, logText),
    relationshipHints,
    impacts,
    externalContext: {
      component: sanitizeContextValue(normalized.component),
      environment: normalized.environment,
      release: sanitizeContextValue(normalized.release),
      service: sanitizeContextValue(normalized.service),
      severity: normalized.severity,
      traceId: sanitizeContextValue(normalized.traceId),
    },
  };
}

export async function deliverExternalFailure(payload, options = {}) {
  const event = createLearningEventFromExternalFailure(payload, options);
  const delivery =
    options.delivery ??
    (process.env.GITHUB_TOKEN !== undefined && process.env.GITHUB_REPOSITORY !== undefined
      ? 'github'
      : 'queue');

  if (delivery === 'github') {
    const result = await submitEngineeringEvent(event, options.githubOptions);
    return { delivery: 'github-issue', event, ...result };
  }
  if (delivery !== 'queue') {
    throw new TypeError(`Unsupported engineering event delivery: ${delivery}.`);
  }

  const path = appendLocalEvent(event, options.queuePath);
  return { delivery: 'local-queue', event, path };
}
