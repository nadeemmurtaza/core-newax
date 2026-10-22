import { dashboardList, dashboardPositiveInteger } from './executive-dashboard-history-blocks.mjs';

export function dashboardEngineeringOccurrence(metadata, context) {
  if (!metadata['root-cause-id']) {
    return null;
  }
  return {
    id:
      metadata['occurrence-id'] ??
      `eng-${context.issueNumber}-${metadata.fingerprint ?? metadata['source-id'] ?? 'event'}`,
    rootCauseId: metadata['root-cause-id'],
    category: metadata['failure-category'] ?? metadata.category ?? 'uncategorized',
    status: metadata['root-cause-status'] ?? 'candidate',
    occurredAt: metadata['occurred-at'] ?? metadata.at ?? context.createdAt,
    detectedAt: metadata['detected-at'],
    resolvedAt: metadata['resolved-at'],
    verifiedAt: metadata['verified-at'],
    prNumber: dashboardPositiveInteger(metadata['pr-number']),
    issueNumber: context.issueNumber,
    sourceId: metadata['source-id'] ?? context.source,
    fingerprint: metadata.fingerprint,
    commitSha: metadata['commit-sha'],
    sourceRefs: [context.source],
  };
}

export function dashboardRecurrenceEvent(metadata, context) {
  const type = String(metadata.type ?? metadata.kind ?? '').toLowerCase();
  if (type === 'occurrence') {
    return {
      family: 'occurrences',
      value: {
        id: metadata.id ?? metadata['occurrence-id'],
        rootCauseId: metadata['root-cause-id'],
        category: metadata.category ?? 'uncategorized',
        status: metadata.status,
        occurredAt: metadata['occurred-at'] ?? metadata.at ?? context.createdAt,
        detectedAt: metadata['detected-at'],
        resolvedAt: metadata['resolved-at'],
        verifiedAt: metadata['verified-at'],
        prNumber: dashboardPositiveInteger(metadata['pr-number']),
        issueNumber: dashboardPositiveInteger(metadata['issue-number']) ?? context.issueNumber,
        sourceId: metadata['source-id'] ?? context.source,
        fingerprint: metadata.fingerprint,
        commitSha: metadata['commit-sha'],
        sourceRefs: dashboardList(metadata['evidence-refs']).concat(context.source),
      },
    };
  }
  if (type === 'rule') {
    return {
      family: 'rules',
      value: {
        id: metadata.id ?? metadata['rule-id'],
        rootCauseId: metadata['root-cause-id'],
        state: metadata.state,
        effectiveAt: metadata['effective-at'],
        retiredAt: metadata['retired-at'],
        title: metadata.title ?? metadata['prevention-control'],
        sourceRefs: dashboardList(metadata['evidence-refs']).concat(
          metadata['source-ref'] ?? context.source,
        ),
      },
    };
  }
  return null;
}

export function dashboardRecurrenceDecision(record, context) {
  const current = record.currentOccurrence ?? {};
  return {
    id: record.digest ?? record.id,
    rootCauseId: record.rootCauseId,
    occurrenceId: current.id,
    occurredAt: current.occurredAt ?? context.createdAt,
    prNumber: current.prNumber,
    ruleId: record.rule?.id,
    disposition: record.explanation?.disposition,
    state: record.state,
    escalation: record.escalation,
    previousPrNumbers: record.previousPrNumbers ?? [],
    sourceRefs: [context.source],
  };
}

export function dashboardConfidenceRecord(record, context) {
  const snapshot = record.envelope ?? record.snapshot ?? record;
  const score = snapshot.evidenceQuality?.score;
  if (!Number.isFinite(Number(score))) {
    return null;
  }
  return {
    id: record.findingId ?? record.recordId ?? snapshot.inputDigest,
    at: context.createdAt,
    evidenceQualityScore: Number(score),
    sourceRefs: [context.source],
  };
}
