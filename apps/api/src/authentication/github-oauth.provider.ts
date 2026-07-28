import { AuthenticationError, type ExternalIdentityProfile, type OAuthProvider } from '@newax/auth';

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
  readonly name?: string | null;
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

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new AuthenticationError('AUTHENTICATION_FAILED', 'GitHub token exchange failed.');
    }

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
    const response = await fetch(this.config.userinfoUrl, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new AuthenticationError('AUTHENTICATION_FAILED', 'GitHub user profile fetch failed.');
    }

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

    return {
      subject: String(data.id),
      email: profileEmail ?? (await this.fetchVerifiedPrimaryEmail(accessToken)),
      name: typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : null,
      username:
        typeof data.login === 'string' && data.login.trim().length > 0 ? data.login.trim() : null,
    };
  }

  /**
   * GitHub omits `email` from `/user` when a user has hidden their public
   * email, even with the `user:email` scope granted. Fall back to the
   * verified primary address from `/user/emails` in that case.
   */
  private async fetchVerifiedPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await fetch(this.config.emailsUrl, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new AuthenticationError('AUTHENTICATION_FAILED', 'GitHub email list fetch failed.');
    }

    const emails = (await response.json()) as GitHubEmailResponse[];
    const verifiedPrimary = emails.find(
      (entry) => entry.primary === true && entry.verified === true,
    );

    return typeof verifiedPrimary?.email === 'string'
      ? verifiedPrimary.email.trim().toLowerCase()
      : null;
  }
}
