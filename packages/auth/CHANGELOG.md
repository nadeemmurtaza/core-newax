# Changelog

All notable changes to the NEWAX Authentication module are documented here.

## 0.2.0 - 2026-07-26

### Added

- `OAuthProvider` interface (port) for provider-agnostic external identity integration.
- `ExternalIdentityProfile` type for normalized OAuth profile data.
- `ExternalIdentityRecord` and `CreateExternalIdentityInput` types for external identity persistence.
- `OAuthLoginInput` type extending `AuthenticationRequestMetadata` for OAuth login calls.
- `findExternalIdentity` and `upsertExternalIdentity` methods on `AuthenticationRepository`.
- `loginWithExternalIdentity` method on `AuthenticationService` for provider-agnostic OAuth session issuance.
- Unit tests for the OAuth login flow including existing-link, email-match, suspended account, and locked account cases.
- ADR 0026 documenting the design, provider selection, identity linking strategy, and security considerations.

### Security

- OAuth logins reuse the same session issuance path as password logins, preserving session validation and revocation semantics.
- OAuth does not provision new users; only active accounts with a verified email match are eligible.
- Provider subjects (stable external IDs) are used as the canonical external identity key; display handles are stored separately and updated on each login.
- Access tokens from OAuth providers are never persisted to the database.

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
