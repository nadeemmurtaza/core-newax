import { describe, expect, it } from 'vitest';
import { NidClient, NidAuthError } from '../src/index.js';

describe('@newax/nid-client (Unified Identity & Vault Client)', () => {
  const client = new NidClient({
    baseUrl: 'https://id.newax.local',
    clientId: 'communicator-service',
    clientSecret: 'secret_comm_123',
    redirectUri: 'https://communicator.newax.local/auth/callback',
    allowMockAuth: true,
  });

  it('generates OAuth PKCE authorization URLs with state and verifier', () => {
    const auth = client.getAuthorizationUrl();
    expect(auth.url).toContain('https://id.newax.local/oauth/authorize');
    expect(auth.url).toContain('client_id=communicator-service');
    expect(auth.state).toBeDefined();
    expect(auth.codeVerifier).toBeDefined();
  });

  it('exchanges authorization code for tokens in mock mode', async () => {
    const auth = client.getAuthorizationUrl();
    const tokenResp = await client.exchangeCodeForTokens('mock_code_abc123', auth.state);

    expect(tokenResp.accessToken).toMatch(/^mock_jwt_token_/);
    expect(tokenResp.account?.email).toBe('mock.user@newax.local');
    expect(tokenResp.account?.roles).toContain('admin');
  });

  it('rejects code exchange with invalid or expired state', async () => {
    const strictClient = new NidClient({
      baseUrl: 'https://id.newax.local',
      clientId: 'erp-service',
      allowMockAuth: false,
    });

    await expect(
      strictClient.exchangeCodeForTokens('code_123', 'non_existent_state'),
    ).rejects.toThrow(NidAuthError);
  });

  it('validates active session and caches successful response', async () => {
    const session = await client.validateSession('mock_session_token_xyz');

    expect(session.active).toBe(true);
    expect(session.account.email).toBe('session.user@newax.local');
    expect(session.accountId).toMatch(/^acc_mock_/);

    // Second call hits in-memory cache
    const cached = await client.validateSession('mock_session_token_xyz');
    expect(cached.sessionId).toBe(session.sessionId);
  });

  it('rejects empty or whitespace-only tokens', async () => {
    await expect(client.validateSession('')).rejects.toThrow('Bearer token is required');
    await expect(client.validateSession('Bearer   ')).rejects.toThrow('Token cannot be empty');
  });

  it('handles vault secrets fetching gracefully when offline', async () => {
    const secrets = await client.fetchVaultSecrets('erp-1');
    expect(typeof secrets).toBe('object');
  });
});
