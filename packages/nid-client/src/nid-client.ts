import {
  type NidAccount,
  type NidClientConfig,
  type NidSession,
  type NidTokenResponse,
  type NidVaultSecret,
  NidAuthError,
} from './types.js';

interface OAuthStateRecord {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export class NidClient {
  private config: NidClientConfig;
  private stateCache = new Map<string, OAuthStateRecord>();
  private sessionCache = new Map<string, { session: NidSession; cachedAt: number }>();

  constructor(config: NidClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      clientId: config.clientId,
      ...(config.clientSecret !== undefined ? { clientSecret: config.clientSecret } : {}),
      ...(config.redirectUri !== undefined ? { redirectUri: config.redirectUri } : {}),
      ...(config.vaultToken !== undefined ? { vaultToken: config.vaultToken } : {}),
      allowMockAuth: config.allowMockAuth ?? false,
    };
  }

  public reconfigure(newConfig: Partial<NidClientConfig>): void {
    this.config = {
      ...this.config,
      ...(newConfig.baseUrl !== undefined
        ? { baseUrl: newConfig.baseUrl.replace(/\/+$/, '') }
        : {}),
      ...(newConfig.clientId !== undefined ? { clientId: newConfig.clientId } : {}),
      ...(newConfig.clientSecret !== undefined ? { clientSecret: newConfig.clientSecret } : {}),
      ...(newConfig.redirectUri !== undefined ? { redirectUri: newConfig.redirectUri } : {}),
      ...(newConfig.vaultToken !== undefined ? { vaultToken: newConfig.vaultToken } : {}),
      ...(newConfig.allowMockAuth !== undefined ? { allowMockAuth: newConfig.allowMockAuth } : {}),
    };
  }

  public getAuthorizationUrl(options?: {
    scope?: string;
    state?: string;
    codeVerifier?: string;
    redirectUri?: string;
  }): { url: string; state: string; codeVerifier: string } {
    this.pruneExpiredStates();

    const state = options?.state || this.generateSecureRandom(24);
    const codeVerifier = options?.codeVerifier || this.generateSecureRandom(32);
    const redirectUri = options?.redirectUri || this.config.redirectUri || '';
    const scope = options?.scope || 'openid profile email';

    this.stateCache.set(state, {
      state,
      codeVerifier,
      redirectUri,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: this.generateCodeChallenge(codeVerifier),
      code_challenge_method: 'plain',
    });

    const url = `${this.config.baseUrl}/oauth/authorize?${params.toString()}`;
    return { url, state, codeVerifier };
  }

  public async exchangeCodeForTokens(
    code: string,
    state: string,
    redirectUri?: string,
  ): Promise<NidTokenResponse> {
    this.pruneExpiredStates();
    const storedState = this.stateCache.get(state);

    if (!storedState && !this.config.allowMockAuth) {
      throw new NidAuthError('Invalid or expired OAuth state parameter', 400);
    }
    if (storedState) {
      this.stateCache.delete(state);
    }

    if (this.config.allowMockAuth && code.startsWith('mock_code_')) {
      return this.createMockTokenResponse(code);
    }

    try {
      const resp = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri || storedState?.redirectUri || this.config.redirectUri,
          code_verifier: storedState?.codeVerifier,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new NidAuthError(
          `nID token exchange failed with status ${resp.status}: ${errText}`,
          resp.status,
        );
      }

      return (await resp.json()) as NidTokenResponse;
    } catch (err: unknown) {
      if (err instanceof NidAuthError) {
        throw err;
      }
      if (this.config.allowMockAuth) {
        return this.createMockTokenResponse(code);
      }
      throw new NidAuthError(`nID connection failure during token exchange: ${String(err)}`, 502);
    }
  }

  public async validateSession(sessionToken: string): Promise<NidSession> {
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw new NidAuthError('Bearer token is required', 401);
    }

    const cleanToken = sessionToken.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) {
      throw new NidAuthError('Token cannot be empty', 401);
    }

    const cached = this.sessionCache.get(cleanToken);
    if (cached && Date.now() - cached.cachedAt < 60_000) {
      return cached.session;
    }

    if (
      this.config.allowMockAuth &&
      (cleanToken.startsWith('mock_') || cleanToken.startsWith('test_'))
    ) {
      const mockSession = this.createMockSession(cleanToken);
      this.sessionCache.set(cleanToken, { session: mockSession, cachedAt: Date.now() });
      return mockSession;
    }

    try {
      const resp = await fetch(`${this.config.baseUrl}/api/v1/sessions/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanToken}`,
        },
      });

      if (!resp.ok) {
        throw new NidAuthError('Invalid or expired nID session', 401);
      }

      const session = (await resp.json()) as NidSession;
      this.sessionCache.set(cleanToken, { session, cachedAt: Date.now() });
      return session;
    } catch (err: unknown) {
      if (err instanceof NidAuthError) {
        throw err;
      }
      if (this.config.allowMockAuth) {
        const mockSession = this.createMockSession(cleanToken);
        this.sessionCache.set(cleanToken, { session: mockSession, cachedAt: Date.now() });
        return mockSession;
      }
      throw new NidAuthError(`Failed to reach nID identity provider: ${String(err)}`, 503);
    }
  }

  public async fetchVaultSecrets(serviceId: string): Promise<Record<string, string>> {
    const vaultToken = this.config.vaultToken;
    if (!vaultToken) {
      return {};
    }

    try {
      const resp = await fetch(
        `${this.config.baseUrl}/api/v1/vault/secrets?serviceId=${encodeURIComponent(serviceId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${vaultToken}`,
            'X-Client-Id': this.config.clientId,
          },
        },
      );

      if (!resp.ok) {
        return {};
      }

      const secretsList = (await resp.json()) as NidVaultSecret[];
      const map: Record<string, string> = {};
      for (const item of secretsList) {
        map[item.key] = item.value;
      }
      return map;
    } catch {
      return {};
    }
  }

  public revokeSession(sessionToken: string): void {
    const cleanToken = sessionToken.replace(/^Bearer\s+/i, '').trim();
    this.sessionCache.delete(cleanToken);
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    const ttl = 10 * 60 * 1000;
    for (const [key, val] of this.stateCache.entries()) {
      if (now - val.createdAt > ttl) {
        this.stateCache.delete(key);
      }
    }
  }

  private generateSecureRandom(length = 24): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i++) {
      res += charset[bytes[i]! % charset.length];
    }
    return res;
  }

  private generateCodeChallenge(verifier: string): string {
    return verifier;
  }

  private createMockTokenResponse(code: string): NidTokenResponse {
    const account: NidAccount = {
      id: `acc_${code.slice(-8)}`,
      email: 'mock.user@newax.local',
      fullName: 'Mock User',
      isEmailVerified: true,
      isPhoneVerified: true,
      isStaff: true,
      tenantId: 'tenant-default',
      roles: ['owner', 'admin'],
      permissions: ['*'],
    };

    return {
      accessToken: `mock_jwt_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: 'openid profile email',
      account,
    };
  }

  private createMockSession(token: string): NidSession {
    const account: NidAccount = {
      id: `acc_mock_${token.slice(0, 8)}`,
      email: 'session.user@newax.local',
      fullName: 'Session User',
      isEmailVerified: true,
      isPhoneVerified: true,
      isStaff: true,
      tenantId: 'tenant-default',
      roles: ['admin'],
      permissions: ['read', 'write'],
    };

    return {
      sessionId: `sess_${token.slice(0, 8)}`,
      token,
      accountId: account.id,
      tenantId: account.tenantId ?? null,
      account,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      issuedAt: new Date().toISOString(),
      active: true,
    };
  }
}
