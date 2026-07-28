import { readFileSync } from 'node:fs';

import { deliverExternalFailure } from './deliver-engineering-event.mjs';

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}

function readGithubPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    return null;
  }

  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  return event.client_payload ?? event.inputs ?? null;
}

const argumentsMap = parseArguments(process.argv.slice(2));
const payload = readGithubPayload() ?? argumentsMap;
const result = await deliverExternalFailure({
  ...payload,
  sourceType: payload.source_type ?? payload.sourceType ?? 'manual',
  sourceId: payload.source_id ?? payload.sourceId,
  occurredAt: payload.occurred_at ?? payload.occurredAt,
  prNumber: payload.pr_number ?? payload.prNumber,
  commitSha: payload.commit_sha ?? payload.commitSha,
  traceId: payload.trace_id ?? payload.traceId,
  evidenceUrls: payload.evidence_urls ?? payload.evidenceUrls ?? payload.evidence,
  unsuccessfulMethod: payload.unsuccessful_method ?? payload.unsuccessfulMethod,
  successfulMethod: payload.successful_method ?? payload.successfulMethod,
  preventionControl: payload.prevention_control ?? payload.preventionControl,
});

console.log(
  JSON.stringify({
    delivery: result.delivery,
    issueNumber: result.issueNumber ?? null,
    path: result.path ?? null,
    sourceId: result.event.sourceId,
  }),
);
