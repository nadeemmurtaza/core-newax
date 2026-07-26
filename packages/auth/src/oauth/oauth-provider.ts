export interface ExternalIdentityProfile {
  readonly subject: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly username: string | null;
}

export interface OAuthTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly scope?: string;
}

export interface OAuthProvider {
  readonly providerName: string;
  buildAuthorizationUrl(state: string): URL;
  exchangeCode(code: string): Promise<OAuthTokenResponse>;
  fetchUserProfile(accessToken: string): Promise<ExternalIdentityProfile>;
}

export class OAuthProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthProviderError';
  }
}
