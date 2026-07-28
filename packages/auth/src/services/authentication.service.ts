import type { AuthenticationRepository } from '../database/authentication-repository';
import type { AuthenticationEventPublisher } from '../events/authentication-event';
import { AuthenticationError } from '../errors/authentication-error';
import {
  AUTHENTICATION_PERMISSIONS,
  type AuthenticationPermission,
} from '../permissions/authentication-permissions';
import type {
  AuthenticationClock,
  LoginFingerprintService,
  PasswordHasher,
  SessionTokenService,
} from '../security/authentication-security';
import type { PasswordBlocklist } from '../security/password-blocklist';
import type {
  AuthenticationAdminContext,
  AuthenticationAttemptOutcome,
  AuthenticationPolicy,
  AuthenticationRequestMetadata,
  AuthenticationSessionListQuery,
  AuthenticationSessionPage,
  AuthenticationSessionRecord,
  OAuthLoginInput,
  PasswordChangeInput,
  PasswordCredentialRecord,
  PasswordEnrollmentInput,
  PasswordLoginInput,
  PasswordLoginResult,
  ValidatedSession,
} from '../types/authentication';
import type { AuthenticationUserDirectory } from './authentication-user-directory';
import { PasswordPolicyValidator } from './password-policy-validator';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

export class AuthenticationService {
  private readonly passwordPolicyValidator: PasswordPolicyValidator;

  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly userDirectory: AuthenticationUserDirectory,
    private readonly passwordHasher: PasswordHasher,
    private readonly passwordBlocklist: PasswordBlocklist,
    private readonly sessionTokenService: SessionTokenService,
    private readonly loginFingerprintService: LoginFingerprintService,
    private readonly clock: AuthenticationClock,
    private readonly eventPublisher: AuthenticationEventPublisher,
    private readonly policy: AuthenticationPolicy,
  ) {
    this.passwordPolicyValidator = new PasswordPolicyValidator(policy);
  }

  async enrollPassword(input: PasswordEnrollmentInput): Promise<void> {
    const password = await this.validateNewPassword(input.password);
    const identity = await this.userDirectory.resolveIdentity(
      input.identityType,
      this.requireText(input.identityValue, 'identityValue', 320),
    );

    if (identity === null) {
      await this.passwordHasher.verifyOrBurn(password, null);
      throw this.authenticationFailed();
    }
    if (!identity.isVerified) {
      throw new AuthenticationError(
        'AUTHENTICATION_UNVERIFIED_IDENTITY',
        'The login identity must be verified before password enrollment.',
      );
    }
    if (identity.account.status !== 'invited') {
      throw new AuthenticationError(
        'AUTHENTICATION_ACCOUNT_UNAVAILABLE',
        'Only invited accounts may enroll an initial password.',
        { status: identity.account.status },
      );
    }

    const occurredAt = this.clock.now();
    const existingCredential = await this.repository.findPasswordCredential(
      identity.account.userId,
    );
    if (existingCredential !== null) {
      await this.recoverEnrollment(
        identity.account.userId,
        password,
        existingCredential,
        occurredAt,
      );
      return;
    }

    const secretHash = await this.passwordHasher.hash(password);
    const created = await this.repository.createPasswordCredential({
      userId: identity.account.userId,
      secretHash,
      occurredAt,
    });
    if (created === null) {
      const racedCredential = await this.repository.findPasswordCredential(identity.account.userId);
      if (racedCredential === null) {
        throw new AuthenticationError(
          'AUTHENTICATION_PASSWORD_ALREADY_CONFIGURED',
          'A password credential is already configured.',
        );
      }
      await this.recoverEnrollment(identity.account.userId, password, racedCredential, occurredAt);
      return;
    }

    await this.activateEnrolledAccount(identity.account.userId, occurredAt);
  }

  async login(input: PasswordLoginInput): Promise<PasswordLoginResult> {
    const identityValue = this.requireText(input.identityValue, 'identityValue', 320);
    const password = this.passwordPolicyValidator.normalize(input.password);
    this.requirePasswordShape(password);
    const metadata = this.normalizeMetadata(input);
    const occurredAt = this.clock.now();
    const identityFingerprint = this.loginFingerprintService.fingerprint(
      input.identityType,
      identityValue,
    );
    const identity = await this.userDirectory.resolveIdentity(input.identityType, identityValue);
    const credential =
      identity === null
        ? null
        : await this.repository.findPasswordCredential(identity.account.userId);
    const usableCredential = this.usableCredential(credential, occurredAt);
    const passwordVerification = await this.passwordHasher.verifyOrBurn(
      password,
      usableCredential?.secretHash ?? null,
    );

    if (identity === null) {
      await this.recordFailure(
        null,
        identityFingerprint,
        'failed_unknown_identity',
        metadata,
        occurredAt,
      );
      throw this.authenticationFailed();
    }

    const { account } = identity;
    if (!identity.isVerified) {
      await this.recordFailure(
        account.userId,
        identityFingerprint,
        'failed_unverified_identity',
        metadata,
        occurredAt,
      );
      throw this.authenticationFailed();
    }
    if (account.status !== 'active') {
      await this.recordFailure(
        account.userId,
        identityFingerprint,
        'blocked_account_status',
        metadata,
        occurredAt,
      );
      throw this.authenticationFailed();
    }
    if (account.lockedUntil !== null && account.lockedUntil > occurredAt) {
      await this.recordFailure(
        account.userId,
        identityFingerprint,
        'blocked_account_lock',
        metadata,
        occurredAt,
      );
      throw this.authenticationFailed();
    }
    if (usableCredential === null) {
      await this.recordFailure(
        account.userId,
        identityFingerprint,
        'failed_missing_credential',
        metadata,
        occurredAt,
      );
      throw this.authenticationFailed();
    }
    if (!passwordVerification.verified) {
      await this.recordFailure(
        account.userId,
        identityFingerprint,
        'failed_invalid_secret',
        metadata,
        occurredAt,
        true,
      );
      throw this.authenticationFailed();
    }

    if (passwordVerification.needsRehash) {
      const replacementHash = await this.passwordHasher.hash(password);
      await this.repository.replacePasswordCredential(account.userId, replacementHash, occurredAt);
    } else {
      await this.repository.markCredentialUsed(usableCredential.id, occurredAt);
    }

    if (account.lockedUntil !== null) {
      await this.userDirectory.setLockedUntil(account.userId, null);
    }
    const updatedAccount = await this.userDirectory.recordSuccessfulLogin(
      account.userId,
      occurredAt,
    );
    const issuedToken = this.sessionTokenService.issue();
    const expiresAt = this.addMinutes(occurredAt, this.policy.sessionTtlMinutes);
    const session = await this.repository.createSession({
      userId: account.userId,
      sessionTokenHash: issuedToken.tokenHash,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt,
      occurredAt,
    });

    await this.repository.recordAttempt({
      userId: account.userId,
      identityFingerprint,
      outcome: 'succeeded',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      occurredAt,
    });
    await this.eventPublisher.publish({
      name: 'authentication.session_created',
      occurredAt,
      session,
    });
    await this.eventPublisher.publish({
      name: 'authentication.login_succeeded',
      occurredAt,
      userId: account.userId,
      sessionId: session.id,
      ipAddress: metadata.ipAddress,
    });

    return {
      userId: updatedAccount.userId,
      personId: updatedAccount.personId,
      sessionToken: issuedToken.token,
      session,
    };
  }

  async loginWithExternalIdentity(input: OAuthLoginInput): Promise<PasswordLoginResult> {
    const provider = this.requireText(input.provider, 'provider', 64);
    const subject = this.requireText(input.profile.subject, 'profile.subject', 256);
    const metadata = this.normalizeMetadata(input);
    const occurredAt = this.clock.now();

    let userId: string | null = null;

    const existingIdentity = await this.repository.findExternalIdentity(provider, subject);
    if (existingIdentity !== null) {
      userId = existingIdentity.userId;
    } else if (input.profile.email !== null && input.profile.email.trim().length > 0) {
      const emailIdentity = await this.userDirectory.resolveIdentity(
        'email',
        input.profile.email.trim().toLowerCase(),
      );
      if (emailIdentity !== null && emailIdentity.isVerified) {
        userId = emailIdentity.account.userId;
        await this.repository.upsertExternalIdentity({
          userId,
          provider,
          providerSubject: subject,
          providerUsername:
            input.profile.username !== null && input.profile.username.trim().length > 0
              ? input.profile.username.trim().slice(0, 256)
              : null,
          occurredAt,
        });
      }
    }

    if (userId === null) {
      throw this.authenticationFailed();
    }

    const account = await this.userDirectory.findAccountById(userId);
    if (account === null || account.status !== 'active') {
      throw this.authenticationFailed();
    }
    if (account.lockedUntil !== null && account.lockedUntil > occurredAt) {
      throw this.authenticationFailed();
    }

    const issuedToken = this.sessionTokenService.issue();
    const expiresAt = this.addMinutes(occurredAt, this.policy.sessionTtlMinutes);
    const session = await this.repository.createSession({
      userId: account.userId,
      sessionTokenHash: issuedToken.tokenHash,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt,
      occurredAt,
    });

    const updatedAccount = await this.userDirectory.recordSuccessfulLogin(
      account.userId,
      occurredAt,
    );

    await this.eventPublisher.publish({
      name: 'authentication.session_created',
      occurredAt,
      session,
    });
    await this.eventPublisher.publish({
      name: 'authentication.login_succeeded',
      occurredAt,
      userId: account.userId,
      sessionId: session.id,
      ipAddress: metadata.ipAddress,
    });

    return {
      userId: updatedAccount.userId,
      personId: updatedAccount.personId,
      sessionToken: issuedToken.token,
      session,
    };
  }

  async changePassword(input: PasswordChangeInput): Promise<void> {
    const userId = this.requireText(input.userId, 'userId', 128);
    const currentPassword = this.passwordPolicyValidator.normalize(input.currentPassword);
    this.requirePasswordShape(currentPassword);
    const newPassword = await this.validateNewPassword(input.newPassword);
    const account = await this.userDirectory.findAccountById(userId);
    if (account === null || account.status !== 'active') {
      throw this.authenticationFailed();
    }

    const occurredAt = this.clock.now();
    const credential = await this.repository.findPasswordCredential(userId);
    const usableCredential = this.usableCredential(credential, occurredAt);
    if (usableCredential === null) {
      await this.passwordHasher.verifyOrBurn(currentPassword, null);
      throw this.authenticationFailed();
    }

    const currentVerification = await this.passwordHasher.verifyOrBurn(
      currentPassword,
      usableCredential.secretHash,
    );
    if (!currentVerification.verified) {
      throw this.authenticationFailed();
    }
    const repeatedPassword = await this.passwordHasher.verifyOrBurn(
      newPassword,
      usableCredential.secretHash,
    );
    if (repeatedPassword.verified) {
      throw new AuthenticationError(
        'AUTHENTICATION_PASSWORD_POLICY_FAILED',
        'The new password must differ from the current password.',
      );
    }

    const replacementHash = await this.passwordHasher.hash(newPassword);
    await this.repository.replacePasswordCredential(userId, replacementHash, occurredAt);
    await this.repository.revokeAllSessions(userId, occurredAt);
    await this.eventPublisher.publish({
      name: 'authentication.password_changed',
      occurredAt,
      userId,
    });
  }

  async validateSession(token: string): Promise<ValidatedSession | null> {
    const normalizedToken = this.normalizeSessionToken(token);
    if (normalizedToken === null) {
      return null;
    }

    const sessionTokenHash = this.sessionTokenService.hash(normalizedToken);
    const session = await this.repository.findSessionByTokenHash(sessionTokenHash);
    if (session === null || session.status !== 'active') {
      return null;
    }

    const occurredAt = this.clock.now();
    if (session.expiresAt <= occurredAt) {
      await this.repository.setSessionStatus(session.id, 'expired', occurredAt);
      return null;
    }

    const account = await this.userDirectory.findAccountById(session.userId);
    if (
      account === null ||
      account.status !== 'active' ||
      (account.lockedUntil !== null && account.lockedUntil > occurredAt)
    ) {
      await this.repository.setSessionStatus(session.id, 'revoked', occurredAt);
      return null;
    }

    const touchThreshold = this.addMinutes(
      session.lastSeenAt ?? session.createdAt,
      this.policy.sessionTouchIntervalMinutes,
    );
    if (touchThreshold <= occurredAt) {
      await this.repository.touchSession(session.id, occurredAt);
    }

    return {
      userId: account.userId,
      personId: account.personId,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  }

  async logout(token: string): Promise<void> {
    const normalizedToken = this.normalizeSessionToken(token);
    if (normalizedToken === null) {
      return;
    }

    const occurredAt = this.clock.now();
    const session = await this.repository.revokeSessionByTokenHash(
      this.sessionTokenService.hash(normalizedToken),
      occurredAt,
    );
    if (session !== null) {
      await this.publishSessionRevoked(session, occurredAt, null);
    }
  }

  async listUserSessions(
    context: AuthenticationAdminContext,
    userId: string,
    query: AuthenticationSessionListQuery = {},
  ): Promise<AuthenticationSessionPage> {
    this.requirePlatformPermission(context, AUTHENTICATION_PERMISSIONS.sessionsView);
    const normalized: Mutable<AuthenticationSessionListQuery> = {
      limit: this.normalizeLimit(query.limit),
    };
    if (query.status !== undefined) {
      normalized.status = query.status;
    }
    if (query.afterId !== undefined) {
      normalized.afterId = this.requireText(query.afterId, 'afterId', 128);
    }
    return this.repository.listSessions(this.requireText(userId, 'userId', 128), normalized);
  }

  async revokeUserSession(
    context: AuthenticationAdminContext,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    this.requirePlatformPermission(context, AUTHENTICATION_PERMISSIONS.sessionsRevoke);
    const occurredAt = this.clock.now();
    const session = await this.repository.revokeSessionById(
      this.requireText(userId, 'userId', 128),
      this.requireText(sessionId, 'sessionId', 128),
      occurredAt,
    );
    if (session === null) {
      throw new AuthenticationError(
        'AUTHENTICATION_SESSION_NOT_FOUND',
        'The session does not exist for this user.',
      );
    }
    await this.publishSessionRevoked(session, occurredAt, context.actorUserId);
  }

  async revokeAllUserSessions(
    context: AuthenticationAdminContext,
    userId: string,
  ): Promise<number> {
    this.requirePlatformPermission(context, AUTHENTICATION_PERMISSIONS.sessionsRevoke);
    return this.repository.revokeAllSessions(
      this.requireText(userId, 'userId', 128),
      this.clock.now(),
    );
  }

  private async recoverEnrollment(
    userId: string,
    password: string,
    credential: PasswordCredentialRecord,
    occurredAt: Date,
  ): Promise<void> {
    const usableCredential = this.usableCredential(credential, occurredAt);
    const verification = await this.passwordHasher.verifyOrBurn(
      password,
      usableCredential?.secretHash ?? null,
    );
    if (!verification.verified) {
      throw new AuthenticationError(
        'AUTHENTICATION_PASSWORD_ALREADY_CONFIGURED',
        'A password credential is already configured.',
      );
    }
    await this.activateEnrolledAccount(userId, occurredAt);
  }

  private async activateEnrolledAccount(userId: string, occurredAt: Date): Promise<void> {
    await this.userDirectory.activateInvitedUser(userId);
    await this.eventPublisher.publish({
      name: 'authentication.password_enrolled',
      occurredAt,
      userId,
    });
  }

  private async validateNewPassword(password: string): Promise<string> {
    const normalized = this.passwordPolicyValidator.validate(password);
    if (await this.passwordBlocklist.contains(normalized)) {
      throw new AuthenticationError(
        'AUTHENTICATION_PASSWORD_POLICY_FAILED',
        'Choose a password that is not commonly used, expected, or known to be compromised.',
      );
    }
    return normalized;
  }

  private usableCredential(
    credential: PasswordCredentialRecord | null,
    occurredAt: Date,
  ): PasswordCredentialRecord | null {
    return credential !== null &&
      credential.status === 'active' &&
      (credential.expiresAt === null || credential.expiresAt > occurredAt)
      ? credential
      : null;
  }

  private async recordFailure(
    userId: string | null,
    identityFingerprint: string,
    outcome: Exclude<AuthenticationAttemptOutcome, 'succeeded'>,
    metadata: {
      readonly ipAddress: string | null;
      readonly userAgent: string | null;
    },
    occurredAt: Date,
    evaluateLock = false,
  ): Promise<void> {
    await this.repository.recordAttempt({
      userId,
      identityFingerprint,
      outcome,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      occurredAt,
    });
    await this.eventPublisher.publish({
      name: 'authentication.login_failed',
      occurredAt,
      userId,
      identityFingerprint,
      outcome,
      ipAddress: metadata.ipAddress,
    });

    if (!evaluateLock || userId === null) {
      return;
    }

    const failureWindowStart = this.addMinutes(occurredAt, -this.policy.failedAttemptWindowMinutes);
    const recentFailures = await this.repository.countRecentFailures(
      userId,
      identityFingerprint,
      failureWindowStart,
    );
    if (recentFailures < this.policy.maximumFailedAttempts) {
      return;
    }

    const lockedUntil = this.addMinutes(occurredAt, this.policy.accountLockMinutes);
    await this.userDirectory.setLockedUntil(userId, lockedUntil);
    await this.repository.revokeAllSessions(userId, occurredAt);
    await this.eventPublisher.publish({
      name: 'authentication.account_locked',
      occurredAt,
      userId,
      lockedUntil,
    });
  }

  private async publishSessionRevoked(
    session: AuthenticationSessionRecord,
    occurredAt: Date,
    actorUserId: string | null,
  ): Promise<void> {
    await this.eventPublisher.publish({
      name: 'authentication.session_revoked',
      occurredAt,
      userId: session.userId,
      sessionId: session.id,
      actorUserId,
    });
  }

  private requirePlatformPermission(
    context: AuthenticationAdminContext,
    permission: AuthenticationPermission,
  ): void {
    const actorUserId = context.actorUserId.trim();
    if (actorUserId.length === 0) {
      throw new AuthenticationError('AUTHENTICATION_INVALID_INPUT', 'actorUserId is required.');
    }
    if (!context.permissionCodes.has(permission)) {
      throw new AuthenticationError(
        'AUTHENTICATION_FORBIDDEN',
        `The operation requires ${permission}.`,
        { permission },
      );
    }
    if (context.organizationId !== null) {
      throw new AuthenticationError(
        'AUTHENTICATION_PLATFORM_CONTEXT_REQUIRED',
        'Account-wide authentication administration requires platform context.',
      );
    }
  }

  private normalizeMetadata(metadata: AuthenticationRequestMetadata): {
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
  } {
    return {
      ipAddress:
        metadata.ipAddress === undefined
          ? null
          : this.requireText(metadata.ipAddress, 'ipAddress', 64),
      userAgent:
        metadata.userAgent === undefined
          ? null
          : this.requireText(metadata.userAgent, 'userAgent', 1024),
    };
  }

  private requirePasswordShape(password: string): void {
    const characterCount = [...password].length;
    if (characterCount === 0 || characterCount > this.policy.passwordMaximumLength) {
      throw this.authenticationFailed();
    }
  }

  private normalizeSessionToken(token: string): string | null {
    if (token.length === 0 || token.length > 512 || token.trim() !== token) {
      return null;
    }
    return token;
  }

  private normalizeLimit(value: number | undefined): number {
    const limit = value ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new AuthenticationError(
        'AUTHENTICATION_INVALID_INPUT',
        `limit must be an integer between 1 and ${String(MAX_PAGE_SIZE)}.`,
      );
    }
    return limit;
  }

  private requireText(value: string, field: string, maxLength: number): string {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > maxLength) {
      throw new AuthenticationError(
        'AUTHENTICATION_INVALID_INPUT',
        `${field} must contain between 1 and ${String(maxLength)} characters.`,
        { field },
      );
    }
    return normalized;
  }

  private addMinutes(value: Date, minutes: number): Date {
    return new Date(value.getTime() + minutes * 60_000);
  }

  private authenticationFailed(): AuthenticationError {
    return new AuthenticationError(
      'AUTHENTICATION_FAILED',
      'Authentication could not be completed.',
    );
  }
}
