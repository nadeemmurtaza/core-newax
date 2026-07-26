# 0026 — Add GitHub OAuth Authentication

**Status:** Accepted  
**Date:** 2026-07-26  
**Deciders:** Core Engineering  
**Supersedes:** N/A  
**Related:** [0017 — Build Authentication Service Foundation](./0017-build-authentication-service-foundation.md), [0020 — Build Authentication HTTP Endpoints](./0020-build-authentication-http-endpoints.md)

---

## Context

The NEWAX Core authentication system (ADR-0017, ADR-0020) currently supports password-based login using the opaque session-token model with `core_user_sessions`, `SecureCookieTransport`, and `SignedCsrfTokenService`.

A recurring need from product and engineering is to allow users to authenticate with an external identity provider. This removes the friction of managing a separate password and allows organisations to leverage existing corporate identity providers.

GitHub was chosen as the first provider because:
- NEWAX Core is a developer-facing SaaS and GitHub accounts are ubiquitous among its users.
- GitHub's OAuth 2.0 implementation is well-documented, stable, and supports the Authorization Code Flow without PKCE for server-side apps.
- The `read:user user:email` scope provides a sufficient profile to uniquely identify a user.

---

## Decision

### Provider-agnostic extension in `@newax/auth`

A new `OAuthProvider` interface is added to `@newax/auth`. It is responsible for:

1. **Building the authorization URL** — given a `state` parameter.
2. **Exchanging the code** — posting `code`, `client_id`, `client_secret`, and `redirect_uri` to the token endpoint.
3. **Fetching the user profile** — using the access token to call the userinfo endpoint.

A concrete `GitHubOAuthProvider` implements this interface for the GitHub flow.

A companion `OAuthAuthenticationService` orchestrates the full OAuth login:

1. Calls the provider to exchange the code and fetch the profile.
2. Looks up the linked external identity in `core_user_external_identities`.
3. Verifies the linked account is active.
4. Creates a session token identical to password login (same `SessionTokenService`, same `AuthenticationRepository.createSession`, same policy).
5. Publishes `authentication.session_created` and `authentication.login_succeeded` events.

The `AuthenticationService` (password login) is unchanged.

### Identity linking strategy

OAuth login **only works for users who already have an external identity record** in `core_user_external_identities`. OAuth cannot provision new users automatically. New users must be invited and onboarded through the existing flow before an administrator links their GitHub identity.

Rationale:
- Prevents unauthorized account creation.
- Keeps control over who can access the platform.
- Avoids the complexity of email verification in the OAuth callback path.

A future ADR may introduce a self-service external identity linking flow.

### Database: `core_user_external_identities`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK → `core_users.id` | Cascade delete |
| `provider` | `VARCHAR(64)` | e.g. `github` |
| `provider_subject` | `VARCHAR(256)` | Immutable unique ID from the provider (e.g. GitHub numeric user ID) |
| `provider_username` | `VARCHAR(256)` | Display name only, informational |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

Unique constraint on `(provider, provider_subject)` prevents duplicate identity records.

### State and CSRF protection

The OAuth initiation endpoint (`GET /api/auth/oauth/github`) generates a cryptographically secure random `state` using the existing `SessionTokenService.issue()` method. It persists the state in a short-lived cookie:

- Name: `__Host-newax_oauth_state`
- `HttpOnly`, `Secure`, `SameSite=Lax`
- Scoped to `Path=/api/auth/oauth/github/callback` — minimises exposure
- `Max-Age=600` (10 minutes)

The callback endpoint validates that the `state` query parameter equals the cookie value before proceeding. This prevents CSRF attacks targeting the OAuth flow.

After the callback completes (success or state rejection), the state cookie is expired immediately.

### Session reuse

OAuth authentication issues a session using the same infrastructure as password login:

- `SessionTokenService.issue()` → opaque token + HMAC hash
- `AuthenticationRepository.createSession()` → record in `core_user_sessions`
- `SecureCookieTransport.sessionCookie()` + `csrfCookie()` → set in the response

This means OAuth sessions are indistinguishable from password sessions in terms of lifecycle, revocation, and validation.

### HTTP endpoints

Two new public endpoints under `GET /api/auth/oauth/github`:

| Endpoint | Decorator | Rate limit |
|---|---|---|
| `GET /api/auth/oauth/github` | `PublicEndpoint` + `AuthenticationSensitiveEndpoint` | Authentication-sensitive |
| `GET /api/auth/oauth/github/callback` | `PublicEndpoint` + `AuthenticationSensitiveEndpoint` | Authentication-sensitive |

`GET` is used for both because the OAuth Authorization Code Flow mandates browser redirects. The state cookie (bound to the callback path) provides CSRF protection in lieu of the standard origin + CSRF token check applied to state-changing `POST` endpoints.

### Environment variables

| Variable | Required in production | Default |
|---|---|---|
| `OAUTH_GITHUB_CLIENT_ID` | ✅ Yes | — |
| `OAUTH_GITHUB_CLIENT_SECRET` | ✅ Yes | — |
| `OAUTH_GITHUB_REDIRECT_URI` | ✅ Yes | — |
| `OAUTH_GITHUB_AUTHORIZE_URL` | No | `https://github.com/login/oauth/authorize` |
| `OAUTH_GITHUB_TOKEN_URL` | No | `https://github.com/login/oauth/access_token` |
| `OAUTH_GITHUB_USERINFO_URL` | No | `https://api.github.com/user` |

URL overrides are provided for testability (stub servers in integration tests).

If the three required variables are absent in non-production environments, the GitHub provider is simply not registered and OAuth login returns a provider-not-configured error.

---

## Security considerations

- **No client-controlled redirect URIs.** The `redirect_uri` is read from the server-side environment only.
- **HTTPS required in production.** The existing `HTTP_REQUIRE_HTTPS` policy enforces this for all endpoints.
- **Access tokens are not stored.** Only the external identity link (provider + subject) and the opaque session token are persisted.
- **State cookie scoped to the callback path.** `Path=/api/auth/oauth/github/callback` ensures the state cookie is not sent to other endpoints.
- **Authentication-sensitive rate limiting** applies to both the initiation and callback endpoints, consistent with password login.

---

## Consequences

**Positive:**
- GitHub users can authenticate without managing a separate password.
- The provider abstraction allows adding future providers (Google, Microsoft) with minimal changes.
- Session semantics are unchanged — all existing session management tooling continues to work.

**Negative / trade-offs:**
- External identity linking is currently admin-only (no self-service linking).
- PKCE is not implemented for the server-side flow (GitHub supports it, but it adds complexity without a strong security benefit for confidential clients).
- OAuth-initiated logins do not record `authentication.login_failed` events — failure paths throw `AUTHENTICATION_FAILED` without audit trail detail.

---

## Non-goals

- UI changes in `apps/web` beyond a redirect link.
- Password recovery, MFA, or additional providers.
- Modifications to the existing password login flow.
