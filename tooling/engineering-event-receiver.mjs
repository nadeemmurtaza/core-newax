import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { deliverExternalFailure } from './deliver-engineering-event.mjs';
import {
  parseEngineeringEventInput,
  verifyEngineeringIngestSignature,
} from './external-failure-intake.mjs';

const DEFAULT_MAXIMUM_BODY_BYTES = 131_072;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request, maximumBodyBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBodyBytes) {
      const error = new RangeError('Engineering event request exceeds the configured size limit.');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createEngineeringEventReceiver(options = {}) {
  const secret = options.secret ?? process.env.ENGINEERING_INGEST_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('ENGINEERING_INGEST_SECRET must contain at least 32 characters.');
  }
  const maximumBodyBytes = options.maximumBodyBytes ?? DEFAULT_MAXIMUM_BODY_BYTES;
  const sink =
    options.sink ?? ((payload) => deliverExternalFailure(payload, options.deliveryOptions));
  const now = options.now ?? Date.now;

  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/engineering-events') {
      sendJson(response, 404, { error: 'not_found' });
      return;
    }
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
      sendJson(response, 415, { error: 'application_json_required' });
      return;
    }

    try {
      const rawBody = await readRequestBody(request, maximumBodyBytes);
      const authorized = verifyEngineeringIngestSignature({
        secret,
        rawBody,
        timestampHeader: request.headers['x-newax-event-timestamp'],
        signatureHeader: request.headers['x-newax-event-signature'],
        now,
      });
      if (!authorized) {
        sendJson(response, 401, { error: 'invalid_engineering_event_signature' });
        return;
      }

      const payloads = parseEngineeringEventInput(rawBody);
      if (payloads.length !== 1) {
        sendJson(response, 400, { error: 'one_event_per_request' });
        return;
      }
      const result = await sink(payloads[0]);
      sendJson(response, 202, {
        accepted: true,
        delivery: result?.delivery ?? 'custom-sink',
        issueNumber: result?.issueNumber ?? null,
      });
    } catch (error) {
      if (error?.code === 'BODY_TOO_LARGE') {
        sendJson(response, 413, { error: 'payload_too_large' });
        return;
      }
      sendJson(response, 400, {
        error: 'invalid_engineering_event',
        message: String(error instanceof Error ? error.message : error),
      });
    }
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.ENGINEERING_INGEST_PORT ?? '8787');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('ENGINEERING_INGEST_PORT must be an integer from 1 through 65535.');
  }
  const server = createEngineeringEventReceiver();
  server.listen(port, '127.0.0.1', () => {
    console.log(`NEWAX engineering event receiver listening on 127.0.0.1:${port}.`);
  });
}
