import {
  CLOSED_EVENT_STATUSES,
  compareEvents,
  isAttributableOutput,
  isVerifiedEvidence,
} from './ai-tool-mistake-support.mjs';

export function activeEvidence(events) {
  const active = events.filter((event) => !CLOSED_EVENT_STATUSES.has(event.status));
  const superseded = new Set(
    active.filter((event) => event.type === 'supersession').flatMap((event) => event.references),
  );
  return active.filter((event) => !superseded.has(event.id));
}

export function eventsForOutput(events, outputId) {
  return events.filter(
    (event) =>
      event.outputId === outputId ||
      event.references.includes(outputId) ||
      event.references.some((reference) => reference === `output:${outputId}`),
  );
}

export function verifiedEvents(events, type) {
  return events.filter((event) => event.type === type && isVerifiedEvidence(event));
}

export function provenanceMissing(output) {
  const missing = [];
  if (output === undefined) {
    return ['ai-output'];
  }
  if (output.outputId.length === 0) {
    missing.push('output-id');
  }
  if (output.at === null) {
    missing.push('output-timestamp');
  }
  if (output.outputHash.length === 0) {
    missing.push('output-hash');
  }
  if (output.artifactRefs.length === 0) {
    missing.push('artifact-references');
  }
  if (output.provider.length === 0 && output.tool.length === 0) {
    missing.push('provider-or-tool');
  }
  return missing;
}

function eventTargetsFinding(event, finding) {
  return (
    event.resolves.includes(finding.id) ||
    event.references.includes(finding.outputId) ||
    (event.findingType === finding.type && event.outputId === finding.outputId)
  );
}

export function correctionForFinding(finding, events) {
  return events
    .filter(
      (event) =>
        event.type === 'correction' &&
        isVerifiedEvidence(event) &&
        eventTargetsFinding(event, finding),
    )
    .sort(compareEvents)
    .at(-1);
}

export function regressionForFinding(finding, events) {
  return events
    .filter(
      (event) =>
        event.type === 'regression-test' &&
        isVerifiedEvidence(event) &&
        eventTargetsFinding(event, finding),
    )
    .sort(compareEvents)
    .at(-1);
}

export function applyFindingLifecycle(findings, events) {
  for (const finding of findings) {
    const resolution = events
      .filter(
        (event) =>
          ['resolution', 'correction'].includes(event.type) &&
          isVerifiedEvidence(event) &&
          eventTargetsFinding(event, finding),
      )
      .sort(compareEvents)
      .at(-1);
    if (resolution !== undefined) {
      finding.state = 'resolved';
      finding.resolution = {
        eventId: resolution.id,
        at: resolution.at,
        correctionCommit: resolution.correctionCommit,
      };
    }

    const waiver = events
      .filter(
        (event) =>
          event.type === 'waiver' &&
          event.findingType === finding.type &&
          (event.outputId.length === 0 || event.outputId === finding.outputId) &&
          event.reviewer.length > 0 &&
          event.reason.length >= 12,
      )
      .sort(compareEvents)
      .at(-1);
    if (waiver !== undefined) {
      finding.waived = true;
      finding.waiver = {
        eventId: waiver.id,
        at: waiver.at,
        reviewer: waiver.reviewer,
        reason: waiver.reason,
      };
    }
  }
}

export function canBlockFinding(finding, output) {
  return (
    finding.state === 'detected' &&
    finding.confidence === 'high' &&
    !finding.waived &&
    isAttributableOutput(output)
  );
}
