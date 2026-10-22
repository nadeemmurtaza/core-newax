import { dashboardList, dashboardPositiveInteger } from './executive-dashboard-history-blocks.mjs';

export function dashboardMetricRecord(metadata, context) {
  const type = String(metadata.type ?? metadata.kind ?? '').toLowerCase();
  const sourceRefs = dashboardList(metadata['source-refs']).concat(context.source);
  if (type === 'cost') {
    return {
      family: 'costRecords',
      value: {
        id: metadata.id,
        occurrenceId: metadata['occurrence-id'],
        category: metadata.category,
        amountMinor: Number(metadata['amount-minor']),
        currency: metadata.currency,
        status: metadata.status,
        at: metadata.at ?? context.createdAt,
        sourceRefs,
      },
    };
  }
  if (type === 'time-loss') {
    return {
      family: 'timeLossRecords',
      value: {
        id: metadata.id,
        occurrenceId: metadata['occurrence-id'],
        category: metadata.category,
        minutes: Number(metadata.minutes),
        status: metadata.status,
        at: metadata.at ?? context.createdAt,
        sourceRefs,
      },
    };
  }
  if (type === 'ai-validation') {
    return {
      family: 'aiRecords',
      value: {
        id: metadata.id,
        at: metadata.at ?? context.createdAt,
        outcome: metadata.outcome,
        reviewer: metadata.reviewer,
        provider: metadata.provider,
        model: metadata.model,
        sourceRefs,
      },
    };
  }
  if (type === 'review-outcome') {
    return {
      family: 'reviewRecords',
      value: {
        id: metadata.id ?? `review-pr-${metadata['pr-number']}`,
        prNumber: dashboardPositiveInteger(metadata['pr-number']),
        at: metadata.at ?? context.createdAt,
        reviewed: String(metadata.reviewed ?? 'true').toLowerCase() === 'true',
        validFindings:
          metadata['valid-findings'] === undefined ? null : Number(metadata['valid-findings']),
        resolvedBeforeMerge:
          metadata['resolved-before-merge'] === undefined
            ? null
            : Number(metadata['resolved-before-merge']),
        escapedFindings:
          metadata['escaped-findings'] === undefined ? null : Number(metadata['escaped-findings']),
        reviewer: metadata.reviewer,
        sourceRefs,
      },
    };
  }
  if (type === 'governance') {
    return {
      family: 'governanceRecords',
      value: {
        id: metadata.id,
        at: metadata.at ?? context.createdAt,
        executed: String(metadata.executed).toLowerCase() === 'true',
        conclusion: metadata.conclusion,
        prNumber: dashboardPositiveInteger(metadata['pr-number']),
        sourceRefs,
      },
    };
  }
  return null;
}

export function dashboardAiValidation(metadata, context) {
  const type = String(metadata.event ?? metadata.type ?? '').toLowerCase();
  if (!['validation', 'output-validation', 'ai-validation'].includes(type)) {
    return null;
  }
  const code = String(metadata['validation-code'] ?? '').toLowerCase();
  const outcome = ['correct', 'partial', 'incorrect'].includes(code) ? code : 'unverified';
  return {
    id: metadata.id ?? metadata['event-id'],
    at: metadata.at ?? context.createdAt,
    outcome,
    reviewer: metadata.reviewer,
    provider: metadata.provider,
    model: metadata.model,
    sourceRefs: dashboardList(metadata.references).concat(
      metadata['validation-ref'] ?? context.source,
    ),
  };
}
