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
  const expression = new RegExp(`<!-- ${blockName}\n([\\s\\S]*?)\n-->`, 'g');
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
    id: metadata['event-id'] ?? metadata.id,
    type: metadata.event ?? metadata.type,
    outputId: metadata['output-id'],
    status: metadata.status,
    at: metadata.at ?? createdAt,
    effectiveAt: metadata['effective-at'],
    provider: metadata.provider,
    model: metadata.model,
    tool: metadata.tool,
    toolVersion: metadata['tool-version'],
    sourceKind: metadata['source-kind'],
    promptHash: metadata['prompt-hash'],
    outputHash: metadata['output-hash'],
    artifactRefs: splitList(metadata['artifact-refs']),
    framework: metadata.framework,
    frameworkVersion: metadata['framework-version'],
    pinnedVersion: metadata['pinned-version'],
    documentationVersion: metadata['documentation-version'],
    symbol: metadata.symbol,
    claim: metadata.claim,
    expected: metadata.expected,
    actual: metadata.actual,
    packageName: metadata['package-name'],
    packageVersion: metadata['package-version'],
    replacement: metadata.replacement,
    policyId: metadata['policy-id'],
    validationKind: metadata['validation-kind'],
    validationCode: metadata['validation-code'],
    validationRef: metadata['validation-ref'],
    copiedFrom: metadata['copied-from'],
    staleIdentifiers: splitList(metadata['stale-identifiers']),
    generated: metadata.generated,
    materialImpact: metadata['material-impact'],
    confirmsMistake: metadata['confirms-mistake'],
    references: splitList(metadata.references),
    resolves: splitList(metadata.resolves),
    findingType: metadata['finding-type'],
    severity: metadata.severity,
    reviewer: metadata.reviewer,
    reason: metadata.reason,
    correctionCommit: metadata['correction-commit'],
    regressionTest: metadata['regression-test'],
    regressionRun: metadata['regression-run'],
    source,
  };
}

function parseGroupedIssueFields(body) {
  const groups = [
    'Output provenance',
    'Version and symbol evidence',
    'Claim and contradiction evidence',
    'Validation and policy evidence',
    'Copy and stale-context evidence',
    'Lifecycle evidence',
  ];
  return Object.fromEntries(
    groups
      .flatMap((heading) => extractHeadingValue(body, heading).split('\n'))
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        return separator === -1
          ? [line.toLowerCase(), '']
          : [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
      }),
  );
}

function eventFromIssueForm(body, source, createdAt) {
  const grouped = parseGroupedIssueFields(body);
  const field = (heading) =>
    extractHeadingValue(body, heading) || grouped[heading.trim().toLowerCase()] || '';
  const id = field('Event ID');
  const type = field('Event type');
  if (id.length === 0 || type.length === 0) {
    return null;
  }
  return {
    id,
    type: type.toLowerCase().replace(/\s+/g, '-'),
    outputId: field('Output ID'),
    status: field('Status'),
    at: field('Occurrence time') || createdAt,
    effectiveAt: field('Effective time'),
    provider: field('Provider'),
    model: field('Model'),
    tool: field('Tool'),
    toolVersion: field('Tool version'),
    sourceKind: field('Source kind'),
    promptHash: field('Prompt hash'),
    outputHash: field('Output hash'),
    artifactRefs: splitList(field('Artifact references')),
    framework: field('Framework'),
    frameworkVersion: field('Framework version'),
    pinnedVersion: field('Pinned version'),
    documentationVersion: field('Documentation version'),
    symbol: field('Symbol'),
    claim: field('Claim'),
    expected: field('Expected'),
    actual: field('Actual'),
    packageName: field('Package name'),
    packageVersion: field('Package version'),
    replacement: field('Replacement'),
    policyId: field('Policy ID'),
    validationKind: field('Validation kind'),
    validationCode: field('Validation code'),
    validationRef: field('Validation reference'),
    copiedFrom: field('Copied from'),
    staleIdentifiers: splitList(field('Stale identifiers')),
    generated: field('Generated'),
    materialImpact: field('Material impact'),
    confirmsMistake: field('Confirms mistake'),
    references: splitList(field('References')),
    resolves: splitList(field('Resolves')),
    findingType: field('Finding type'),
    severity: field('Severity'),
    reviewer: field('Reviewer'),
    reason: field('Reason'),
    correctionCommit: field('Correction commit'),
    regressionTest: field('Regression test'),
    regressionRun: field('Regression run'),
    source,
  };
}

export function parseAiQualityEvents(body, context = {}) {
  const source = normalizeString(context.source) || 'unknown';
  const createdAt = context.createdAt ?? null;
  const events = parseKeyValueBlocks(body, 'newax-ai-quality-event').map((metadata) =>
    eventFromMetadata(metadata, source, createdAt),
  );
  const form = eventFromIssueForm(body, source, createdAt);
  if (form !== null && !events.some((event) => event.id === form.id)) {
    events.push(form);
  }
  return events;
}

export function parseAiQualityIssueNumbers(pullRequestBody) {
  const field = parsePullRequestField(pullRequestBody, '- AI quality issues:');
  if (field !== null) {
    return parseIssueNumbers(field);
  }
  return [
    ...new Set(
      [...String(pullRequestBody ?? '').matchAll(/AI quality issue(?:s)?\s*[:#]?\s*#(\d+)/gi)]
        .map((match) => Number(match[1]))
        .filter(Number.isSafeInteger),
    ),
  ];
}
