import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '@newax/auth';

import { GitHubOAuthProvider } from './github-oauth.provider';

const config = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://api.example.test/api/auth/oauth/github/callback',
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userinfoUrl: 'https://api.github.com/user',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GitHubOAuthProvider', () => {
  describe('buildAuthorizationUrl', () => {
    it('builds a valid GitHub authorization URL with required parameters', () => {
      const provider = new GitHubOAuthProvider(config);
      const url = provider.buildAuthorizationUrl('random-state-value');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=random-state-value');
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
      expect(url).toContain(`redirect_uri=${encodeURIComponent(config.redirectUri)}`);
    });

    it('uses the configured authorize URL', () => {
      const provider = new GitHubOAuthProvider({
        ...config,
        authorizeUrl: 'https://github.example.test/login/oauth/authorize',
      });
      const url = provider.buildAuthorizationUrl('state');

      expect(url).toContain('https://github.example.test/login/oauth/authorize');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges a code for an access token', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'gho_test_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const token = await provider.exchangeCode('test-code');

      expect(token).toBe('gho_test_token');
    });

    it('sends the correct parameters to the token endpoint', async () => {
      const provider = new GitHubOAuthProvider(config);
      let capturedBody: string | null = null;

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ access_token: 'gho_test_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      await provider.exchangeCode('my-code');

      expect(capturedBody).toContain('client_id=test-client-id');
      expect(capturedBody).toContain('code=my-code');
      expect(capturedBody).toContain(`redirect_uri=${encodeURIComponent(config.redirectUri)}`);
    });

    it('throws AuthenticationError when the HTTP response is not OK', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(provider.exchangeCode('bad-code')).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('throws AuthenticationError when the response contains an error field', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(provider.exchangeCode('expired-code')).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });
  });

  describe('fetchProfile', () => {
    it('normalizes a complete GitHub user profile', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 12345,
            login: 'octocat',
            name: 'The Octocat',
            email: 'octocat@github.com',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const profile = await provider.fetchProfile('gho_test_token');

      expect(profile).toEqual({
        subject: '12345',
        email: 'octocat@github.com',
        name: 'The Octocat',
        username: 'octocat',
      });
    });

    it('normalizes profile with null email and name', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 99999, login: 'anon-user', name: null, email: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const profile = await provider.fetchProfile('gho_test_token');

      expect(profile).toEqual({
        subject: '99999',
        email: null,
        name: null,
        username: 'anon-user',
      });
    });

    it('throws AuthenticationError when the HTTP response is not OK', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      await expect(provider.fetchProfile('bad-token')).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('throws AuthenticationError when the user profile is missing id', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'no-id-user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(provider.fetchProfile('gho_test_token')).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
      });
    });

    it('lowercases the email address from the profile', async () => {
      const provider = new GitHubOAuthProvider(config);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, login: 'user', email: 'User@Example.COM', name: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const profile = await provider.fetchProfile('token');

      expect(profile.email).toBe('user@example.com');
    });
  });
});
