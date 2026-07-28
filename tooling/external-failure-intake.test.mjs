import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserEngineeringReporter } from './browser-engineering-reporter.mjs';
import { createLearningEventFromExternalFailure } from './deliver-engineering-event.mjs';
import { createEngineeringEventReceiver } from './engineering-event-receiver.mjs';
import {
  classifyCommandSource,
  createEngineeringIngestSignature,
  createPerformanceRegressionFailure,
  createSecurityScannerFailure,
  createStructuredLogFailure,
  normalizeExternalFailurePayload,
  parseEngineeringEventInput,
  verifyEngineeringIngestSignature,
} from './external-failure-intake.mjs';
import { installNodeRuntimeFailureCapture } from './node-runtime-engineering-capture.mjs';

test('normalizes every required external environment and strips URL credentials', () => {
  for (const environment of [
    'local',
    'development',
    'test',
    'preview',
    'staging',
    'production',
    'ci',
  ]) {
    const event = normalizeExternalFailurePayload({
      sourceType: 'runtime-exception',
      environment,
      summary: 'Runtime failed.',
      evidenceUrls: ['https://user:password@example.test/path?token=hidden#fragment'],
    });

    assert.equal(event.environment, environment);
    assert.deepEqual(event.evidenceUrls, ['https://example.test/path']);
  }
});

test('rejects unsupported source types and abbreviated commit SHAs', () => {
  assert.throws(
    () => normalizeExternalFailurePayload({ sourceType: 'magic', summary: 'Failed.' }),
    /Unsupported engineering source type/,
  );
  assert.throws(
    () =>
      normalizeExternalFailurePayload({
        sourceType: 'api-log',
        summary: 'Failed.',
        commitSha: 'abc1234',
      }),
    /full 40-character/,
  );
});

test('classifies command wrappers by the tool that actually failed', () => {
  assert.equal(classifyCommandSource('pnpm', ['install']), 'package-manager');
  assert.equal(classifyCommandSource('pnpm', ['--filter', '@newax/api', 'db:migrate']), 'database');
  assert.equal(classifyCommandSource('pnpm', ['dev']), 'development-server');
  assert.equal(classifyCommandSource('next', ['build']), 'build-tool');
  assert.equal(classifyCommandSource('pnpm', ['lint']), 'local-verification');
  assert.equal(classifyCommandSource('custom-tool', ['run']), 'local-command');
});

test('adapts structured API logs without inventing a root cause', () => {
  const event = createStructuredLogFailure(
    {
      timestamp: '2026-07-16T17:00:00Z',
      level: 'error',
      service: 'registry-api',
      environment: 'production',
      route: 'POST /organizations',
      message: 'Request failed.',
      traceId: 'trace-123',
      error: { stack: 'Error: Request failed.\n at handler' },
    },
    { sourceType: 'api-log' },
  );

  assert.equal(event.sourceType, 'api-log');
  assert.equal(event.environment, 'production');
  assert.equal(event.operation, 'POST /organizations');
  assert.equal(event.traceId, 'trace-123');
});

test('maps common structured logger severities into the governed severity set', () => {
  const cases = [
    ['warn', 'warning'],
    ['fatal', 'critical'],
    ['debug', 'info'],
    [0, 'error'],
    [1, 'warning'],
    [2, 'info'],
    [20, 'info'],
    [40, 'warning'],
    [50, 'error'],
    [60, 'critical'],
    ['30', 'info'],
  ];

  for (const [level, expected] of cases) {
    const event = createStructuredLogFailure({
      level,
      message: `Logger emitted ${String(level)}.`,
    });

    assert.equal(event.severity, expected);
  }
});

test('adapts security findings and refuses empty scanner reports', () => {
  const event = createSecurityScannerFailure({
    scanner: 'CodeQL',
    findings: [{ ruleId: 'js/sql-injection' }, { ruleId: 'js/path-injection' }],
    highestSeverity: 'critical',
  });

  assert.equal(event.sourceType, 'security-scanner');
  assert.equal(event.severity, 'critical');
  assert.match(event.details, /js\/sql-injection/);
  assert.throws(
    () => createSecurityScannerFailure({ scanner: 'CodeQL', findings: [] }),
    /at least one finding/,
  );
});

test('records only actual performance regressions', () => {
  const event = createPerformanceRegressionFailure({
    metric: 'LCP',
    actual: 3.2,
    threshold: 2.5,
    unit: 's',
  });

  assert.equal(event.sourceType, 'performance-regression');
  assert.match(event.summary, /3.2s/);
  assert.throws(
    () =>
      createPerformanceRegressionFailure({
        metric: 'LCP',
        actual: 2,
        threshold: 2.5,
        unit: 's',
      }),
    /does not exceed/,
  );
});

test('parses object, array, and NDJSON event input', () => {
  assert.equal(parseEngineeringEventInput('{"summary":"one"}').length, 1);
  assert.equal(parseEngineeringEventInput('[{"summary":"one"},{"summary":"two"}]').length, 2);
  assert.equal(parseEngineeringEventInput('{"summary":"one"}\n{"summary":"two"}').length, 2);
});

test('authenticates server-to-server intake and rejects stale or changed requests', () => {
  const secret = 'a'.repeat(32);
  const rawBody = '{"summary":"failure"}';
  const timestamp = 1_800_000_000;
  const signature = createEngineeringIngestSignature(secret, rawBody, timestamp);

  assert.equal(
    verifyEngineeringIngestSignature({
      secret,
      rawBody,
      timestampHeader: String(timestamp),
      signatureHeader: `sha256=${signature}`,
      now: () => timestamp * 1_000,
    }),
    true,
  );
  assert.equal(
    verifyEngineeringIngestSignature({
      secret,
      rawBody: `${rawBody} `,
      timestampHeader: String(timestamp),
      signatureHeader: `sha256=${signature}`,
      now: () => timestamp * 1_000,
    }),
    false,
  );
  assert.equal(
    verifyEngineeringIngestSignature({
      secret,
      rawBody,
      timestampHeader: String(timestamp),
      signatureHeader: `sha256=${signature}`,
      now: () => (timestamp + 301) * 1_000,
    }),
    false,
  );
});

test('receiver accepts one signed event and rejects an invalid signature', async () => {
  const secret = 'b'.repeat(32);
  const accepted = [];
  const nowSeconds = 1_800_000_000;
  const server = createEngineeringEventReceiver({
    secret,
    now: () => nowSeconds * 1_000,
    sink: async (payload) => {
      accepted.push(payload);
      return { delivery: 'test' };
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const rawBody = JSON.stringify({
    sourceType: 'runtime-exception',
    environment: 'staging',
    summary: 'Staging runtime failed.',
  });
  const signature = createEngineeringIngestSignature(secret, rawBody, nowSeconds);

  try {
    const acceptedResponse = await fetch(`http://127.0.0.1:${address.port}/engineering-events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-newax-event-timestamp': String(nowSeconds),
        'x-newax-event-signature': `sha256=${signature}`,
      },
      body: rawBody,
    });
    assert.equal(acceptedResponse.status, 202);
    assert.equal(accepted.length, 1);

    const rejectedResponse = await fetch(`http://127.0.0.1:${address.port}/engineering-events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-newax-event-timestamp': String(nowSeconds),
        'x-newax-event-signature': `sha256=${'0'.repeat(64)}`,
      },
      body: rawBody,
    });
    assert.equal(rejectedResponse.status, 401);
    assert.equal(accepted.length, 1);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
});

test('browser reporter rejects cross-origin relay endpoints', () => {
  const windowObject = { location: { href: 'https://app.example.test/page' } };

  assert.throws(
    () =>
      createBrowserEngineeringReporter({
        endpoint: 'https://collector.example.test/engineering-events',
        windowObject,
        fetchImplementation: async () => ({ ok: true }),
      }),
    /same-origin endpoint/,
  );
});

test('browser reporter sends sanitized same-origin payloads without repository credentials', async () => {
  const requests = [];
  const listeners = new Map();
  const windowObject = {
    location: { href: 'https://app.example.test/page?token=hidden#section' },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
  };
  const reporter = createBrowserEngineeringReporter({
    endpoint: '/api/internal/engineering-events',
    environment: 'preview',
    service: 'web',
    windowObject,
    fetchImplementation: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
  });

  const uninstall = reporter.install();
  listeners.get('error')({
    error: new Error('token=hidden browser failure'),
    filename: 'https://app.example.test/app.js?secret=hidden',
  });
  await new Promise((resolve) => setImmediate(resolve));
  uninstall();

  assert.equal(requests.length, 1);
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.summary.includes('hidden'), false);
  assert.deepEqual(payload.evidenceUrls, ['https://app.example.test/app.js']);
  assert.equal('githubToken' in payload, false);
});

test('node runtime monitor queues uncaught exceptions without replacing process behavior', async () => {
  const { EventEmitter } = await import('node:events');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const processObject = new EventEmitter();
  const directory = mkdtempSync(join(tmpdir(), 'newax-runtime-capture-'));
  const queuePath = join(directory, 'events.ndjson');
  const uninstall = installNodeRuntimeFailureCapture(
    { environment: 'staging', service: 'api' },
    {
      processObject,
      deliveryOptions: { delivery: 'queue', queuePath },
    },
  );

  try {
    processObject.emit(
      'uncaughtExceptionMonitor',
      new Error('runtime failed'),
      'uncaughtException',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const queued = readFileSync(queuePath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(queued.length, 1);
    assert.equal(queued[0].sourceType, 'runtime-exception');
    assert.equal(queued[0].externalContext.environment, 'staging');
  } finally {
    uninstall();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('delivery projection redacts external context before persistence', () => {
  const event = createLearningEventFromExternalFailure({
    sourceType: 'deployment',
    environment: 'preview',
    service: 'api_key=service-secret',
    component: 'password=component-secret',
    release: 'Bearer abcdefghijklmnopqrstuvwxyz',
    traceId: 'token=trace-secret',
    operation: 'Preview deployment',
    summary: 'Deployment failed.',
  });

  assert.equal(event.externalContext.service, 'api_key=<redacted>');
  assert.equal(event.externalContext.component, 'password=<redacted>');
  assert.equal(event.externalContext.release, 'Bearer <redacted-token>');
  assert.equal(event.externalContext.traceId, 'token=<redacted>');
  assert.equal(event.jobName.includes('service-secret'), false);
  assert.equal(JSON.stringify(event.externalContext).includes('secret'), false);
});

test('delivery projection preserves environment and service context', () => {
  const event = createLearningEventFromExternalFailure({
    sourceType: 'deployment',
    environment: 'preview',
    service: 'web',
    release: 'release-123',
    operation: 'Preview deployment',
    summary: 'Deployment failed.',
  });

  assert.equal(event.workflowName, 'External intake: deployment');
  assert.equal(event.jobName, 'preview / web / release-123');
  assert.equal(event.externalContext.environment, 'preview');
});
