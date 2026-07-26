import { parseIssueNumbers, parsePullRequestField } from './engineering-learning-core.mjs';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueBlocks(body, blockName) {
  const expression = new RegExp(`<!-- ${blockName}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) =>
    Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(':');
          return separator === -1
            ? [line.toLowerCase(), '']
            : [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
        }),
    ),
  );
}

function extractHeadingValue(body, heading) {
  const lines = String(body ?? '').split('\n');
  const target = heading.trim().toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^#{2,4}\s+(.+)$/);
    return match !== null && match[1].trim().toLowerCase() === target;
  });
  if (start === -1) {
    return '';
  }
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{2,4}\s+/.test(lines[index])) {
      break;
    }
    if (lines[index].trim().length > 0) {
      values.push(lines[index].trim());
    }
  }
  return values
    .join('\n')
    .replace(/^```[^\n]*\n?|```$/g, '')
    .trim();
}

function eventFromMetadata(metadata, source, createdAt) {
  return {
    id: metadata['communication-id'] ?? metadata.id,
    type: metadata.event ?? metadata.type,
    topic: metadata.topic,
    authority: metadata.authority,
    status: metadata.status,
    value: metadata.value ?? metadata.interpretation,
    at: metadata.at ?? createdAt,
    appliesTo: splitList(metadata['applies-to'] ?? metadata.scope),
    references: splitList(metadata.references),
    conflictsWith: splitList(metadata['conflicts-with']),
    supersedes: splitList(metadata.supersedes),
    resolves: splitList(metadata.resolves),
    findingType: metadata['finding-type'],
    requiresConfirmation: metadata['requires-confirmation'],
    requiresApproval: metadata['requires-approval'],
    requiresDecision: metadata['requires-decision'],
    confirmsMisunderstanding: metadata['confirms-misunderstanding'],
    reviewer: metadata.reviewer ?? metadata['approved-by'],
    reason: metadata.reason,
    source,
  };
}

function eventFromIssueForm(body, source, createdAt) {
  const id = extractHeadingValue(body, 'Communication ID');
  const type = extractHeadingValue(body, 'Event type');
  const topic = extractHeadingValue(body, 'Topic');
  if (id.length === 0 || type.length === 0 || topic.length === 0) {
    return null;
  }
  return {
    id,
    type,
    topic,
    authority: extractHeadingValue(body, 'Authority'),
    status: extractHeadingValue(body, 'Status'),
    value: extractHeadingValue(body, 'Value or interpretation'),
    at: extractHeadingValue(body, 'Effective time') || createdAt,
    appliesTo: splitList(extractHeadingValue(body, 'Applies to')),
    references: splitList(extractHeadingValue(body, 'References')),
    conflictsWith: splitList(extractHeadingValue(body, 'Conflicts with')),
    supersedes: splitList(extractHeadingValue(body, 'Supersedes')),
    resolves: splitList(extractHeadingValue(body, 'Resolves')),
    findingType: extractHeadingValue(body, 'Finding type'),
    requiresConfirmation: extractHeadingValue(body, 'Requires confirmation'),
    requiresApproval: extractHeadingValue(body, 'Requires approval'),
    requiresDecision: extractHeadingValue(body, 'Requires decision'),
    confirmsMisunderstanding: extractHeadingValue(body, 'Confirms misunderstanding'),
    reviewer: extractHeadingValue(body, 'Reviewer'),
    reason: extractHeadingValue(body, 'Reason'),
    source,
  };
}

export function parseCommunicationEvents(body, context = {}) {
  const source = normalizeString(context.source) || 'unknown';
  const createdAt = context.createdAt ?? null;
  const events = parseKeyValueBlocks(body, 'newax-communication-event').map((metadata) =>
    eventFromMetadata(metadata, source, createdAt),
  );
  const form = eventFromIssueForm(body, source, createdAt);
  if (form !== null && !events.some((event) => event.id === form.id)) {
    events.push(form);
  }
  return events;
}

export function parseCommunicationIssueNumbers(pullRequestBody) {
  const field = parsePullRequestField(pullRequestBody, '- Communication issues:');
  if (field !== null) {
    return parseIssueNumbers(field);
  }
  return [
    ...new Set(
      [...String(pullRequestBody ?? '').matchAll(/communication issue(?:s)?\s*[:#]?\s*#(\d+)/gi)]
        .map((match) => Number(match[1]))
        .filter(Number.isSafeInteger),
    ),
  ];
}
