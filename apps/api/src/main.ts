import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import type { ApplicationEnvironment } from './config/environment';
import { HttpBoundaryMiddleware } from './http-security/http-boundary.middleware';

const API_PREFIX = 'api';

interface ExpressApplicationAdapter {
  set(name: string, value: unknown): void;
  disable(name: string): void;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
  });
  const configuration = app.get<ConfigService<ApplicationEnvironment, true>>(ConfigService);
  const host = configuration.get('HOST', { infer: true });
  const port = configuration.get('PORT', { infer: true });
  const bodyLimitBytes = configuration.get('HTTP_BODY_LIMIT_BYTES', {
    infer: true,
  });
  const allowedOrigins = configuration.get('HTTP_ALLOWED_ORIGINS', {
    infer: true,
  });
  const trustedProxyCidrs = configuration.get('HTTP_TRUSTED_PROXY_CIDRS', {
    infer: true,
  });
  const express = app.getHttpAdapter().getInstance() as ExpressApplicationAdapter;

  express.set('trust proxy', trustedProxyCidrs.length === 0 ? false : trustedProxyCidrs);
  express.disable('x-powered-by');

  const boundary = app.get(HttpBoundaryMiddleware);
  app.use(boundary.use.bind(boundary));
  app.useBodyParser('json', {
    limit: bodyLimitBytes,
    strict: true,
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ): void => {
      callback(null, origin === undefined || allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-newax-csrf', 'x-newax-membership-id'],
    exposedHeaders: [
      'x-request-id',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'retry-after',
    ],
    maxAge: 600,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log({
    event: 'api.started',
    host,
    port,
    apiPrefix: API_PREFIX,
    requireHttps: configuration.get('HTTP_REQUIRE_HTTPS', { infer: true }),
    trustedProxyNetworks: trustedProxyCidrs.length,
  });
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error({
    event: 'api.start_failed',
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
