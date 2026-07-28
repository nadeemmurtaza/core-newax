# NEWAX External Failure Intake

## Status

Implemented repository standard for Engineering Intelligence System module 2. Environment-specific activation remains deployment-dependent and must be verified separately.

The external intake layer converts failures outside pull requests into the same sanitized, deduplicated engineering-learning record used for GitHub Actions failures.

## Outcome

Operational failures should not disappear merely because they occurred in a terminal, development server, browser, deployment platform, database, runtime process, scanner, or performance tool.

Every connected source must emit one versioned event envelope. The collector then validates, sanitizes, classifies, queues or delivers, fingerprints, and records the occurrence.

## Event envelope

```json
{
  "schemaVersion": 1,
  "sourceType": "runtime-exception",
  "environment": "production",
  "severity": "error",
  "occurredAt": "2026-07-16T17:00:00.000Z",
  "sourceId": "provider-occurrence-id",
  "repository": "Newax-Technologies/core-newax",
  "commitSha": "full-40-character-sha",
  "service": "registry-api",
  "component": "organization-controller",
  "operation": "POST /organizations",
  "release": "release-2026-07-16.1",
  "traceId": "trace-123",
  "summary": "The request failed.",
  "details": "Bounded stack or diagnostic evidence.",
  "evidenceUrls": ["https://observability.example.test/incidents/123"]
}
```

Required fields are `sourceType` and `summary`. The collector creates a stable `sourceId` when the producer does not provide one.

## Source and environment model

Production, staging, and preview are environments rather than root causes. They are recorded independently from the observable source.

| Requested source        | Event source type                                                           | Environment                                  |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| Local verification      | `local-verification`                                                        | `local`                                      |
| Development server      | `development-server`                                                        | `development`                                |
| Runtime exceptions      | `runtime-exception`                                                         | any                                          |
| Production              | runtime, API, browser, deployment, database, scanner, or performance source | `production`                                 |
| Staging                 | runtime, API, browser, deployment, database, scanner, or performance source | `staging`                                    |
| Preview deployments     | `deployment`                                                                | `preview`                                    |
| Build tools             | `build-tool`                                                                | local, CI, preview, staging, or production   |
| Package manager         | `package-manager`                                                           | local or CI                                  |
| Database                | `database`                                                                  | any                                          |
| Browser console         | `browser-console`                                                           | development, preview, staging, or production |
| API logs                | `api-log`                                                                   | any                                          |
| Security scanners       | `security-scanner`                                                          | local, CI, preview, staging, or production   |
| Performance regressions | `performance-regression`                                                    | any                                          |

## Capture paths

### Local verification, build tools, package managers, databases, and development servers

Wrap a command:

```bash
pnpm learning:run pnpm lint
pnpm learning:run pnpm install --frozen-lockfile
pnpm learning:run pnpm --filter @newax/api db:migrate:deploy
pnpm learning:run pnpm dev
```

The wrapper classifies the failing tool, preserves its exit code, queues bounded output in `.newax/engineering-events.ndjson`, and does not alter successful commands.

Flush queued events only from a trusted environment:

```bash
GITHUB_TOKEN=... GITHUB_REPOSITORY=Newax-Technologies/core-newax pnpm learning:flush
```

### Structured runtime and API logs

Send one JSON object, a JSON array, or NDJSON:

```bash
cat runtime-errors.ndjson | pnpm learning:ingest
pnpm learning:ingest --file security-report.json
```

`createStructuredLogFailure` maps common timestamp, level, message, service, route, trace, error, and stack fields into the governed envelope.

### Node.js runtime exceptions

Applications may install the runtime monitor:

```js
import { installNodeRuntimeFailureCapture } from './tooling/node-runtime-engineering-capture.mjs';

const uninstall = installNodeRuntimeFailureCapture({
  environment: process.env.APP_ENV,
  service: 'registry-api',
  release: process.env.RELEASE_ID,
});
```

The default listener uses `uncaughtExceptionMonitor`, so it observes an exception without replacing Node.js termination behavior. Capturing unhandled rejections is opt-in because adding that listener changes Node.js process behavior.

### Production, staging, preview, deployment, scanners, and performance tools

Trusted automation may call GitHub `repository_dispatch` using event type `engineering_mistake`, or send a signed request to the receiver:

```text
POST /engineering-events
Content-Type: application/json
X-NEWAX-Event-Timestamp: <unix-seconds>
X-NEWAX-Event-Signature: sha256=<hmac>
```

The signature is HMAC-SHA256 over:

```text
<timestamp>.<raw-request-body>
```

The receiver rejects stale timestamps, changed bodies, invalid signatures, unsupported content types, multiple events per request, and oversized payloads.

### Browser console and browser runtime errors

The browser reporter captures `window.error`, `unhandledrejection`, and optionally `console.error` while preserving the original console behavior.

```js
import { createBrowserEngineeringReporter } from './tooling/browser-engineering-reporter.mjs';

const reporter = createBrowserEngineeringReporter({
  endpoint: '/api/internal/engineering-events',
  environment: 'production',
  service: 'web',
  release: window.__RELEASE_ID__,
});

reporter.install({ captureConsoleErrors: true });
```

The browser must send to a first-party authenticated application endpoint. Never place a GitHub token or `ENGINEERING_INGEST_SECRET` in browser code. The application endpoint must forward server-side through the signed receiver or repository dispatch path.

### Security scanners

`createSecurityScannerFailure` records only reports containing at least one finding. It stores the scanner name, count, highest severity, bounded rule identifiers, and evidence URLs without claiming that a finding is exploitable.

### Performance regressions

`createPerformanceRegressionFailure` creates an event only when the configured budget is actually exceeded. It records the metric, actual value, threshold, unit, environment, release, and evidence URL.

## Security controls

- External payloads are bounded before persistence.
- Common credentials, tokens, private keys, and connection credentials are redacted.
- Evidence URLs are restricted to HTTP or HTTPS and have credentials, query strings, and fragments removed.
- Commit identifiers must be full 40-character SHAs.
- Browser code contains no repository credential or ingestion secret.
- The server receiver requires a minimum 32-character secret and freshness-checked HMAC signatures.
- Raw production logs are not copied into issue summaries.
- Root-cause status remains `candidate` unless deterministic evidence or human confirmation supports it.

## Operational activation

The repository provides the event contract, command wrapper, queue, JSON and NDJSON ingest, signed receiver, Node runtime monitor, browser reporter, scanner adapter, performance adapter, GitHub dispatch workflow, sanitization, and tests.

Each real environment still requires its own deployment hook, first-party browser relay, runtime import, scanner export, or performance-budget command. Missing credentials or deployment access must be reported as an activation blocker rather than disguised as completed integration.
