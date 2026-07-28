import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SUMMARY_CHARACTERS = 2_000;
const MAX_DETAILS_CHARACTERS = 100_000;
const MAX_IDENTIFIER_CHARACTERS = 240;
const MAX_EVIDENCE_URLS = 20;

export const EXTERNAL_FAILURE_SOURCE_TYPES = new Set([
  'api-log',
  'browser-console',
  'build-tool',
  'communication',
  'database',
  'deployment',
  'development-server',
  'external-tool',
  'local-command',
  'local-verification',
  'manual',
  'package-manager',
  'performance-regression',
  'planning',
  'runtime-exception',
  'security-scanner',
]);

export const ENGINEERING_ENVIRONMENTS = new Set([
  'ci',
  'development',
  'local',
  'preview',
  'production',
  'staging',
  'test',
  'unknown',
]);

export const ENGINEERING_SEVERITIES = new Set(['critical', 'error', 'info', 'warning']);

const STRUCTURED_LOG_SEVERITY_ALIASES = new Map([
  ['alert', 'critical'],
  ['critical', 'critical'],
  ['emerg', 'critical'],
  ['emergency', 'critical'],
  ['fatal', 'critical'],
  ['panic', 'critical'],
  ['err', 'error'],
  ['error', 'error'],
  ['warn', 'warning'],
  ['warning', 'warning'],
  ['debug', 'info'],
  ['http', 'info'],
  ['info', 'info'],
  ['log', 'info'],
  ['notice', 'info'],
  ['silly', 'info'],
  ['trace', 'info'],
  ['verbose', 'info'],
]);

function readValue(payload, camelName, snakeName = camelName) {
  return payload[camelName] ?? payload[snakeName];
}

function optionalString(value, field, maximum = MAX_IDENTIFIER_CHARACTERS) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string when supplied.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > maximum) {
    throw new RangeError(`${field} exceeds ${maximum} characters.`);
  }
  return normalized;
}

function requiredString(value, field, maximum) {
  const normalized = optionalString(value, field, maximum);
  if (normalized === null) {
    throw new TypeError(`${field} is required.`);
  }
  return normalized;
}

function optionalInteger(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${field} must be a positive safe integer when supplied.`);
  }
  return number;
}

function normalizeIsoTimestamp(value, now) {
  const candidate = value ?? new Date(now()).toISOString();
  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('occurredAt must be an ISO-8601 timestamp.');
  }
  return new Date(timestamp).toISOString();
}

function normalizeCommitSha(value) {
  const commitSha = optionalString(value, 'commitSha', 64);
  if (commitSha !== null && !/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new TypeError('commitSha must be a full 40-character hexadecimal SHA.');
  }
  return commitSha;
}

function normalizeEvidenceUrl(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Each evidence URL must be a string.');
  }
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Evidence URLs must use HTTP or HTTPS.');
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function normalizeEvidenceUrls(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const urls = Array.from(
    new Set(raw.map((item) => normalizeEvidenceUrl(String(item).trim())).filter(Boolean)),
  );
  if (urls.length > MAX_EVIDENCE_URLS) {
    throw new RangeError(`evidenceUrls supports at most ${MAX_EVIDENCE_URLS} URLs.`);
  }
  return urls;
}

function normalizeSourceType(value) {
  const sourceType = requiredString(value, 'sourceType', 80).toLowerCase();
  if (!EXTERNAL_FAILURE_SOURCE_TYPES.has(sourceType)) {
    throw new TypeError(`Unsupported engineering source type: ${sourceType}.`);
  }
  return sourceType;
}

function normalizeEnvironment(value) {
  const environment = optionalString(value, 'environment', 40)?.toLowerCase() ?? 'unknown';
  if (!ENGINEERING_ENVIRONMENTS.has(environment)) {
    throw new TypeError(`Unsupported engineering environment: ${environment}.`);
  }
  return environment;
}

function normalizeSeverity(value) {
  const severity = optionalString(value, 'severity', 20)?.toLowerCase() ?? 'error';
  if (!ENGINEERING_SEVERITIES.has(severity)) {
    throw new TypeError(`Unsupported engineering severity: ${severity}.`);
  }
  return severity;
}

function createSourceId(event) {
  return createHash('sha256')
    .update(
      [
        event.sourceType,
        event.environment,
        event.service ?? '',
        event.operation,
        event.summary,
        event.occurredAt,
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32);
}

export function normalizeExternalFailurePayload(payload, options = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Engineering failure payload must be a JSON object.');
  }

  const now = options.now ?? Date.now;
  const sourceType = normalizeSourceType(
    readValue(payload, 'sourceType', 'source_type') ?? options.sourceType ?? 'manual',
  );
  const environment = normalizeEnvironment(
    readValue(payload, 'environment', 'environment') ?? options.environment,
  );
  const summary = requiredString(
    readValue(payload, 'summary', 'summary') ?? readValue(payload, 'symptom', 'symptom'),
    'summary',
    MAX_SUMMARY_CHARACTERS,
  );
  const operation =
    optionalString(
      readValue(payload, 'operation', 'operation') ??
        readValue(payload, 'stepName', 'step_name') ??
        readValue(payload, 'category', 'category'),
      'operation',
    ) ?? 'External engineering failure';
  const occurredAt = normalizeIsoTimestamp(readValue(payload, 'occurredAt', 'occurred_at'), now);
  const normalized = {
    schemaVersion: 1,
    sourceType,
    environment,
    severity: normalizeSeverity(readValue(payload, 'severity', 'severity')),
    occurredAt,
    sourceId: optionalString(
      readValue(payload, 'sourceId', 'source_id') ?? readValue(payload, 'eventId', 'event_id'),
      'sourceId',
    ),
    repository: optionalString(
      readValue(payload, 'repository', 'repository') ?? options.repository,
      'repository',
    ),
    prNumber: optionalInteger(readValue(payload, 'prNumber', 'pr_number'), 'prNumber'),
    commitSha: normalizeCommitSha(readValue(payload, 'commitSha', 'commit_sha')),
    service: optionalString(readValue(payload, 'service', 'service'), 'service'),
    component: optionalString(readValue(payload, 'component', 'component'), 'component'),
    operation,
    release: optionalString(readValue(payload, 'release', 'release'), 'release'),
    traceId: optionalString(readValue(payload, 'traceId', 'trace_id'), 'traceId'),
    summary,
    details: optionalString(
      readValue(payload, 'details', 'details') ?? readValue(payload, 'stack', 'stack'),
      'details',
      MAX_DETAILS_CHARACTERS,
    ),
    unsuccessfulMethod: optionalString(
      readValue(payload, 'unsuccessfulMethod', 'unsuccessful_method'),
      'unsuccessfulMethod',
      2_000,
    ),
    successfulMethod: optionalString(
      readValue(payload, 'successfulMethod', 'successful_method'),
      'successfulMethod',
      2_000,
    ),
    preventionControl: optionalString(
      readValue(payload, 'preventionControl', 'prevention_control'),
      'preventionControl',
      2_000,
    ),
    evidenceUrls: normalizeEvidenceUrls(
      readValue(payload, 'evidenceUrls', 'evidence_urls') ??
        readValue(payload, 'evidence', 'evidence'),
    ),
  };

  return {
    ...normalized,
    sourceId: normalized.sourceId ?? createSourceId(normalized),
  };
}

export function classifyCommandSource(command, argumentsList = []) {
  const text = `${command ?? ''} ${argumentsList.join(' ')}`.toLowerCase();

  if (/\b(pnpm|npm|yarn|bun)\b/.test(text) && /\b(install|add|remove|update|dedupe)\b/.test(text)) {
    return 'package-manager';
  }
  if (/\b(prisma|psql|postgres|migration|migrate|db:|database)\b/.test(text)) {
    return 'database';
  }
  if (/\b(next dev|vite|webpack serve|start:dev|dev server|pnpm dev|npm run dev)\b/.test(text)) {
    return 'development-server';
  }
  if (/\b(next build|vite build|webpack|rollup|tsc|build)\b/.test(text)) {
    return 'build-tool';
  }
  if (
    /\b(verify|format|prettier|lint|eslint|typecheck|type-check|test|vitest|jest|playwright)\b/.test(
      text,
    )
  ) {
    return 'local-verification';
  }
  return 'local-command';
}

function normalizeStructuredLogSeverity(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError('Structured log severity must be a non-negative integer or string.');
    }
    if (value >= 60) {
      return 'critical';
    }
    if (value === 0 || value >= 50) {
      return 'error';
    }
    if (value === 1 || value >= 40) {
      return 'warning';
    }
    return 'info';
  }

  const severity = optionalString(value, 'severity', 20)?.toLowerCase() ?? 'error';
  if (/^\d+$/.test(severity)) {
    return normalizeStructuredLogSeverity(Number(severity));
  }
  return STRUCTURED_LOG_SEVERITY_ALIASES.get(severity) ?? severity;
}

export function createStructuredLogFailure(record, defaults = {}) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Structured log record must be an object.');
  }
  const error = record.error;
  const errorObject = error !== null && typeof error === 'object' ? error : {};
  return normalizeExternalFailurePayload(
    {
      ...defaults,
      sourceType: defaults.sourceType ?? 'api-log',
      environment: record.environment ?? defaults.environment,
      severity: normalizeStructuredLogSeverity(
        record.level ?? record.severity ?? defaults.severity ?? 'error',
      ),
      occurredAt: record.timestamp ?? record.time ?? defaults.occurredAt,
      service: record.service ?? defaults.service,
      component: record.component ?? defaults.component,
      operation: record.operation ?? record.route ?? defaults.operation ?? 'Structured log failure',
      traceId: record.traceId ?? record.trace_id ?? defaults.traceId,
      release: record.release ?? defaults.release,
      summary: record.message ?? errorObject.message ?? defaults.summary,
      details: errorObject.stack ?? record.stack ?? record.details ?? defaults.details,
      evidenceUrls: record.evidenceUrls ?? defaults.evidenceUrls,
    },
    defaults,
  );
}

export function createSecurityScannerFailure(report, defaults = {}) {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new TypeError('Security scanner report must be an object.');
  }
  const findingCount = Number(report.findingCount ?? report.findings?.length ?? 0);
  if (!Number.isSafeInteger(findingCount) || findingCount < 1) {
    throw new TypeError('Security scanner intake requires at least one finding.');
  }
  const scanner = requiredString(report.scanner ?? defaults.scanner, 'scanner', 120);
  const highestSeverity =
    optionalString(
      report.highestSeverity ?? report.severity ?? defaults.severity,
      'highestSeverity',
      40,
    ) ?? 'error';
  const ruleIds = Array.from(
    new Set(
      (report.findings ?? [])
        .map((finding) => optionalString(finding?.ruleId ?? finding?.rule_id, 'ruleId', 120))
        .filter(Boolean),
    ),
  ).slice(0, 20);

  return normalizeExternalFailurePayload(
    {
      ...defaults,
      sourceType: 'security-scanner',
      severity: highestSeverity === 'critical' ? 'critical' : 'error',
      operation: `${scanner} security scan`,
      summary: `${scanner} reported ${findingCount} security finding(s).`,
      details: ruleIds.length === 0 ? null : `Rule IDs: ${ruleIds.join(', ')}`,
      evidenceUrls: report.evidenceUrls ?? defaults.evidenceUrls,
    },
    defaults,
  );
}

export function createPerformanceRegressionFailure(report, defaults = {}) {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new TypeError('Performance report must be an object.');
  }
  const metric = requiredString(report.metric, 'metric', 120);
  const actual = Number(report.actual);
  const threshold = Number(report.threshold);
  const lowerIsBetter = report.lowerIsBetter !== false;
  if (!Number.isFinite(actual) || !Number.isFinite(threshold)) {
    throw new TypeError('Performance actual and threshold values must be finite numbers.');
  }
  const regressed = lowerIsBetter ? actual > threshold : actual < threshold;
  if (!regressed) {
    throw new RangeError('Performance result does not exceed its configured regression threshold.');
  }
  const unit = optionalString(report.unit, 'unit', 40) ?? '';

  return normalizeExternalFailurePayload(
    {
      ...defaults,
      sourceType: 'performance-regression',
      severity: report.severity ?? 'warning',
      operation: report.operation ?? `${metric} performance budget`,
      summary: `${metric} regressed to ${actual}${unit}; threshold is ${threshold}${unit}.`,
      details: report.details,
      evidenceUrls: report.evidenceUrls ?? defaults.evidenceUrls,
    },
    defaults,
  );
}

export function parseEngineeringEventInput(value) {
  const text = String(value ?? '').trim();
  if (text.length === 0) {
    return [];
  }
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new TypeError('JSON array input must contain engineering event objects.');
    }
    return parsed;
  }
  if (text.startsWith('{')) {
    try {
      return [JSON.parse(text)];
    } catch {
      // Fall through to NDJSON parsing.
    }
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function createEngineeringIngestSignature(secret, rawBody, timestampSeconds) {
  const key = requiredString(secret, 'secret', 4_096);
  const timestamp = Number(timestampSeconds);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1) {
    throw new TypeError('timestampSeconds must be a positive safe integer.');
  }
  return createHmac('sha256', key).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyEngineeringIngestSignature({
  secret,
  rawBody,
  timestampHeader,
  signatureHeader,
  now = Date.now,
  maximumAgeSeconds = 300,
}) {
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1) {
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(now() / 1_000) - timestamp);
  if (ageSeconds > maximumAgeSeconds) {
    return false;
  }
  const supplied = String(signatureHeader ?? '').replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(supplied)) {
    return false;
  }
  const expected = createEngineeringIngestSignature(secret, rawBody, timestamp);
  return timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'));
}
