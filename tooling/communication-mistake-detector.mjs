import {
  CLOSED_STATUSES,
  authorityRank,
  compareCommits,
  compareEvents,
  createFinding,
  isAuthoritative,
  normalizeArray,
  normalizeCommit,
  normalizeEvent,
  normalizeString,
  pairwise,
} from './communication-mistake-support.mjs';
import {
  activeAt,
  applyWaivers,
  findApproval,
  findConfirmation,
  findDecision,
  firstWorkForTopic,
  markResolutions,
  scopesForTopic,
} from './communication-mistake-evidence.mjs';

export {
  COMMUNICATION_MISTAKE_TYPES,
  pathMatchesCommunicationScope,
} from './communication-mistake-support.mjs';

export function detectCommunicationMistakes(input = {}) {
  const phase = normalizeString(input.phase).toLowerCase() || 'draft';
  const events = normalizeArray(input.events).map(normalizeEvent).sort(compareEvents);
  const commits = normalizeArray(input.commits).map(normalizeCommit).sort(compareCommits);
  const findings = [];
  const notices = [];

  const eventIds = new Set();
  for (const event of events) {
    if (eventIds.has(event.id)) {
      throw new TypeError(`Duplicate communication-id: ${event.id}.`);
    }
    eventIds.add(event.id);
    if (event.topic.length === 0 && event.type !== 'waiver') {
      notices.push({
        type: 'insufficient-evidence',
        code: 'communication-topic-missing',
        eventId: event.id,
        message: `${event.id} has no topic and cannot be correlated safely.`,
      });
    }
  }

  const topics = [...new Set(events.map((event) => event.topic).filter(Boolean))];
  for (const topic of topics) {
    const topicEvents = events.filter((event) => event.topic === topic);
    const work = firstWorkForTopic(topicEvents, commits, events);
    const workAt = work?.at ?? null;
    if (work !== null && workAt === null) {
      notices.push({
        type: 'insufficient-evidence',
        code: 'dependent-work-timestamp-missing',
        topic,
        message: `${topic} has dependent work but no timestamp, so before/after claims cannot be proven.`,
      });
    }
    if (work === null && scopesForTopic(topicEvents).length === 0) {
      notices.push({
        type: 'insufficient-evidence',
        code: 'communication-scope-missing',
        topic,
        message: `${topic} has no applies-to scope or implementation event.`,
      });
    }

    const active = activeAt(topicEvents, workAt);
    const interpretations = active.filter(
      (event) => event.type === 'interpretation' && !CLOSED_STATUSES.has(event.status),
    );
    const authoritative = active.filter(isAuthoritative);

    for (const interpretation of interpretations) {
      if (interpretation.value.length === 0) {
        continue;
      }
      const contradictions = authoritative.filter(
        (event) =>
          event.value.length > 0 &&
          event.value !== interpretation.value &&
          !event.supersedes.includes(interpretation.id),
      );
      for (const source of contradictions) {
        const type =
          source.type === 'requirement' ? 'requirement-misunderstood' : 'wrong-interpretation';
        const canProveOrder = work !== null && workAt !== null && source.at !== null;
        const noWork = work === null;
        findings.push(
          createFinding({
            type,
            topic,
            state: canProveOrder ? 'detected' : 'suspected',
            confidence: canProveOrder ? 'high' : 'medium',
            severity: 'high',
            title: noWork
              ? `${topic} has an interpretation that conflicts with active authoritative communication.`
              : type === 'requirement-misunderstood'
                ? `${topic} implementation used an interpretation that contradicted an active authoritative requirement.`
                : `${topic} implementation used an interpretation that contradicted an active authoritative instruction or decision.`,
            eventIds: [interpretation.id, source.id],
            evidence: [
              { kind: 'interpretation', eventId: interpretation.id, value: interpretation.value },
              {
                kind: 'authoritative-source',
                eventId: source.id,
                type: source.type,
                value: source.value,
                authority: source.authority,
              },
              ...(work === null ? [] : [{ kind: 'dependent-work', ...work }]),
            ],
            missingEvidence: canProveOrder
              ? []
              : work === null
                ? ['dependent-work']
                : ['comparable-authoritative-and-work-timestamps'],
            recommendation:
              'Confirm the interpretation against the authoritative requirement before implementation.',
          }),
        );
      }
    }

    for (const correction of topicEvents.filter(
      (event) =>
        ['correction', 'clarification'].includes(event.type) &&
        event.confirmsMisunderstanding &&
        event.references.length > 0,
    )) {
      const interpretation = topicEvents.find(
        (event) => event.type === 'interpretation' && correction.references.includes(event.id),
      );
      if (interpretation === undefined || work === null) {
        continue;
      }
      if (workAt === null || correction.at === null) {
        notices.push({
          type: 'insufficient-evidence',
          code: 'retrospective-correction-timestamp-missing',
          topic,
          eventId: correction.id,
          message: `${correction.id} confirms a misunderstanding but its order relative to work is unprovable.`,
        });
        continue;
      }
      if (Date.parse(correction.at) > Date.parse(workAt)) {
        findings.push(
          createFinding({
            type: 'requirement-misunderstood',
            topic,
            confidence: authorityRank(correction) >= 3 ? 'high' : 'medium',
            severity: 'high',
            title: `${topic} was explicitly corrected after dependent work had begun.`,
            eventIds: [interpretation.id, correction.id],
            evidence: [
              { kind: 'interpretation', eventId: interpretation.id, value: interpretation.value },
              { kind: 'confirmed-correction', eventId: correction.id, at: correction.at },
              { kind: 'dependent-work', ...work },
            ],
            recommendation:
              'Capture and confirm the requirement interpretation before dependent work starts.',
          }),
        );
      }
    }

    for (const assumption of active.filter(
      (event) => event.type === 'assumption' && event.requiresConfirmation === true,
    )) {
      const confirmation = findConfirmation(assumption, topicEvents, workAt);
      if (work === null) {
        findings.push(
          createFinding({
            type: 'assumption-not-confirmed',
            topic,
            state: 'suspected',
            confidence: 'medium',
            title: `${topic} contains an assumption that still requires confirmation.`,
            eventIds: [assumption.id],
            evidence: [{ kind: 'assumption', eventId: assumption.id, value: assumption.value }],
            missingEvidence: ['dependent-work', 'confirmation'],
            recommendation: 'Confirm or reject the assumption before implementation.',
          }),
        );
      } else if (confirmation === null) {
        const canProveOrder = workAt !== null && assumption.at !== null;
        findings.push(
          createFinding({
            type: 'assumption-not-confirmed',
            topic,
            state: canProveOrder ? 'detected' : 'suspected',
            confidence: canProveOrder ? 'high' : 'medium',
            severity: 'high',
            title: `${topic} dependent work began before a required assumption was confirmed.`,
            eventIds: [assumption.id],
            evidence: [
              { kind: 'assumption', eventId: assumption.id, at: assumption.at },
              { kind: 'dependent-work', ...work },
            ],
            missingEvidence: canProveOrder
              ? ['confirmation']
              : ['confirmation', 'comparable-timestamps'],
            recommendation:
              'Record confirmation from an authorized person before dependent work starts.',
          }),
        );
      }
    }

    const openQuestions = active.filter(
      (event) => event.type === 'question' && !CLOSED_STATUSES.has(event.status),
    );
    const distinctInterpretations = [
      ...new Set(interpretations.map((event) => event.value).filter(Boolean)),
    ];
    if (openQuestions.length > 0 || distinctInterpretations.length > 1) {
      findings.push(
        createFinding({
          type: 'ambiguous-specification',
          topic,
          state: work === null || workAt === null ? 'suspected' : 'detected',
          confidence: work !== null && workAt !== null ? 'high' : 'medium',
          severity: 'high',
          title: `${topic} remained ambiguous when dependent work ${work === null ? 'had not yet started' : 'began'}.`,
          eventIds: [
            ...openQuestions.map((event) => event.id),
            ...interpretations.map((event) => event.id),
          ],
          evidence: [
            ...openQuestions.map((event) => ({ kind: 'open-question', eventId: event.id })),
            ...interpretations.map((event) => ({
              kind: 'interpretation-option',
              eventId: event.id,
              value: event.value,
            })),
            ...(work === null ? [] : [{ kind: 'dependent-work', ...work }]),
          ],
          missingEvidence:
            work === null ? ['dependent-work-or-resolution'] : ['specification-resolution'],
          recommendation:
            'Resolve the open question or select one documented interpretation before implementation.',
        }),
      );
    }

    for (const trigger of active.filter(
      (event) => event.requiresDecision === true || event.type === 'decision-required',
    )) {
      const decision = findDecision(trigger, topicEvents, workAt);
      if (work !== null && decision === null) {
        const canProveOrder = workAt !== null && trigger.at !== null;
        findings.push(
          createFinding({
            type: 'decision-undocumented',
            topic,
            state: canProveOrder ? 'detected' : 'suspected',
            confidence: canProveOrder ? 'high' : 'medium',
            severity: 'high',
            title: `${topic} dependent work began without the required canonical decision record.`,
            eventIds: [trigger.id],
            evidence: [
              { kind: 'decision-required', eventId: trigger.id, at: trigger.at },
              { kind: 'dependent-work', ...work },
            ],
            missingEvidence: canProveOrder
              ? ['decision-record']
              : ['decision-record', 'comparable-timestamps'],
            recommendation:
              'Record the decision, owner, selected value, and effective time before implementation.',
          }),
        );
      }
    }

    const directives = active.filter(
      (event) =>
        ['requirement', 'instruction'].includes(event.type) &&
        isAuthoritative(event) &&
        event.value.length > 0,
    );
    for (const [left, right] of pairwise(directives)) {
      const explicitConflict =
        left.value !== right.value ||
        left.conflictsWith.includes(right.id) ||
        right.conflictsWith.includes(left.id);
      if (!explicitConflict) {
        continue;
      }
      const canProve = left.at !== null && right.at !== null && (work === null || workAt !== null);
      findings.push(
        createFinding({
          type: 'conflicting-instructions',
          topic,
          state: work === null || !canProve ? 'suspected' : 'detected',
          confidence: work !== null && canProve ? 'high' : 'medium',
          severity: 'high',
          title: `${topic} had conflicting active authoritative instructions without a recorded resolution.`,
          eventIds: [left.id, right.id],
          evidence: [
            { kind: 'directive', eventId: left.id, value: left.value, authority: left.authority },
            {
              kind: 'directive',
              eventId: right.id,
              value: right.value,
              authority: right.authority,
            },
            ...(work === null ? [] : [{ kind: 'dependent-work', ...work }]),
          ],
          missingEvidence:
            work === null
              ? ['dependent-work-or-resolution']
              : canProve
                ? ['conflict-resolution']
                : ['comparable-timestamps'],
          recommendation:
            'Obtain one authoritative resolution that supersedes the conflicting instructions.',
        }),
      );
    }

    for (const trigger of active.filter(
      (event) => event.requiresApproval === true || event.type === 'approval-request',
    )) {
      const approval = findApproval(trigger, topicEvents, workAt);
      if (work !== null && approval === null) {
        const canProveOrder = workAt !== null && trigger.at !== null;
        findings.push(
          createFinding({
            type: 'missing-approval',
            topic,
            state: canProveOrder ? 'detected' : 'suspected',
            confidence: canProveOrder ? 'high' : 'medium',
            severity: 'high',
            title: `${topic} dependent work began before required approval was recorded.`,
            eventIds: [trigger.id],
            evidence: [
              { kind: 'approval-required', eventId: trigger.id, at: trigger.at },
              { kind: 'dependent-work', ...work },
            ],
            missingEvidence: canProveOrder ? ['approval'] : ['approval', 'comparable-timestamps'],
            recommendation:
              'Record explicit approval from the required authority before dependent work begins.',
          }),
        );
      }
    }
  }

  markResolutions(findings, events);
  applyWaivers(findings, events);

  const blockers = findings.filter(
    (finding) => finding.state === 'detected' && finding.confidence === 'high' && !finding.waived,
  );
  const suspected = findings.filter((finding) => finding.state === 'suspected' && !finding.waived);
  const unresolvedDetected = findings.filter(
    (finding) => finding.state === 'detected' && !finding.waived,
  );
  const status =
    blockers.length > 0
      ? 'detected'
      : unresolvedDetected.length > 0 || suspected.length > 0
        ? 'review-required'
        : notices.length > 0
          ? 'insufficient-evidence'
          : 'clear';

  return {
    schemaVersion: 1,
    status,
    phase,
    summary: {
      blockers: blockers.length,
      detected: findings.filter((finding) => finding.state === 'detected').length,
      suspected: suspected.length,
      resolved: findings.filter((finding) => finding.state === 'resolved').length,
      waived: findings.filter((finding) => finding.waived).length,
      notices: notices.length,
    },
    findings,
    blockers: blockers.map((finding) => finding.id),
    notices,
  };
}
