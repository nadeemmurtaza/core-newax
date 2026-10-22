import {
  dashboardJsonBlocks,
  dashboardKeyValueBlocks,
  dashboardPositiveInteger,
} from './executive-dashboard-history-blocks.mjs';
import {
  dashboardAiValidation,
  dashboardMetricRecord,
} from './executive-dashboard-history-metrics.mjs';
import {
  dashboardConfidenceRecord,
  dashboardEngineeringOccurrence,
  dashboardRecurrenceDecision,
  dashboardRecurrenceEvent,
} from './executive-dashboard-history-existing.mjs';

export * from './executive-dashboard-history-blocks.mjs';
export * from './executive-dashboard-history-metrics.mjs';
export * from './executive-dashboard-history-existing.mjs';

export function parseExecutiveDashboardEvidence(body, context = {}) {
  const source = context.source ?? 'unknown';
  const details = {
    source,
    createdAt: context.createdAt ?? null,
    issueNumber: dashboardPositiveInteger(context.issueNumber),
  };
  const output = {
    occurrences: [],
    costRecords: [],
    timeLossRecords: [],
    rules: [],
    recurrenceDecisions: [],
    aiRecords: [],
    reviewRecords: [],
    confidenceRecords: [],
    governanceRecords: [],
  };
  for (const metadata of dashboardKeyValueBlocks(body, 'newax-executive-metric')) {
    const record = dashboardMetricRecord(metadata, details);
    if (record) {
      output[record.family].push(record.value);
    }
  }
  for (const metadata of dashboardKeyValueBlocks(body, 'newax-engineering-event')) {
    const occurrence = dashboardEngineeringOccurrence(metadata, details);
    if (occurrence) {
      output.occurrences.push(occurrence);
    }
  }
  for (const metadata of dashboardKeyValueBlocks(body, 'newax-recurrence-event')) {
    const record = dashboardRecurrenceEvent(metadata, details);
    if (record) {
      output[record.family].push(record.value);
    }
  }
  for (const record of dashboardJsonBlocks(body, 'newax-recurrence-decision')) {
    output.recurrenceDecisions.push(dashboardRecurrenceDecision(record, details));
  }
  for (const record of dashboardJsonBlocks(body, 'newax-confidence-score')) {
    const confidence = dashboardConfidenceRecord(record, details);
    if (confidence) {
      output.confidenceRecords.push(confidence);
    }
  }
  for (const metadata of dashboardKeyValueBlocks(body, 'newax-ai-quality-event')) {
    const validation = dashboardAiValidation(metadata, details);
    if (validation) {
      output.aiRecords.push(validation);
    }
  }
  return output;
}

export function mergeExecutiveDashboardEvidence(collections) {
  const result = {
    occurrences: [],
    costRecords: [],
    timeLossRecords: [],
    rules: [],
    recurrenceDecisions: [],
    aiRecords: [],
    reviewRecords: [],
    confidenceRecords: [],
    governanceRecords: [],
  };
  for (const collection of collections) {
    for (const key of Object.keys(result)) {
      result[key].push(...(collection?.[key] ?? []));
    }
  }
  const reviewByPr = new Map();
  for (const review of result.reviewRecords) {
    const existing = reviewByPr.get(review.prNumber);
    if (existing === undefined || review.validFindings !== null) {
      reviewByPr.set(review.prNumber, review);
    }
  }
  result.reviewRecords = [...reviewByPr.values()];
  return result;
}
