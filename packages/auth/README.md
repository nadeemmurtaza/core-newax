# NEWAX Authentication Module

## Status

Draft reusable foundation module.

Version: `0.1.0`

## Purpose

The Authentication module proves login identity and manages secure account sessions without taking ownership of people, user accounts, memberships, roles, or permissions.

Authentication answers who is attempting to enter. The Users Registry determines whether a login-capable account exists. Memberships determine which organizations are available. Access Control determines what the selected membership may do.

## Owned concepts and data

The module owns:

- Password credential hashing and lifecycle.
- Password enrollment and change flows.
- Password login verification.
- OAuth login via a linked external identity.
- Failed authentication attempt records.
- Temporary account locking after repeated failures.
- Opaque session token issuance, validation, touch, expiry, and revocation.
- Authentication lifecycle events.

Database ownership:

- `core_user_credentials`
- `core_user_sessions`
- `core_authentication_attempts`
- `core_user_external_identities`

The module does not own:

- `core_people`
- `core_users`
- `core_user_identities`
- `core_memberships`
- Roles or permissions
- Organization selection
- Domain profiles or transactions

## Public module API

The package exports:

- `AuthenticationService`
- `AuthenticationRepository`
- `AuthenticationUserDirectory`
- `PasswordHasher`
- `SessionTokenService`
- `LoginFingerprintService`
- `AuthenticationClock`
- `AuthenticationEventPublisher`
- Authentication request, result, policy, persistence, session, and event contracts
- `AUTHENTICATION_PERMISSIONS`
- `AuthenticationError`

Core operations:

```text
enrollPassword
login
changePassword
validateSession
logout
listUserSessions
revokeUserSession
revokeAllUserSessions
```

## Authentication sequence

```text
Login identity
  -> User account status
  -> Identity verification state
  -> Password credential verification
  -> Failed-attempt policy
  -> Session creation
  -> Membership selection
  -> Permission evaluation
```

A successful password check does not grant organization access. It produces an authenticated user session. Tenant access is resolved later through active memberships and effective permissions.

## Password security

The Node adapter uses:

- Scrypt password derivation using `N=2^17`, `r=8`, and `p=1`.
- A unique random salt for every password credential.
- Constant-time comparison.
- A dummy derivation path when an identity or credential does not exist.
- Versioned encoded hashes containing the derivation parameters.
- Automatic rehashing after successful login when policy parameters change.

Plain-text passwords and password hashes are never returned through public contracts or written to application logs.

Default password policy:

```text
Minimum length: 15 for single-factor password authentication
Maximum length: 128
Unicode passwords are normalized with NFC
No forced character-type composition rules
Whole-password blocklist comparison is required
```

Password length policy is configurable through validated application environment values. The application adapter enforces a baseline blocklist; a production-scale compromised-password corpus remains required before public password endpoints are enabled.

## Initial password enrollment

Initial enrollment requires:

- A valid login identity.
- A verified identity.
- An invited user account.
- A compliant password.
- No existing password credential.

Credential creation and duplicate prevention are serialized through a PostgreSQL advisory lock. After credential creation, Authentication activates the invited account through the Users Registry gateway.

Identity verification itself remains a separate future flow. Authentication does not mark an identity verified merely because someone supplied a password. That would be less verification and more optimism with a database column.

## Login protection

Every login attempt produces an append-oriented authentication-attempt record containing:

- Optional user identifier.
- A keyed identity fingerprint rather than the presented identity value.
- Outcome.
- Optional IP address and user-agent metadata.
- Timestamp.

Login errors are deliberately generic to reduce account enumeration.

Default failed-attempt policy:

```text
Window: 15 minutes
Maximum failures: 5
Lock duration: 15 minutes
```

When a known account reaches the threshold:

- `locked_until` is set on the user account through the Users Registry gateway.
- Active sessions are revoked.
- An account-locked event is emitted.

IP-based rate limiting remains required at the HTTP boundary when public endpoints are introduced.

## Session security

Sessions use opaque random tokens.

Rules:

- The plain token is returned only when issued.
- Only a keyed HMAC token hash is stored.
- Tokens are generated from 256 bits of cryptographic randomness.
- Session expiry is absolute.
- Last-seen writes are throttled by a configurable touch interval.
- Suspended, disabled, archived, missing, or currently locked accounts invalidate sessions.
- Password changes revoke all active sessions.
- Logout is idempotent.

The authentication token pepper must contain at least 32 characters and is mandatory in production.

## Administrative permissions

```text
authentication.sessions.view
authentication.sessions.revoke
authentication.policies.manage
```

Session administration affects a global user account and therefore requires platform context where `organizationId` is `null`.

Organization administrators should manage tenant access through memberships and permissions, not global session destruction. A branch manager does not need a button capable of ejecting someone from the entire enterprise, however emotionally satisfying the interface designer may find it.

## Events

```text
authentication.password_enrolled
authentication.password_changed
authentication.login_succeeded
authentication.login_failed
authentication.account_locked
authentication.session_created
authentication.session_revoked
```

Events and application logs exclude passwords, password hashes, session tokens, raw login identities, and token peppers.

## HTTP exposure

This slice does not expose public HTTP endpoints.

Controllers remain deferred until request throttling, secure cookie or token transport, CSRF decisions, trusted proxy handling, durable audit persistence, security headers, and complete response redaction are defined and tested.

## Dependencies

The module depends on:

- Users `>=0.1.0`

The Users integration gateway resolves identities and account state. Authentication does not query or mutate user-owned tables directly outside that contract.

Membership and Access Control remain downstream of authentication. The module does not choose an organization or calculate permissions.

## Known limitations

- Public login, logout, password, and session endpoints are not enabled.
- Email, phone, and invitation verification flows are deferred.
- Password-reset tokens and account recovery are deferred.
- MFA, passkeys, OTP, magic links, and SSO are deferred.
- IP and device risk scoring are deferred.
- Session rotation and refresh-token families are deferred.
- Durable event delivery and audit persistence are deferred.
- Authentication-attempt retention policy is deferred.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0010: Define Authentication and User Identity Strategy.
- ADR 0015: Consolidate Roles and Permissions into Access Control.
- ADR 0016: Build the Users Registry Service Foundation.
- ADR 0017: Build the Authentication Service Foundation.
