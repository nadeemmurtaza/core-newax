import type { AuthenticationRepository } from '../database/authentication-repository';
import type { OAuthRepository } from '../database/oauth-repository';
import type { AuthenticationEventPublisher } from '../events/authentication-event';
import { AuthenticationError } from '../errors/authentication-error';
import type {
  AuthenticationClock,
  SessionTokenService,
} from '../security/authentication-security';
import type {
  AuthenticationPolicy,
  AuthenticationRequestMetadata,
  AuthenticationSessionRecord,
} from '../types/authentication';
import type { OAuthProvider } from '../oauth/oauth-provider';
import type { AuthenticationUserDirectory } from './authentication-user-directory';

export interface OAuthLoginInput extends AuthenticationRequestMetadata {
  readonly provider: string;
  readonly code: string;
}

export interface OAuthLoginResult {
  readonly userId: string;
  readonly personId: string;
  readonly sessionToken: string;
  readonly session: AuthenticationSessionRecord;
}

export class OAuthAuthenticationService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly oauthRepository: OAuthRepository,
    private readonly userDirectory: AuthenticationUserDirectory,
    private readonly sessionTokenService: SessionTokenService,
    private readonly clock: AuthenticationClock,
    private readonly eventPublisher: AuthenticationEventPublisher,
    private readonly policy: AuthenticationPolicy,
    private readonly providers: ReadonlyMap<string, OAuthProvider>,
  ) {}

  generateState(): string {
    return this.sessionTokenService.issue().token;
  }

  buildAuthorizationUrl(providerName: string, state: string): string {
    return this.requireProvider(providerName).buildAuthorizationUrl(state).toString();
  }

  async login(input: OAuthLoginInput): Promise<OAuthLoginResult> {
    const provider = this.requireProvider(input.provider);
    const metadata = this.normalizeMetadata(input);
    const occurredAt = this.clock.now();

    const tokenResponse = await provider.exchangeCode(input.code);
    const profile = await provider.fetchUserProfile(tokenResponse.access_token);

    const externalIdentity = await this.oauthRepository.findExternalIdentity(
      provider.providerName,
      profile.subject,
    );

    if (externalIdentity === null) {
      throw new AuthenticationError(
        'AUTHENTICATION_FAILED',
        'Authentication could not be completed.',
      );
    }

    const account = await this.userDirectory.findAccountById(externalIdentity.userId);
    if (account === null || account.status !== 'active') {
      throw new AuthenticationError(
        'AUTHENTICATION_FAILED',
        'Authentication could not be completed.',
      );
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

  private requireProvider(providerName: string): OAuthProvider {
    const provider = this.providers.get(providerName);
    if (provider === undefined) {
      throw new AuthenticationError(
        'AUTHENTICATION_INVALID_INPUT',
        `OAuth provider '${providerName}' is not configured.`,
        { provider: providerName },
      );
    }
    return provider;
  }

  private normalizeMetadata(metadata: AuthenticationRequestMetadata): {
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
  } {
    return {
      ipAddress:
        metadata.ipAddress === undefined
          ? null
          : metadata.ipAddress.trim().slice(0, 64) || null,
      userAgent:
        metadata.userAgent === undefined
          ? null
          : metadata.userAgent.trim().slice(0, 1024) || null,
    };
  }

  private addMinutes(value: Date, minutes: number): Date {
    return new Date(value.getTime() + minutes * 60_000);
  }
}
