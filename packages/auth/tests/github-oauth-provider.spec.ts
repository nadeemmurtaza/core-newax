import { describe, expect, it, vi } from 'vitest';

import { GitHubOAuthProvider } from '../src/oauth/github-oauth-provider';
import { OAuthProviderError } from '../src/oauth/oauth-provider';

function makeProvider(overrides: Partial<Parameters<typeof GitHubOAuthProvider.prototype.constructor>[0]> = {}) {
  return new GitHubOAuthProvider({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://api.example.test/api/auth/oauth/github/callback',
    ...overrides,
  });
}

describe('GitHubOAuthProvider', () => {
  describe('buildAuthorizationUrl', () => {
    it('builds the GitHub authorization URL with required parameters', () => {
      const provider = makeProvider();
      const url = provider.buildAuthorizationUrl('random-state-value');

      expect(url.origin).toBe('https://github.com');
      expect(url.pathname).toBe('/login/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'https://api.example.test/api/auth/oauth/github/callback',
      );
      expect(url.searchParams.get('scope')).toBe('read:user user:email');
      expect(url.searchParams.get('state')).toBe('random-state-value');
    });

    it('uses a custom authorize URL when configured', () => {
      const provider = makeProvider({
        authorizeUrl: 'https://github.example.test/login/oauth/authorize',
      });
      const url = provider.buildAuthorizationUrl('some-state');

      expect(url.origin).toBe('https://github.example.test');
      expect(url.pathname).toBe('/login/oauth/authorize');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges a code for an access token', async () => {
      const provider = makeProvider();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'gho_access_token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await provider.exchangeCode('auth-code-from-github');

      expect(result.access_token).toBe('gho_access_token');
      expect(result.token_type).toBe('bearer');
      expect(result.scope).toBe('read:user,user:email');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://github.com/login/oauth/access_token');
      expect(options.method).toBe('POST');
      expect((options.headers as Record<string, string>)['Accept']).toBe('application/json');
      const body = new URLSearchParams(options.body as string);
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('code')).toBe('auth-code-from-github');
      expect(body.get('redirect_uri')).toBe(
        'https://api.example.test/api/auth/oauth/github/callback',
      );
    });

    it('throws OAuthProviderError when response is not ok', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      await expect(provider.exchangeCode('bad-code')).rejects.toThrow(OAuthProviderError);
      await expect(provider.exchangeCode('bad-code')).rejects.toThrow(
        'GitHub token exchange failed with status 401.',
      );
    });

    it('throws OAuthProviderError when GitHub returns an error field', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'bad_verification_code' }),
      }));

      await expect(provider.exchangeCode('expired-code')).rejects.toThrow(OAuthProviderError);
      await expect(provider.exchangeCode('expired-code')).rejects.toThrow(
        'GitHub token exchange error: bad_verification_code',
      );
    });

    it('throws OAuthProviderError when response has no access_token', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'payload' }),
      }));

      await expect(provider.exchangeCode('code')).rejects.toThrow(OAuthProviderError);
    });
  });

  describe('fetchUserProfile', () => {
    it('fetches and normalizes the GitHub user profile', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'octocat',
          name: 'The Octocat',
          email: 'octocat@github.com',
        }),
      }));

      const profile = await provider.fetchUserProfile('gho_access_token');

      expect(profile.subject).toBe('12345');
      expect(profile.username).toBe('octocat');
      expect(profile.name).toBe('The Octocat');
      expect(profile.email).toBe('octocat@github.com');
    });

    it('returns null for missing optional profile fields', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 99999,
          login: 'noreply-user',
          name: null,
          email: null,
        }),
      }));

      const profile = await provider.fetchUserProfile('gho_access_token');

      expect(profile.subject).toBe('99999');
      expect(profile.name).toBeNull();
      expect(profile.email).toBeNull();
    });

    it('throws OAuthProviderError when userinfo request fails', async () => {
      const provider = makeProvider();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

      await expect(provider.fetchUserProfile('bad-token')).rejects.toThrow(OAuthProviderError);
      await expect(provider.fetchUserProfile('bad-token')).rejects.toThrow(
        'GitHub userinfo request failed with status 403.',
      );
    });

    it('uses the configured userinfo URL', async () => {
      const provider = makeProvider({
        userinfoUrl: 'https://api.github.example.test/user',
      });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'user', name: null, email: null }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.fetchUserProfile('token');

      expect(mockFetch.mock.calls[0][0]).toBe('https://api.github.example.test/user');
    });
  });
});
