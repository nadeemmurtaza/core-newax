import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CookieHeaderParser,
  HttpRateLimiter,
  HttpSecurityError,
  RequestOriginPolicy,
  SecureCookieTransport,
  SignedCsrfTokenService,
  type HttpSecurityContextMode,
  type HttpSecurityMethod,
  type HttpSecurityPolicy,
  type HttpSecurityRequest,
} from '@newax/http-security';
import {
  ContextAuthorizer,
  TrustedRequestContextService,
  type TrustedRequestContext,
} from '@newax/request-context';

import {
  HTTP_AUTHENTICATION_SENSITIVE_KEY,
  HTTP_CONTEXT_MODE_KEY,
  HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY,
  HTTP_PUBLIC_SIGNED_MUTATION_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from './http-security.decorators';
import type {
  HttpSecurityRequestAdapter,
  HttpSecurityResponseAdapter,
} from './http-security-request';
import { HTTP_SECURITY_POLICY } from './http-security.tokens';

@Injectable()
export class HttpSecurityGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(HTTP_SECURITY_POLICY)
    private readonly policy: HttpSecurityPolicy,
    @Inject(CookieHeaderParser)
    private readonly cookieParser: CookieHeaderParser,
    @Inject(SecureCookieTransport)
    private readonly cookieTransport: SecureCookieTransport,
    @Inject(RequestOriginPolicy)
    private readonly originPolicy: RequestOriginPolicy,
    @Inject(SignedCsrfTokenService)
    private readonly csrfTokens: SignedCsrfTokenService,
    @Inject(HttpRateLimiter)
    private readonly rateLimiter: HttpRateLimiter,
    @Inject(TrustedRequestContextService)
    private readonly contexts: TrustedRequestContextService,
    @Inject(ContextAuthorizer)
    private readonly authorizer: ContextAuthorizer,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<HttpSecurityRequestAdapter>();
    const response = executionContext.switchToHttp().getResponse<HttpSecurityResponseAdapter>();
    const method = this.normalizeMethod(request.method);
    const routeKey =
      `${executionContext.getClass().name}.${executionContext.getHandler().name}`.slice(0, 128);
    request.newaxRouteKey = routeKey;
    request.newaxSecurityMethod = method;

    const requestId = this.requireRequestId(request.newaxRequestId);
    const securityRequest = this.toSecurityRequest(request, requestId, routeKey, method);
    request.newaxSecurityRequest = securityRequest;

    const authenticationSensitive =
      this.reflector.getAllAndOverride<boolean>(HTTP_AUTHENTICATION_SENSITIVE_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? false;
    const rateLimit = await this.rateLimiter.consume(
      `${this.safeIpAddress(request.ip)}|${routeKey}`,
      authenticationSensitive,
    );
    response.setHeader(
      'RateLimit-Limit',
      String(
        authenticationSensitive
          ? this.policy.authenticationRateLimitMaximumRequests
          : this.policy.rateLimitMaximumRequests,
      ),
    );
    response.setHeader('RateLimit-Remaining', String(rateLimit.remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil(rateLimit.resetAt.getTime() / 1_000)));

    this.originPolicy.validate(securityRequest);
    const contextMode =
      this.reflector.getAllAndOverride<HttpSecurityContextMode>(HTTP_CONTEXT_MODE_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? 'organization';
    const requiredPermissions =
      this.reflector.getAllAndOverride<readonly string[]>(HTTP_REQUIRED_PERMISSIONS_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? [];
    const publicAuthenticationMutation =
      this.reflector.getAllAndOverride<boolean>(HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? false;
    const publicSignedMutation =
      this.reflector.getAllAndOverride<boolean>(HTTP_PUBLIC_SIGNED_MUTATION_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? false;
    const stateChanging = this.originPolicy.isStateChanging(method);
    this.assertMetadataCompatibility(
      contextMode,
      requiredPermissions,
      authenticationSensitive,
      publicAuthenticationMutation,
      publicSignedMutation,
      stateChanging,
    );

    request.newaxStateChanging = stateChanging;
    request.newaxRequiredPermissions = [...requiredPermissions];

    if (contextMode === 'public') {
      if (stateChanging && !publicAuthenticationMutation && !publicSignedMutation) {
        throw new HttpSecurityError(
          'HTTP_SECURITY_FORBIDDEN',
          'Unauthenticated state-changing HTTP endpoints are not enabled.',
          403,
        );
      }
      // A signed-mutation endpoint authenticates itself (e.g. a request-signature
      // guard applied at the controller) instead of via session/CSRF — this guard's
      // job for such a route ends here, having confirmed the metadata is internally
      // consistent below.
      return true;
    }

    const cookies = this.cookieParser.parse(this.singleHeader(request.headers.cookie, 8_192));
    if (cookies.sessionToken === null) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
        'A valid authenticated session is required.',
        401,
      );
    }

    const trustedContext = await this.resolveContext(
      contextMode,
      cookies.sessionToken,
      this.singleHeader(request.headers[this.cookieTransport.membershipHeaderName], 128),
      requestId,
    );
    request.trustedContext = trustedContext;

    if (stateChanging) {
      this.csrfTokens.verify({
        sessionId: trustedContext.sessionId,
        cookieToken: cookies.csrfToken,
        headerToken: this.singleHeader(request.headers[this.cookieTransport.csrfHeaderName], 256),
      });
    }

    if (requiredPermissions.length > 0) {
      if (trustedContext.scope !== 'organization') {
        throw new HttpSecurityError(
          'HTTP_SECURITY_INVALID_INPUT',
          'Trusted organization context was not established.',
          500,
        );
      }
      this.authorizer.requireAllPermissions(trustedContext, requiredPermissions);
    }

    return true;
  }

  private assertMetadataCompatibility(
    contextMode: HttpSecurityContextMode,
    requiredPermissions: readonly string[],
    authenticationSensitive: boolean,
    publicAuthenticationMutation: boolean,
    publicSignedMutation: boolean,
    stateChanging: boolean,
  ): void {
    if (requiredPermissions.length > 0 && contextMode !== 'organization') {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Permission metadata requires organization context.',
        500,
      );
    }
    if (
      publicAuthenticationMutation &&
      (contextMode !== 'public' || !authenticationSensitive || !stateChanging)
    ) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Public authentication mutation metadata is inconsistent.',
        500,
      );
    }
    if (publicSignedMutation && (contextMode !== 'public' || !stateChanging)) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Public signed mutation metadata is inconsistent.',
        500,
      );
    }
    if (publicAuthenticationMutation && publicSignedMutation) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'An endpoint cannot be both a public authentication mutation and a public signed mutation.',
        500,
      );
    }
  }

  private async resolveContext(
    mode: Exclude<HttpSecurityContextMode, 'public'>,
    sessionToken: string,
    membershipId: string | null,
    requestId: string,
  ): Promise<TrustedRequestContext> {
    if (mode === 'account') {
      return this.contexts.resolveAccountContext({ sessionToken, requestId });
    }
    if (membershipId === null) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_FORBIDDEN',
        'An active organization membership is required.',
        403,
      );
    }
    return this.contexts.resolveOrganizationContext({
      sessionToken,
      membershipId,
      requestId,
    });
  }

  private toSecurityRequest(
    request: HttpSecurityRequestAdapter,
    requestId: string,
    routeKey: string,
    method: HttpSecurityMethod,
  ): HttpSecurityRequest {
    return {
      method,
      routeKey,
      requestId,
      origin: this.singleHeader(request.headers.origin, 2_048),
      referer: this.singleHeader(request.headers.referer, 4_096),
      fetchSite: this.singleHeader(request.headers['sec-fetch-site'], 32),
      contentType: this.singleHeader(request.headers['content-type'], 256),
      hasBody: request.newaxHasBody ?? false,
      ipAddress: this.safeIpAddress(request.ip),
      userAgent: this.singleHeader(request.headers['user-agent'], 1_024),
    };
  }

  private requireRequestId(value: string | undefined): string {
    if (value === undefined) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The HTTP request boundary did not establish a request identifier.',
        500,
      );
    }
    return value;
  }

  private normalizeMethod(method: string): HttpSecurityMethod {
    const normalized = method.toUpperCase();
    if (
      normalized === 'GET' ||
      normalized === 'HEAD' ||
      normalized === 'OPTIONS' ||
      normalized === 'POST' ||
      normalized === 'PUT' ||
      normalized === 'PATCH' ||
      normalized === 'DELETE'
    ) {
      return normalized;
    }
    throw new HttpSecurityError(
      'HTTP_SECURITY_INVALID_INPUT',
      'HTTP method is not supported.',
      405,
    );
  }

  private safeIpAddress(value: string | undefined): string {
    return value === undefined ? 'unresolved' : value.slice(0, 64);
  }

  private singleHeader(
    value: string | readonly string[] | undefined,
    maximumLength: number,
  ): string | null {
    if (value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'Duplicate security headers are not allowed.',
        400,
      );
    }
    if (value.length > maximumLength) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'A security-relevant HTTP header is too large.',
        400,
      );
    }
    return value;
  }
}
