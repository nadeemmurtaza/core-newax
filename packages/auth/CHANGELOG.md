# Changelog

All notable changes to the NEWAX Authentication module are documented here.

## Unreleased

### Added

- `OAuthProvider` interface and `ExternalIdentityProfile` type for provider-agnostic OAuth 2.0 integration.
- `GitHubOAuthProvider` implementing the GitHub OAuth 2.0 Authorization Code Flow (`read:user user:email` scope).
- `OAuthRepository` port for external identity persistence (`findExternalIdentity`, `createExternalIdentity`).
- `OAuthAuthenticationService` orchestrating code exchange, profile normalisation, identity lookup, session issuance, and event publishing.
- `generateState()` and `buildAuthorizationUrl()` helpers on `OAuthAuthenticationService` for use in HTTP controllers.
- `OAuthProviderError` for provider-level failures (network, unexpected response).
- All new types exported from the package index.

### Security

- OAuth sessions reuse the existing opaque session-token model and `SecureCookieTransport`, providing identical security properties to password sessions.
- Access tokens from providers are not persisted.
- OAuth login only succeeds for users who have a pre-linked external identity — no automatic provisioning.

### Database

- Adds `core_user_external_identities` with a unique constraint on `(provider, provider_subject)`.

## 0.1.0 - 2026-07-11

### Added

- Verified-identity password enrollment for invited accounts.
- Scrypt password hashing with unique salts, versioned parameters, and an OWASP-aligned minimum work-factor profile.
- Fifteen-character single-factor minimum, Unicode NFC normalization, no forced composition rules, and whole-password blocklist checks.
- Generic password login failures with dummy verification work.
- Failed-attempt persistence and temporary account locking.
- Opaque session token issuance with keyed hashes at rest.
- Session validation, touch, expiry, logout, and revocation.
- Password change with complete session revocation.
- Platform-scoped session administration permissions.
- Users Registry integration through a controlled authentication directory.
- PostgreSQL and Prisma repository adapter.
- NestJS composition, tests, documentation, and ADR 0017.

### Security

- Plain passwords, credential hashes, session tokens, raw login identities, and token peppers are excluded from application logs and events.
- Unknown identities and invalid passwords return the same public authentication failure.
- Repeated failures lock known accounts and revoke active sessions.
- Suspended, disabled, archived, missing, or locked accounts cannot maintain valid sessions.
- Production requires an explicit authentication token pepper.
- Public HTTP endpoints remain disabled pending transport and throttling controls.

### Database

- Adds `core_authentication_attempts`.
- Adds one-password-credential-per-user-and-type uniqueness.
- Continues using `core_user_credentials` and `core_user_sessions`.
