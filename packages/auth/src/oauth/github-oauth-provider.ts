import { OAuthProviderError, type ExternalIdentityProfile, type OAuthProvider, type OAuthTokenResponse } from './oauth-provider';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';
const GITHUB_SCOPE = 'read:user user:email';

export interface GitHubOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly authorizeUrl?: string;
  readonly tokenUrl?: string;
  readonly userinfoUrl?: string;
}

interface GitHubUserResponse {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly email: string | null;
}

export class GitHubOAuthProvider implements OAuthProvider {
  readonly providerName = 'github';

  private readonly authorizeUrl: string;
  private readonly tokenUrl: string;
  private readonly userinfoUrl: string;

  constructor(private readonly config: GitHubOAuthConfig) {
    this.authorizeUrl = config.authorizeUrl ?? GITHUB_AUTHORIZE_URL;
    this.tokenUrl = config.tokenUrl ?? GITHUB_TOKEN_URL;
    this.userinfoUrl = config.userinfoUrl ?? GITHUB_USERINFO_URL;
  }

  buildAuthorizationUrl(state: string): URL {
    const url = new URL(this.authorizeUrl);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', GITHUB_SCOPE);
    url.searchParams.set('state', state);
    return url;
  }

  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new OAuthProviderError(
        `GitHub token exchange failed with status ${String(response.status)}.`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data['error'] === 'string') {
      throw new OAuthProviderError(`GitHub token exchange error: ${data['error']}`);
    }
    if (typeof data['access_token'] !== 'string') {
      throw new OAuthProviderError('GitHub token exchange returned an unexpected response.');
    }

    const scope = typeof data['scope'] === 'string' ? data['scope'] : undefined;

    return {
      access_token: data['access_token'],
      token_type: typeof data['token_type'] === 'string' ? data['token_type'] : 'bearer',
      ...(scope !== undefined ? { scope } : {}),
    };
  }

  async fetchUserProfile(accessToken: string): Promise<ExternalIdentityProfile> {
    const response = await fetch(this.userinfoUrl, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new OAuthProviderError(
        `GitHub userinfo request failed with status ${String(response.status)}.`,
      );
    }

    const data = (await response.json()) as GitHubUserResponse;
    return this.normalizeProfile(data);
  }

  private normalizeProfile(data: GitHubUserResponse): ExternalIdentityProfile {
    return {
      subject: String(data.id),
      email: data.email ?? null,
      name: data.name ?? null,
      username: data.login ?? null,
    };
  }
}
