import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  CookieHeaderParser,
  HttpRateLimiter,
  RequestOriginPolicy,
  SecureCookieTransport,
  SensitiveResponseRedactor,
  SignedCsrfTokenService,
  type HttpSecurityPolicy,
} from '@newax/http-security';

import { AuditModule } from '../audit/audit.module';
import type { ApplicationEnvironment } from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { HttpBoundaryMiddleware } from './http-boundary.middleware';
import { HttpSecurityExceptionFilter } from './http-security-exception.filter';
import { HttpSecurityGuard } from './http-security.guard';
import { HttpSecurityInterceptor } from './http-security.interceptor';
import { HTTP_SECURITY_POLICY } from './http-security.tokens';
import {
  HttpRequestIdFactory,
  NodeHttpSecurityCrypto,
  SystemHttpSecurityClock,
} from './node-http-security.infrastructure';
import { PrismaHttpRateLimitStore } from './prisma-http-rate-limit.store';

@Module({
  imports: [AuditModule, DatabaseModule, RequestContextModule],
  providers: [
    {
      provide: HTTP_SECURITY_POLICY,
      inject: [ConfigService],
      useFactory: (
        configuration: ConfigService<ApplicationEnvironment, true>,
      ): HttpSecurityPolicy => ({
        allowedOrigins: configuration.get('HTTP_ALLOWED_ORIGINS', {
          infer: true,
        }),
        requireHttps: configuration.get('HTTP_REQUIRE_HTTPS', { infer: true }),
        trustedProxyCidrs: configuration.get('HTTP_TRUSTED_PROXY_CIDRS', {
          infer: true,
        }),
        bodyLimitBytes: configuration.get('HTTP_BODY_LIMIT_BYTES', {
          infer: true,
        }),
        rateLimitWindowMilliseconds: configuration.get('HTTP_RATE_LIMIT_WINDOW_MILLISECONDS', {
          infer: true,
        }),
        rateLimitMaximumRequests: configuration.get('HTTP_RATE_LIMIT_MAXIMUM_REQUESTS', {
          infer: true,
        }),
        authenticationRateLimitMaximumRequests: configuration.get(
          'HTTP_AUTH_RATE_LIMIT_MAXIMUM_REQUESTS',
          { infer: true },
        ),
        hstsMaxAgeSeconds: configuration.get('HTTP_HSTS_MAX_AGE_SECONDS', {
          infer: true,
        }),
        hstsIncludeSubDomains: configuration.get('HTTP_HSTS_INCLUDE_SUBDOMAINS', { infer: true }),
        hstsPreload: configuration.get('HTTP_HSTS_PRELOAD', { infer: true }),
      }),
    },
    CookieHeaderParser,
    SecureCookieTransport,
    SensitiveResponseRedactor,
    SystemHttpSecurityClock,
    HttpRequestIdFactory,
    PrismaHttpRateLimitStore,
    {
      provide: NodeHttpSecurityCrypto,
      inject: [ConfigService],
      useFactory: (
        configuration: ConfigService<ApplicationEnvironment, true>,
      ): NodeHttpSecurityCrypto =>
        new NodeHttpSecurityCrypto(configuration.get('HTTP_CSRF_SECRET', { infer: true })),
    },
    {
      provide: RequestOriginPolicy,
      inject: [HTTP_SECURITY_POLICY],
      useFactory: (policy: HttpSecurityPolicy): RequestOriginPolicy =>
        new RequestOriginPolicy(policy.allowedOrigins),
    },
    {
      provide: SignedCsrfTokenService,
      inject: [NodeHttpSecurityCrypto],
      useFactory: (crypto: NodeHttpSecurityCrypto): SignedCsrfTokenService =>
        new SignedCsrfTokenService(crypto),
    },
    {
      provide: HttpRateLimiter,
      inject: [PrismaHttpRateLimitStore, SystemHttpSecurityClock, HTTP_SECURITY_POLICY],
      useFactory: (
        store: PrismaHttpRateLimitStore,
        clock: SystemHttpSecurityClock,
        policy: HttpSecurityPolicy,
      ): HttpRateLimiter => new HttpRateLimiter(store, clock, policy),
    },
    HttpBoundaryMiddleware,
    HttpSecurityGuard,
    HttpSecurityInterceptor,
    HttpSecurityExceptionFilter,
    {
      provide: APP_GUARD,
      useExisting: HttpSecurityGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: HttpSecurityInterceptor,
    },
    {
      provide: APP_FILTER,
      useExisting: HttpSecurityExceptionFilter,
    },
  ],
  exports: [
    CookieHeaderParser,
    SecureCookieTransport,
    SignedCsrfTokenService,
    HTTP_SECURITY_POLICY,
    HttpBoundaryMiddleware,
  ],
})
export class HttpSecurityModule {}
