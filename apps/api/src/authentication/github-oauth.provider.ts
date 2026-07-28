import { AuthenticationError, type ExternalIdentityProfile, type OAuthProvider } from '@newax/auth';

const OUTBOUND_REQUEST_TIMEOUT_MILLISECONDS = 10_000;

export interface GitHubOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
  readonly emailsUrl: string;
}

interface GitHubTokenResponse {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
}

interface GitHubUserResponse {
  readonly id?: number;
  readonly login?: string;
  readonly email?: string | null;
}

interface GitHubEmailResponse {
  readonly email?: string;
  readonly primary?: boolean;
  readonly verified?: boolean;
}

export class GitHubOAuthProvider implements OAuthProvider {
  readonly name = 'github';

  constructor(private readonly config: GitHubOAuthConfig) {}

  buildAuthorizationUrl(state: string): string {
    const url = new URL(this.config.authorizeUrl);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await this.request(
      this.config.tokenUrl,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
      'GitHub token exchange',
    );

    const data = (await response.json()) as GitHubTokenResponse;

    if (data.error !== undefined || data.access_token === undefined) {
      throw new AuthenticationError(
        'AUTHENTICATION_FAILED',
        'GitHub token exchange returned an error.',
      );
    }

    return data.access_token;
  }

  async fetchProfile(accessToken: string): Promise<ExternalIdentityProfile> {
    const response = await this.request(
      this.config.userinfoUrl,
      { headers: this.authorizedHeaders(accessToken) },
      'GitHub user profile fetch',
    );

    const data = (await response.json()) as GitHubUserResponse;

    if (data.id === undefined) {
      throw new AuthenticationError(
        'AUTHENTICATION_FAILED',
        'GitHub user profile is missing required fields.',
      );
    }

    const profileEmail =
      typeof data.email === 'string' && data.email.trim().length > 0
        ? data.email.trim().toLowerCase()
        : null;
    const verifiedPrimaryEmail = await this.fetchVerifiedPrimaryEmail(accessToken);

    return {
      subject: String(data.id),
      email: verifiedPrimaryEmail ?? profileEmail,
      username:
        typeof data.login === 'string' && data.login.trim().length > 0 ? data.login.trim() : null,
    };
  }

  /**
   * The `/user` response's `email` field is the user's chosen public email,
   * which may be a verified secondary address, or null when hidden — never
   * a reliable stand-in for the account's true primary address. Always
   * prefer the verified primary from `/user/emails`, falling back to the
   * public field only when no verified primary is available.
   */
  private async fetchVerifiedPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await this.request(
      this.config.emailsUrl,
      { headers: this.authorizedHeaders(accessToken) },
      'GitHub email list fetch',
    );

    const emails = (await response.json()) as GitHubEmailResponse[];
    const verifiedPrimary = emails.find(
      (entry) => entry.primary === true && entry.verified === true,
    );

    return typeof verifiedPrimary?.email === 'string'
      ? verifiedPrimary.email.trim().toLowerCase()
      : null;
  }

  private authorizedHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /**
   * Bounds every outbound request with a timeout and maps failures to a
   * status-appropriate error: a 5xx response, a network failure, or a
   * timeout is a provider-availability problem, not an authentication
   * rejection, and must not be reported the same way as an invalid code or
   * token (which would surface as 401 and be indistinguishable from a
   * genuine credential failure during a GitHub outage).
   */
  private async request(url: string, init: RequestInit, description: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(OUTBOUND_REQUEST_TIMEOUT_MILLISECONDS),
      });
    } catch {
      throw new AuthenticationError(
        'AUTHENTICATION_PROVIDER_UNAVAILABLE',
        `${description} failed: the provider did not respond in time.`,
      );
    }

    if (!response.ok) {
      if (response.status >= 500 || response.status === 429) {
        throw new AuthenticationError(
          'AUTHENTICATION_PROVIDER_UNAVAILABLE',
          `${description} failed: the provider returned a server error or is rate-limiting requests.`,
        );
      }
      throw new AuthenticationError('AUTHENTICATION_FAILED', `${description} failed.`);
    }

    return response;
  }
}
