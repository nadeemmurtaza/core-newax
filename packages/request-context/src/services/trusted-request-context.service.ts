import { RequestContextError } from '../errors/request-context-error';
import { ImmutablePermissionSet } from '../security/immutable-permission-set';
import type {
  ResolveAccountContextInput,
  ResolveOrganizationContextInput,
  TrustedAccountRequestContext,
  TrustedMembershipRecord,
  TrustedOrganizationRequestContext,
  TrustedSessionRecord,
} from '../types/request-context';
import type {
  RequestIdFactory,
  TrustedContextClock,
  TrustedMembershipDirectory,
  TrustedPermissionEvaluator,
  TrustedSessionValidator,
} from './request-context-ports';

const MAX_SESSION_TOKEN_LENGTH = 512;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_PERMISSION_CODE_LENGTH = 160;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PERMISSION_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export class TrustedRequestContextService {
  constructor(
    private readonly sessionValidator: TrustedSessionValidator,
    private readonly membershipDirectory: TrustedMembershipDirectory,
    private readonly permissionEvaluator: TrustedPermissionEvaluator,
    private readonly clock: TrustedContextClock,
    private readonly requestIdFactory: RequestIdFactory,
  ) {}

  async resolveAccountContext(
    input: ResolveAccountContextInput,
  ): Promise<TrustedAccountRequestContext> {
    const requestId = this.resolveRequestId(input.requestId);
    const sessionToken = this.normalizeSessionToken(input.sessionToken);
    if (sessionToken === null) {
      throw this.authenticationRequired();
    }

    const session = await this.sessionValidator.validateSession(sessionToken);
    if (session === null) {
      throw this.authenticationRequired();
    }
    this.assertSessionIntegrity(session);
    if (session.expiresAt <= this.requireDate(this.clock.now(), 'resolvedAt')) {
      throw this.authenticationRequired();
    }

    return Object.freeze({
      scope: 'account',
      requestId,
      userId: session.userId,
      personId: session.personId,
      sessionId: session.sessionId,
      sessionExpiresAt: new Date(session.expiresAt.getTime()),
    });
  }

  async resolveOrganizationContext(
    input: ResolveOrganizationContextInput,
  ): Promise<TrustedOrganizationRequestContext> {
    const accountContext = await this.resolveAccountContext(input);
    const membershipId = this.normalizeMembershipId(input.membershipId);
    const membership = await this.membershipDirectory.findMembershipById(membershipId);

    if (membership !== null && membership.id !== membershipId) {
      throw this.integrityFailure(
        'The membership directory returned a different membership identifier.',
      );
    }

    if (
      membership === null ||
      membership.personId !== accountContext.personId ||
      membership.membershipStatus !== 'active' ||
      membership.tenantStatus !== 'active' ||
      membership.organizationStatus !== 'active'
    ) {
      throw this.membershipUnavailable();
    }
    this.assertMembershipIntegrity(membership);

    const evaluatedAt = this.requireDate(this.clock.now(), 'evaluatedAt');
    const evaluation = await this.permissionEvaluator.evaluate(membership.id, evaluatedAt);

    if (
      evaluation.membershipId !== membership.id ||
      evaluation.organizationId !== membership.organizationId
    ) {
      throw this.integrityFailure(
        'Permission evaluation did not match the trusted membership boundary.',
      );
    }
    this.requireDate(evaluation.evaluatedAt, 'permissionEvaluation.evaluatedAt');
    if (!Array.isArray(evaluation.effectivePermissionCodes)) {
      throw this.integrityFailure(
        'Permission evaluation did not return a valid permission collection.',
      );
    }
    const permissionCodes = evaluation.effectivePermissionCodes.map((permissionCode) =>
      this.requirePermissionCode(permissionCode),
    );

    return Object.freeze({
      scope: 'organization',
      requestId: accountContext.requestId,
      userId: accountContext.userId,
      personId: accountContext.personId,
      sessionId: accountContext.sessionId,
      sessionExpiresAt: new Date(accountContext.sessionExpiresAt.getTime()),
      membershipId: membership.id,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      permissionCodes: new ImmutablePermissionSet(permissionCodes),
      evaluatedAt: new Date(evaluation.evaluatedAt.getTime()),
    });
  }

  private assertSessionIntegrity(session: TrustedSessionRecord): void {
    this.requireTrustedUuid(session.userId, 'session.userId');
    this.requireTrustedUuid(session.personId, 'session.personId');
    this.requireTrustedUuid(session.sessionId, 'session.sessionId');
    this.requireDate(session.expiresAt, 'session.expiresAt');
  }

  private assertMembershipIntegrity(membership: TrustedMembershipRecord): void {
    this.requireTrustedUuid(membership.id, 'membership.id');
    this.requireTrustedUuid(membership.personId, 'membership.personId');
    this.requireTrustedUuid(membership.tenantId, 'membership.tenantId');
    this.requireTrustedUuid(membership.organizationId, 'membership.organizationId');
  }

  private normalizeSessionToken(token: string): string | null {
    if (token.length === 0 || token.length > MAX_SESSION_TOKEN_LENGTH || token.trim() !== token) {
      return null;
    }
    return token;
  }

  private normalizeMembershipId(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      throw this.membershipUnavailable();
    }
    return normalized;
  }

  private resolveRequestId(requestId: string | undefined): string {
    return this.requireIdentifier(requestId ?? this.requestIdFactory.issue(), 'requestId');
  }

  private requireIdentifier(value: string, field: string): string {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > MAX_IDENTIFIER_LENGTH) {
      throw new RequestContextError(
        'REQUEST_CONTEXT_INVALID_INPUT',
        `${field} must contain between 1 and ${String(MAX_IDENTIFIER_LENGTH)} characters.`,
        { field },
      );
    }
    return normalized;
  }

  private requirePermissionCode(value: string): string {
    if (
      value.length === 0 ||
      value.length > MAX_PERMISSION_CODE_LENGTH ||
      value.trim() !== value ||
      !PERMISSION_CODE_PATTERN.test(value)
    ) {
      throw this.integrityFailure('Permission evaluation returned an invalid permission code.');
    }
    return value;
  }

  private requireTrustedUuid(value: string, field: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw this.integrityFailure(`${field} must be a valid UUID.`);
    }
    return value;
  }

  private requireDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw this.integrityFailure(`${field} must be a valid date.`);
    }
    return value;
  }

  private authenticationRequired(): RequestContextError {
    return new RequestContextError(
      'REQUEST_CONTEXT_AUTHENTICATION_REQUIRED',
      'A valid authenticated session is required.',
    );
  }

  private membershipUnavailable(): RequestContextError {
    return new RequestContextError(
      'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
      'The selected membership is unavailable for this authenticated account.',
    );
  }

  private integrityFailure(message: string): RequestContextError {
    return new RequestContextError('REQUEST_CONTEXT_INTEGRITY_FAILURE', message);
  }
}
