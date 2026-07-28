import {
  type ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpSecurityError, type HttpSecurityMethod } from '@newax/http-security';

import { AuditHttpSecuritySink } from '../audit/http-security-audit.sink';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';
import { SystemHttpSecurityClock } from './node-http-security.infrastructure';

interface CodedError {
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

interface MappedHttpError {
  readonly statusCode: number;
  readonly publicCode: string;
  readonly publicMessage: string;
  readonly internalCode: string;
  readonly retryAfterSeconds: number | null;
}

const KNOWN_ERROR_CODE_PATTERN =
  /^(ORGANIZATION|PERSON|PEOPLE_INTAKE|CONTACT|ADDRESS|OBJECT|MEMBERSHIP|ACCESS|USER|AUTHENTICATION|REQUEST_CONTEXT|HTTP_SECURITY)_[A-Z0-9_]+$/u;

@Catch()
@Injectable()
export class HttpSecurityExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpSecurityExceptionFilter.name);

  constructor(
    @Inject(AuditHttpSecuritySink)
    private readonly auditSink: AuditHttpSecuritySink,
    @Inject(SystemHttpSecurityClock)
    private readonly clock: SystemHttpSecurityClock,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpSecurityRequestAdapter>();
    const response = http.getResponse<HttpSecurityResponseAdapter>();
    const mapped = this.mapError(exception);
    const requestId = request.newaxRequestId ?? 'unavailable';
    const context = request.trustedContext;

    if (mapped.retryAfterSeconds !== null) {
      response.setHeader('Retry-After', String(mapped.retryAfterSeconds));
    }

    try {
      await this.auditSink.record({
        requestId: requestId.slice(0, 128),
        actorUserId: context?.userId ?? null,
        organizationId: context?.scope === 'organization' ? context.organizationId : null,
        action: 'http.request.rejected',
        outcome: mapped.statusCode >= 500 ? 'failed' : 'denied',
        routeKey: (request.newaxRouteKey ?? 'unknown').slice(0, 128),
        method: this.normalizeMethod(request.method),
        statusCode: mapped.statusCode,
        ipAddress: this.safeIpAddress(request.ip),
        userAgent: this.singleHeader(request.headers['user-agent']),
        metadata: { internalCode: mapped.internalCode },
        occurredAt: this.clock.now(),
      });
    } catch (auditError: unknown) {
      this.logger.error({
        event: 'http.audit.write_failed',
        requestId,
        errorType: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
    }

    if (mapped.statusCode >= 500) {
      this.logger.error({
        event: 'http.request.failed',
        requestId,
        internalCode: mapped.internalCode,
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
      });
    }

    response.status(mapped.statusCode).json({
      error: {
        code: mapped.publicCode,
        message: mapped.publicMessage,
        requestId,
      },
    });
  }

  private mapError(exception: unknown): MappedHttpError {
    if (exception instanceof HttpSecurityError) {
      return this.mapped(exception.statusCode, exception.code, this.retryAfter(exception.details));
    }

    const coded = this.asCodedError(exception);
    if (coded !== null) {
      return this.mapped(this.statusForCode(coded.code), coded.code, null);
    }

    if (exception instanceof HttpException) {
      return this.mapped(
        this.normalizeStatusCode(exception.getStatus()),
        `HTTP_${String(exception.getStatus())}`,
        null,
      );
    }

    return this.mapped(500, 'UNHANDLED_ERROR', null);
  }

  private mapped(
    statusCode: number,
    internalCode: string,
    retryAfterSeconds: number | null,
  ): MappedHttpError {
    return {
      statusCode,
      publicCode: this.publicCode(statusCode),
      publicMessage: this.publicMessage(statusCode),
      internalCode,
      retryAfterSeconds,
    };
  }

  private asCodedError(exception: unknown): CodedError | null {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string' &&
      KNOWN_ERROR_CODE_PATTERN.test(exception.code)
    ) {
      return exception as CodedError;
    }
    return null;
  }

  private statusForCode(code: string): number {
    if (code.endsWith('_AUTHENTICATION_REQUIRED') || code === 'AUTHENTICATION_FAILED') {
      return 401;
    }
    if (
      code.endsWith('_FORBIDDEN') ||
      code.endsWith('_MEMBERSHIP_UNAVAILABLE') ||
      code.endsWith('_PLATFORM_CONTEXT_REQUIRED')
    ) {
      return 403;
    }
    if (code.endsWith('_NOT_FOUND')) {
      return 404;
    }
    if (code.includes('_CONFLICT') || code.includes('_ALREADY_')) {
      return 409;
    }
    if (
      code.endsWith('_INVALID_INPUT') ||
      code.endsWith('_CURSOR_INVALID') ||
      code.endsWith('_POLICY_FAILED')
    ) {
      return 400;
    }
    if (code.endsWith('_UNAVAILABLE')) {
      return 409;
    }
    return 500;
  }

  private normalizeStatusCode(statusCode: number): number {
    return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;
  }

  private publicCode(statusCode: number): string {
    if (statusCode === 400 || statusCode === 422) {
      return 'INVALID_REQUEST';
    }
    if (statusCode === 401) {
      return 'AUTHENTICATION_REQUIRED';
    }
    if (statusCode === 403) {
      return 'FORBIDDEN';
    }
    if (statusCode === 404) {
      return 'NOT_FOUND';
    }
    if (statusCode === 405) {
      return 'METHOD_NOT_ALLOWED';
    }
    if (statusCode === 409) {
      return 'CONFLICT';
    }
    if (statusCode === 413) {
      return 'PAYLOAD_TOO_LARGE';
    }
    if (statusCode === 415) {
      return 'UNSUPPORTED_MEDIA_TYPE';
    }
    if (statusCode === 429) {
      return 'RATE_LIMITED';
    }
    return 'INTERNAL_ERROR';
  }

  private publicMessage(statusCode: number): string {
    if (statusCode === 400 || statusCode === 422) {
      return 'The request is invalid.';
    }
    if (statusCode === 401) {
      return 'Authentication is required.';
    }
    if (statusCode === 403) {
      return 'The request is not allowed.';
    }
    if (statusCode === 404) {
      return 'The requested resource was not found.';
    }
    if (statusCode === 405) {
      return 'The HTTP method is not allowed.';
    }
    if (statusCode === 409) {
      return 'The request conflicts with the current resource state.';
    }
    if (statusCode === 413) {
      return 'The request body is too large.';
    }
    if (statusCode === 415) {
      return 'The request content type is not supported.';
    }
    if (statusCode === 429) {
      return 'Too many requests. Try again later.';
    }
    return 'The request could not be completed.';
  }

  private retryAfter(details: Readonly<Record<string, unknown>>): number | null {
    const value = details.retryAfterSeconds;
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
  }

  private normalizeMethod(value: string): HttpSecurityMethod {
    const method = value.toUpperCase();
    if (
      method === 'GET' ||
      method === 'HEAD' ||
      method === 'OPTIONS' ||
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE'
    ) {
      return method;
    }
    return 'GET';
  }

  private safeIpAddress(value: string | undefined): string | null {
    return value === undefined ? null : value.slice(0, 64);
  }

  private singleHeader(value: string | readonly string[] | undefined): string | null {
    return typeof value === 'string' ? value.slice(0, 1_024) : null;
  }
}
