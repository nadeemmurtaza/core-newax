import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment';

const productionPepper = 'production-authentication-pepper-with-more-than-thirty-two-characters';
const productionCsrfSecret = 'production-http-csrf-secret-with-more-than-thirty-two-characters';
const productionOauthClientId = 'github-client-id';
const productionOauthClientSecret = 'github-client-secret';
const productionOauthRedirectUri = 'https://api.example.test/api/auth/oauth/github/callback';

describe('validateEnvironment', () => {
  it('applies safe defaults and preserves unrelated values', () => {
    expect(validateEnvironment({ FEATURE_FLAG: 'enabled' })).toMatchObject({
      FEATURE_FLAG: 'enabled',
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      AUTH_PASSWORD_MINIMUM_LENGTH: 15,
      AUTH_PASSWORD_MAXIMUM_LENGTH: 128,
      AUTH_SESSION_TTL_MINUTES: 480,
      AUTH_FAILED_ATTEMPT_WINDOW_MINUTES: 15,
      AUTH_MAXIMUM_FAILED_ATTEMPTS: 5,
      AUTH_ACCOUNT_LOCK_MINUTES: 15,
      AUTH_SESSION_TOUCH_INTERVAL_MINUTES: 5,
      HTTP_REQUIRE_HTTPS: false,
      HTTP_TRUSTED_PROXY_CIDRS: [],
      OAUTH_GITHUB_AUTHORIZE_URL: 'https://github.com/login/oauth/authorize',
      OAUTH_GITHUB_TOKEN_URL: 'https://github.com/login/oauth/access_token',
      OAUTH_GITHUB_USERINFO_URL: 'https://api.github.com/user',
    });
  });

  it('normalizes supported production environment values', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        HOST: ' 127.0.0.1 ',
        PORT: '8080',
        AUTH_TOKEN_PEPPER: ` ${productionPepper} `,
        HTTP_ALLOWED_ORIGINS: ' https://app.newax.test ',
        HTTP_CSRF_SECRET: productionCsrfSecret,
        HTTP_TRUSTED_PROXY_CIDRS: ' 10.0.0.0/8 ',
        OAUTH_GITHUB_CLIENT_ID: ` ${productionOauthClientId} `,
        OAUTH_GITHUB_CLIENT_SECRET: ` ${productionOauthClientSecret} `,
        OAUTH_GITHUB_REDIRECT_URI: ` ${productionOauthRedirectUri} `,
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: 8080,
      AUTH_TOKEN_PEPPER: productionPepper,
      HTTP_ALLOWED_ORIGINS: ['https://app.newax.test'],
      HTTP_CSRF_SECRET: productionCsrfSecret,
      HTTP_REQUIRE_HTTPS: true,
      HTTP_TRUSTED_PROXY_CIDRS: ['10.0.0.0/8'],
      OAUTH_GITHUB_CLIENT_ID: productionOauthClientId,
      OAUTH_GITHUB_CLIENT_SECRET: productionOauthClientSecret,
      OAUTH_GITHUB_REDIRECT_URI: productionOauthRedirectUri,
    });
  });

  it('requires an explicit authentication token pepper in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        OAUTH_GITHUB_CLIENT_ID: productionOauthClientId,
        OAUTH_GITHUB_CLIENT_SECRET: productionOauthClientSecret,
        OAUTH_GITHUB_REDIRECT_URI: productionOauthRedirectUri,
      }),
    ).toThrow('AUTH_TOKEN_PEPPER is required in production.');
  });

  it('requires OAuth GitHub client ID in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        AUTH_TOKEN_PEPPER: productionPepper,
        OAUTH_GITHUB_CLIENT_SECRET: productionOauthClientSecret,
        OAUTH_GITHUB_REDIRECT_URI: productionOauthRedirectUri,
      }),
    ).toThrow('OAUTH_GITHUB_CLIENT_ID is required in production.');
  });

  it('requires OAuth GitHub client secret in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        AUTH_TOKEN_PEPPER: productionPepper,
        OAUTH_GITHUB_CLIENT_ID: productionOauthClientId,
        OAUTH_GITHUB_REDIRECT_URI: productionOauthRedirectUri,
      }),
    ).toThrow('OAUTH_GITHUB_CLIENT_SECRET is required in production.');
  });

  it('requires OAuth GitHub redirect URI in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        AUTH_TOKEN_PEPPER: productionPepper,
        OAUTH_GITHUB_CLIENT_ID: productionOauthClientId,
        OAUTH_GITHUB_CLIENT_SECRET: productionOauthClientSecret,
      }),
    ).toThrow('OAUTH_GITHUB_REDIRECT_URI is required in production.');
  });

  it('accepts OAuth GitHub URL overrides in development', () => {
    expect(
      validateEnvironment({
        OAUTH_GITHUB_AUTHORIZE_URL: 'https://github.example.test/login/oauth/authorize',
        OAUTH_GITHUB_TOKEN_URL: 'https://github.example.test/login/oauth/access_token',
        OAUTH_GITHUB_USERINFO_URL: 'https://api.github.example.test/user',
      }),
    ).toMatchObject({
      OAUTH_GITHUB_AUTHORIZE_URL: 'https://github.example.test/login/oauth/authorize',
      OAUTH_GITHUB_TOKEN_URL: 'https://github.example.test/login/oauth/access_token',
      OAUTH_GITHUB_USERINFO_URL: 'https://api.github.example.test/user',
    });
  });

  it('rejects an invalid OAUTH_GITHUB_AUTHORIZE_URL', () => {
    expect(() =>
      validateEnvironment({ OAUTH_GITHUB_AUTHORIZE_URL: 'not-a-url' }),
    ).toThrow('OAUTH_GITHUB_AUTHORIZE_URL must be a valid URL.');
  });

  it('rejects a short authentication token pepper', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        AUTH_TOKEN_PEPPER: 'too-short',
      }),
    ).toThrow('AUTH_TOKEN_PEPPER must contain at least 32 characters.');
  });

  it('rejects an inverted authentication password range', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        AUTH_PASSWORD_MINIMUM_LENGTH: 20,
        AUTH_PASSWORD_MAXIMUM_LENGTH: 12,
      }),
    ).toThrow(
      'AUTH_PASSWORD_MAXIMUM_LENGTH must be greater than or equal to AUTH_PASSWORD_MINIMUM_LENGTH.',
    );
  });

  it.each([['staging'], [''], [42]])('rejects an invalid NODE_ENV value: %s', (NODE_ENV) => {
    expect(() => validateEnvironment({ NODE_ENV })).toThrow(
      /NODE_ENV must be (a string|one of: development, test, production)/,
    );
  });

  it.each([[''], ['   '], [42]])('rejects an invalid HOST value: %s', (HOST) => {
    expect(() => validateEnvironment({ HOST })).toThrow(/HOST must/);
  });

  it.each([[0], [65_536], [3.5], ['invalid'], ['']])(
    'rejects an invalid PORT value: %s',
    (PORT) => {
      expect(() => validateEnvironment({ PORT })).toThrow(
        'PORT must be an integer between 1 and 65535.',
      );
    },
  );

  it.each([[true], [false], [null], [{}], [[]]])('rejects an unsupported PORT type: %s', (PORT) => {
    expect(() => validateEnvironment({ PORT })).toThrow('PORT must be a string or number.');
  });

  it.each([
    [
      ' postgresql://localhost:5432/newax ',
      'postgresql://localhost:5432/newax',
    ],
    [
      ' postgres://localhost:5432/newax ',
      'postgres://localhost:5432/newax',
    ],
  ])('normalizes a valid PostgreSQL database URL', (DATABASE_URL, expectedDatabaseUrl) => {
    expect(validateEnvironment({ DATABASE_URL })).toMatchObject({
      DATABASE_URL: expectedDatabaseUrl,
    });
  });

  it.each([
    [42, 'DATABASE_URL must be a string.'],
    ['', 'DATABASE_URL must not be empty.'],
    ['   ', 'DATABASE_URL must not be empty.'],
    ['not-a-url', 'DATABASE_URL must be a valid PostgreSQL connection URL.'],
    ['https://localhost/newax', 'DATABASE_URL must use the postgresql:// or postgres:// protocol.'],
    ['mysql://localhost/newax', 'DATABASE_URL must use the postgresql:// or postgres:// protocol.'],
  ])('rejects an invalid DATABASE_URL value: %s', (DATABASE_URL, expectedMessage) => {
    expect(() => validateEnvironment({ DATABASE_URL })).toThrow(expectedMessage);
  });
});
