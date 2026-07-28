import {
  engineeringOccurrence,
  parseRecurrenceBlocks,
  preventionRule,
  recurrenceExplanation,
  recurrenceOccurrence,
  recurrenceRule,
} from './recurrence-history-events.mjs';

export function parseRecurrenceHistory(issue, comments = []) {
  const records = [
    {
      body: issue?.body ?? '',
      source: `issue:${issue?.number ?? 'unknown'}`,
      createdAt: issue?.created_at,
    },
    ...comments.map((comment) => ({
      body: comment.body ?? '',
      source: `comment:${comment.id ?? 'unknown'}`,
      createdAt: comment.created_at,
    })),
  ];
  const occurrences = [];
  const rules = [];
  const explanations = [];
  for (const record of records) {
    for (const metadata of parseRecurrenceBlocks(record.body, 'newax-engineering-event')) {
      const occurrence = engineeringOccurrence(
        metadata,
        { ...issue, created_at: record.createdAt ?? issue?.created_at },
        record.source,
      );
      if (occurrence !== null) {
        occurrences.push(occurrence);
      }
    }
    for (const metadata of parseRecurrenceBlocks(record.body, 'newax-recurrence-event')) {
      const occurrence = recurrenceOccurrence(metadata, issue, record.source);
      const rule = recurrenceRule(metadata, record.source);
      const explanation = recurrenceExplanation(metadata, record.source);
      if (occurrence !== null) {
        occurrences.push(occurrence);
      }
      if (rule !== null) {
        rules.push(rule);
      }
      if (explanation !== null) {
        explanations.push(explanation);
      }
    }
    for (const metadata of parseRecurrenceBlocks(record.body, 'newax-prevention-event')) {
      const rule = preventionRule(metadata, record.source);
      if (rule !== null) {
        rules.push(rule);
      }
    }
  }
  return { occurrences, rules, explanations };
}

export function parseRecurrenceIssueNumbers(pullRequestBody) {
  const values = [
    ...String(pullRequestBody ?? '').matchAll(
      /^-\s*(?:Recurrence records|Learning issues):\s*(.+)$/gim,
    ),
  ].flatMap((match) => [...match[1].matchAll(/#(\d+)/g)].map((entry) => Number(entry[1])));
  return [...new Set(values.filter(Number.isSafeInteger))];
}
