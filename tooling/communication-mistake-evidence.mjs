import {
  APPROVED_STATUSES,
  CLOSED_STATUSES,
  compareEvents,
  pathMatchesCommunicationScope,
} from './communication-mistake-support.mjs';

export function activeAt(events, time) {
  const eligible = events.filter((event) => {
    if (CLOSED_STATUSES.has(event.status)) {
      return false;
    }
    if (time === null || event.at === null) {
      return true;
    }
    return Date.parse(event.at) <= Date.parse(time);
  });
  const superseded = new Set(
    eligible.flatMap((event) => event.supersedes).filter((id) => id.length > 0),
  );
  return eligible.filter((event) => !superseded.has(event.id));
}

export function scopesForTopic(events) {
  return [...new Set(events.flatMap((event) => event.appliesTo))];
}

export function firstWorkForTopic(topicEvents, commits, allEvents) {
  const topic = topicEvents[0]?.topic ?? '';
  const explicit = allEvents
    .filter((event) => event.type === 'implementation' && event.topic === topic)
    .sort(compareEvents)[0];
  const commit = commits.find((candidate) =>
    topicEvents.some(
      (event) =>
        event.appliesTo.length > 0 &&
        candidate.files.some((file) =>
          pathMatchesCommunicationScope(file.filename, event.appliesTo),
        ) &&
        (event.at === null ||
          candidate.timestamp === null ||
          Date.parse(candidate.timestamp) >= Date.parse(event.at)),
    ),
  );
  const options = [
    explicit === undefined
      ? null
      : {
          kind: 'implementation-event',
          id: explicit.id,
          at: explicit.at,
          files: explicit.appliesTo,
        },
    commit === undefined
      ? null
      : {
          kind: 'commit',
          id: commit.sha,
          at: commit.timestamp,
          files: commit.files.map((file) => file.filename),
        },
  ].filter(Boolean);
  return (
    options.sort((left, right) => {
      if (left.at === null && right.at === null) {
        return 0;
      }
      if (left.at === null) {
        return 1;
      }
      if (right.at === null) {
        return -1;
      }
      return Date.parse(left.at) - Date.parse(right.at);
    })[0] ?? null
  );
}

function beforeWork(event, workAt) {
  if (workAt === null || event.at === null) {
    return true;
  }
  return Date.parse(event.at) <= Date.parse(workAt);
}

export function findConfirmation(assumption, topicEvents, workAt) {
  return (
    topicEvents
      .filter(
        (event) =>
          ['confirmation', 'clarification', 'approval'].includes(event.type) &&
          APPROVED_STATUSES.has(event.status) &&
          (event.references.includes(assumption.id) || event.topic === assumption.topic),
      )
      .filter((event) => beforeWork(event, workAt))
      .sort(compareEvents)
      .at(-1) ?? null
  );
}

export function findApproval(trigger, topicEvents, workAt) {
  return (
    topicEvents
      .filter(
        (event) =>
          event.type === 'approval' &&
          APPROVED_STATUSES.has(event.status) &&
          (event.references.includes(trigger.id) || event.topic === trigger.topic),
      )
      .filter((event) => beforeWork(event, workAt))
      .sort(compareEvents)
      .at(-1) ?? null
  );
}

export function findDecision(trigger, topicEvents, workAt) {
  return (
    topicEvents
      .filter(
        (event) =>
          event.type === 'decision' &&
          APPROVED_STATUSES.has(event.status) &&
          (event.references.includes(trigger.id) || event.topic === trigger.topic),
      )
      .filter((event) => beforeWork(event, workAt))
      .sort(compareEvents)
      .at(-1) ?? null
  );
}

export function markResolutions(findings, events) {
  for (const finding of findings) {
    const resolver = events
      .filter(
        (event) =>
          ['resolution', 'clarification', 'decision', 'correction'].includes(event.type) &&
          APPROVED_STATUSES.has(event.status) &&
          (event.resolves.includes(finding.id) ||
            event.resolves.some((value) => finding.eventIds.includes(value)) ||
            (event.topic === finding.topic && event.resolves.includes(finding.type))),
      )
      .sort(compareEvents)
      .at(-1);
    if (resolver !== undefined) {
      finding.state = 'resolved';
      finding.resolution = { eventId: resolver.id, at: resolver.at };
    }
  }
}

export function applyWaivers(findings, events) {
  for (const finding of findings) {
    const waiver = events
      .filter(
        (event) =>
          event.type === 'waiver' &&
          event.findingType === finding.type &&
          (event.topic.length === 0 || event.topic === finding.topic) &&
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
