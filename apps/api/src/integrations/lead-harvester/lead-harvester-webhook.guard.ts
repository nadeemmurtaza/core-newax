import { createHmac, timingSafeEqual } from 'node:crypto';

import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpSecurityError } from '@newax/http-security';

import type { ApplicationEnvironment } from '../../config/environment';

const TIMESTAMP_HEADER = 'x-lead-harvester-timestamp';
const SIGNATURE_HEADER = 'x-lead-harvester-signature';
const MAX_CLOCK_SKEW_SECONDS = 300;

interface SignedWebhookRequest {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly rawBody?: Buffer;
}

// Verifies an inbound Lead Harvester webhook call via a shared-secret HMAC
// signature over the raw request body, since the caller is a machine (no
// session cookie exists for it to present). Applied alongside
// PublicSignedMutationEndpoint(), which only tells HttpSecurityGuard that
// session/CSRF enforcement does not apply to this route -- this guard is what
// actually authenticates the caller.
@Injectable()
export class LeadHarvesterWebhookGuard implements CanActivate {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<ApplicationEnvironment, true>,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const request = executionContext.switchToHttp().getRequest<SignedWebhookRequest>();
    const secret = this.configService.get('LEAD_HARVESTER_WEBHOOK_SECRET', { infer: true });
    if (secret === undefined) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_FORBIDDEN',
        'The Lead Harvester integration is not configured.',
        503,
      );
    }

    const timestampHeader = this.singleHeader(request.headers[TIMESTAMP_HEADER]);
    const signatureHeader = this.singleHeader(request.headers[SIGNATURE_HEADER]);
    if (timestampHeader === null || signatureHeader === null) {
      throw this.unauthorized();
    }

    const timestampSeconds = Number(timestampHeader);
    if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) {
      throw this.unauthorized();
    }
    const skewSeconds = Math.abs(Date.now() / 1_000 - timestampSeconds);
    if (skewSeconds > MAX_CLOCK_SKEW_SECONDS) {
      throw this.unauthorized();
    }

    if (request.rawBody === undefined) {
      throw new HttpSecurityError(
        'HTTP_SECURITY_INVALID_INPUT',
        'The request body was not captured for signature verification.',
        500,
      );
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(`${timestampHeader}.`)
      .update(request.rawBody)
      .digest('hex');

    if (!this.signaturesMatch(expectedSignature, signatureHeader)) {
      throw this.unauthorized();
    }

    return true;
  }

  private signaturesMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      // Still run a constant-time comparison against dummy buffers so a
      // length mismatch doesn't return in observably less time.
      const dummy = Buffer.alloc(Math.max(expectedBuffer.length, providedBuffer.length, 1));
      timingSafeEqual(dummy, dummy);
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private singleHeader(value: string | readonly string[] | undefined): string | null {
    if (value === undefined || Array.isArray(value)) {
      return null;
    }
    return value as string;
  }

  private unauthorized(): HttpSecurityError {
    return new HttpSecurityError(
      'HTTP_SECURITY_AUTHENTICATION_REQUIRED',
      'A valid request signature is required.',
      401,
    );
  }
}
