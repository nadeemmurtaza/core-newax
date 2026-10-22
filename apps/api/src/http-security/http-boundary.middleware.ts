import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import {
  SecurityHeadersPolicy,
  type HttpSecurityAuditSink,
  type HttpSecurityMethod,
  type HttpSecurityPolicy,
} from '@newax/http-security';

import { AuditHttpSecuritySink } from '../audit/http-security-audit.sink';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';
import { HTTP_SECURITY_POLICY } from './http-security.tokens';
import { HttpRequestIdFactory, SystemHttpSecurityClock } from './node-http-security.infrastructure';

const SUPPORTED_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);
const BODYLESS_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class HttpBoundaryMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpBoundaryMiddleware.name);
  private readonly headersPolicy: SecurityHeadersPolicy;

  constructor(
    @Inject(HTTP_SECURITY_POLICY)
    private readonly policy: HttpSecurityPolicy,
    @Inject(HttpRequestIdFactory)
    private readonly requestIds: HttpRequestIdFactory,
    @Inject(SystemHttpSecurityClock)
    private readonly clock: SystemHttpSecurityClock,
    @Inject(AuditHttpSecuritySink)
    private readonly auditSink: HttpSecurityAuditSink,
  ) {
    this.headersPolicy = new SecurityHeadersPolicy(policy);
  }

  async use(
    request: HttpSecurityRequestAdapter,
    response: HttpSecurityResponseAdapter,
    next: () => void,
  ): Promise<void> {
    const requestId = this.requestIds.issue();
    request.newaxRequestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    const isSecure = request.secure === true || request.protocol === 'https';
    for (const [name, value] of Object.entries(this.headersPolicy.headers(isSecure))) {
      response.setHeader(name, value);
    }

    const method = request.method.toUpperCase();
    if (!SUPPORTED_METHODS.has(method) || request.headers['x-http-method-override'] !== undefined) {
      await this.reject(
        request,
        response,
        requestId,
        'http.method.rejected',
        'METHOD_NOT_ALLOWED',
        405,
        'HTTP method is not allowed.',
      );
      return;
    }

    if (request.headers.expect !== undefined) {
      await this.reject(
        request,
        response,
        requestId,
        'http.expectation.rejected',
        'INVALID_REQUEST',
        400,
        'HTTP expectation headers are not supported.',
      );
      return;
    }

    const contentLengthHeader = request.headers['content-length'];
    const transferEncodingHeader = request.headers['transfer-encoding'];
    const contentLength = this.contentLength(contentLengthHeader);
    const transferEncoding = this.transferEncoding(transferEncodingHeader);
    if (
      contentLength === null ||
      transferEncoding === false ||
      (contentLengthHeader !== undefined && transferEncodingHeader !== undefined)
    ) {
      await this.reject(
        request,
        response,
        requestId,
        'http.framing.rejected',
        'INVALID_REQUEST',
        400,
        'The HTTP request framing is invalid.',
      );
      return;
    }

    request.newaxHasBody = contentLength > 0 || transferEncoding === true;
    if (request.newaxHasBody && BODYLESS_METHODS.has(method)) {
      await this.reject(
        request,
        response,
        requestId,
        'http.body.rejected',
        'INVALID_REQUEST',
        400,
        'This HTTP method does not accept a request body.',
      );
      return;
    }
    if (contentLength > this.policy.bodyLimitBytes) {
      await this.reject(
        request,
        response,
        requestId,
        'http.body.rejected',
        'PAYLOAD_TOO_LARGE',
        413,
        'The request body is too large.',
      );
      return;
    }

    if (this.policy.requireHttps && !isSecure) {
      response.setHeader('Connection', 'close');
      await this.reject(
        request,
        response,
        requestId,
        'http.https.required',
        'HTTPS_REQUIRED',
        400,
        'HTTPS is required.',
      );
      return;
    }

    next();
  }

  private contentLength(header: string | readonly string[] | undefined): number | null {
    if (header === undefined) {
      return 0;
    }
    if (typeof header !== 'string' || !/^\d+$/u.test(header)) {
      return null;
    }
    const value = Number(header);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  private transferEncoding(header: string | readonly string[] | undefined): boolean | null | false {
    if (header === undefined) {
      return null;
    }
    if (typeof header !== 'string') {
      return false;
    }
    return header.trim().toLowerCase() === 'chunked' ? true : false;
  }

  private async reject(
    request: HttpSecurityRequestAdapter,
    response: HttpSecurityResponseAdapter,
    requestId: string,
    action: string,
    publicCode: string,
    statusCode: number,
    message: string,
  ): Promise<void> {
    const method = this.normalizeMethod(request.method);
    const routeKey = `${method} ${this.safePath(request)}`.slice(0, 128);
    try {
      await this.auditSink.record({
        requestId,
        actorUserId: null,
        organizationId: null,
        action,
        outcome: 'denied',
        routeKey,
        method,
        statusCode,
        ipAddress: this.safeIpAddress(request.ip),
        userAgent: this.singleHeader(request.headers['user-agent']),
        metadata: {},
        occurredAt: this.clock.now(),
      });
    } catch (error: unknown) {
      this.logger.error({
        event: 'http.audit.write_failed',
        requestId,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }

    response.status(statusCode).json({
      error: {
        code: publicCode,
        message,
        requestId,
      },
    });
  }

  private safePath(request: HttpSecurityRequestAdapter): string {
    const source = request.path ?? request.originalUrl ?? '/';
    const queryIndex = source.indexOf('?');
    const path = queryIndex < 0 ? source : source.slice(0, queryIndex);
    return path.length === 0 ? '/' : path;
  }

  private normalizeMethod(value: string): HttpSecurityMethod {
    const normalized = value.toUpperCase();
    return SUPPORTED_METHODS.has(normalized) ? (normalized as HttpSecurityMethod) : 'GET';
  }

  private safeIpAddress(value: string | undefined): string | null {
    return value === undefined ? null : value.slice(0, 64);
  }

  private singleHeader(value: string | readonly string[] | undefined): string | null {
    return typeof value === 'string' ? value.slice(0, 1_024) : null;
  }
}
