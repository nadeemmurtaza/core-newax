# ADR 0026: Add OAuth Authentication

## 1. Decision Title

Add GitHub OAuth as the first external identity provider for NEWAX Core authentication.

## 2. Status

Accepted

## 3. Date

2026-07-26

## 4. Context

ADR 0017 established a password-based authentication foundation with credentials, sessions, and login-attempt tracking. ADR 0020 exposed that foundation through secure HTTP endpoints. Both ADRs explicitly deferred support for external identity providers as requiring additional product and security decisions.

Users increasingly expect the ability to sign in with existing third-party accounts (e.g., GitHub) rather than maintaining a separate password. GitHub is a natural first provider for NEWAX, whose primary users are developers and engineering teams. Supporting GitHub OAuth reduces friction for sign-in while maintaining NEWAX's existing session and CSRF security model.

## 5. Decision

### 5.1 Scope

This ADR covers:

- A generic `OAuthProvider` port in `@newax/auth`.
- A `GitHubOAuthProvider` adapter in `apps/api`.
- A `loginWithExternalIdentity` method on `AuthenticationService`.
- A `core_user_external_identities` database table.
- Two new HTTP endpoints (`GET /api/auth/oauth/github` and `GET /api/auth/oauth/github/callback`) in `apps/api`.
- Environment configuration for GitHub OAuth credentials.

### 5.2 Provider selection

GitHub OAuth App is selected as the first provider because:

- NEWAX's primary users are developers and engineering teams already on GitHub.
- GitHub's OAuth flow is well-documented and stable.
- Adding GitHub first validates the provider abstraction layer before more complex providers (SAML, OIDC).

### 5.3 Identity linking strategy

OAuth does **not** provision new users. Only existing, active NEWAX users may authenticate via OAuth.

The linking algorithm applied on each OAuth login:

1. Check `core_user_external_identities` for an existing `(provider, provider_subject)` record.
   - If found, the linked `user_id` is used directly. No email lookup occurs.
2. If no existing link exists, look up the OAuth profile's primary email in `core_user_identities` (type `email`, verified only).
   - If a verified match is found for an active account, the external identity record is created (`upsert`) and the session is issued.
   - If no verified email match is found, authentication fails with `AUTHENTICATION_FAILED`.

**Rationale for link-only approach:**

- Preventing unbounded account provisioning through OAuth preserves the existing invitation-based workflow.
- Email-based linking requires a verified identity, preventing account takeover through an unverified GitHub email.
- The external identity record persists after the first match, making future logins O(1) without repeated email lookups.

### 5.4 External identity storage

A new table `core_user_external_identities` stores provider links:

| Column              | Type         | Notes                                                  |
| ------------------- | ------------ | ------------------------------------------------------ |
| `id`                | UUID         | Primary key                                            |
| `user_id`           | UUID         | Foreign key to `core_users`, CASCADE on delete         |
| `provider`          | VARCHAR(64)  | e.g., `github`                                         |
| `provider_subject`  | VARCHAR(256) | Stable external user ID (numeric GitHub ID for GitHub) |
| `provider_username` | VARCHAR(256) | Display-only handle, updated on each login             |
| `created_at`        | TIMESTAMPTZ  | Immutable                                              |
| `updated_at`        | TIMESTAMPTZ  | Updated on upsert                                      |

A unique constraint on `(provider, provider_subject)` prevents the same external account from linking to multiple NEWAX users.

Access tokens returned by OAuth providers are **not** stored.

### 5.5 State and CSRF protection

The OAuth initiation endpoint generates a 32-byte cryptographically random hex `state` value and stores it in a short-lived cookie:

- Name: `__Host-newax_oauth_state` (the `__Host-` prefix forces the browser to accept it only over `Secure`, host-only, `Path=/` — the same convention `SecureCookieTransport` already uses for the session and CSRF cookies — so a less-trusted sibling subdomain cannot plant a `Domain`-scoped cookie of the same name)
- `HttpOnly`, `Secure`, `SameSite=Lax`
- `Path=/` (required by the `__Host-` prefix)
- `Max-Age=600` (10-minute TTL)

The callback endpoint validates the `state` query parameter against the cookie value before proceeding. A mismatch or missing cookie results in a 401 response. The state cookie is cleared (Max-Age=0) after a successful callback.

### 5.6 Session reuse rationale

OAuth login issues a session through the same `repository.createSession` path as password login. This ensures:

- Session records are uniform regardless of authentication method.
- Existing session validation, expiry, revocation, and audit paths apply to OAuth sessions without modification.
- `SecureCookieTransport` and `SignedCsrfTokenService` handle the cookie issuance identically.

### 5.7 HTTP boundary

Both OAuth endpoints are marked `@PublicEndpoint()` and `@AuthenticationSensitiveEndpoint()`, which applies:

- Public context mode (no existing session required).
- Authentication-sensitive rate limiting.
- HTTP security controls from the `HttpBoundaryMiddleware` (origin, fetch-metadata).

`@PublicAuthenticationEndpoint()` (the decorator used for POST-style public mutations such as
password login) is not used here: it sets `HTTP_PUBLIC_AUTHENTICATION_MUTATION_KEY`, which
`HttpSecurityGuard` only permits on state-changing HTTP methods, and both OAuth routes are `GET`.

The callback is additionally marked `@AuditAsStateChanging()` so it still receives an
`http.request.completed` HTTP-boundary audit record on success, even though GET requests are not
otherwise treated as state-changing by `HttpSecurityGuard`.

No client-supplied `redirect_uri` is accepted. The redirect URI is fixed in server configuration (`OAUTH_GITHUB_REDIRECT_URI`).

### 5.8 Environment configuration

| Variable                     | Required in production | Default                                       |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| `OAUTH_GITHUB_CLIENT_ID`     | Yes                    | None                                          |
| `OAUTH_GITHUB_CLIENT_SECRET` | Yes                    | None                                          |
| `OAUTH_GITHUB_REDIRECT_URI`  | Yes                    | None                                          |
| `OAUTH_GITHUB_AUTHORIZE_URL` | No                     | `https://github.com/login/oauth/authorize`    |
| `OAUTH_GITHUB_TOKEN_URL`     | No                     | `https://github.com/login/oauth/access_token` |
| `OAUTH_GITHUB_USERINFO_URL`  | No                     | `https://api.github.com/user`                 |
| `OAUTH_GITHUB_EMAILS_URL`    | No                     | `https://api.github.com/user/emails`          |

URL overrides allow testing against a stub server in development and test environments. In
production, the redirect URI and all four provider URL overrides must use `https:`; a non-HTTPS
value fails environment validation at startup.

### 5.9 GitHub-specific behavior

- Authorization scope: `read:user user:email`.
- Token exchange uses `application/x-www-form-urlencoded` POST to the token URL.
- The GitHub numeric user ID (stable, immutable) is used as `provider_subject`.
- The GitHub `login` handle is stored as `provider_username` (display only; can change) and
  refreshed on every login, including logins through an existing external-identity link.
- The email is always taken from the verified primary entry returned by the `/user/emails`
  endpoint, never from the `/user` endpoint's public-facing `email` field directly, since that
  field may reflect a verified non-primary address or be hidden entirely. The public field is
  used only as a last-resort fallback when no verified primary entry exists.
- Outbound requests to GitHub (token exchange, profile fetch, email list fetch) are bounded by a
  10-second timeout. A timeout, network failure, or 5xx response is reported as a retryable
  `AUTHENTICATION_PROVIDER_UNAVAILABLE` (HTTP 503), distinct from an invalid code or token
  (`AUTHENTICATION_FAILED`, HTTP 401).

## 6. Consequences

### Positive

- Users with a verified NEWAX account and a GitHub account can sign in without a password.
- The provider abstraction (`OAuthProvider` interface) makes future providers easy to add.
- All security controls (rate limiting, HTTPS enforcement, CSRF protection, session revocation) apply uniformly.
- No access tokens are persisted, reducing the blast radius of a database compromise.

### Negative

- GitHub OAuth credentials (`client_id`, `client_secret`) must be rotated through environment configuration; there is no in-app rotation flow.
- Users who do not have a verified email address in NEWAX cannot use OAuth without administrative intervention.
- GitHub as a provider depends on GitHub's availability; a GitHub outage affects OAuth logins.
- The link-only approach requires users to have an existing NEWAX account; self-registration via GitHub is not supported.

## 7. Alternatives Considered

### 7.1 PKCE-only flow (no client secret)

PKCE is required for public clients (mobile, SPA). This implementation targets the server-side API, so a confidential client with a client secret is appropriate. PKCE support can be added later if a public-client flow is needed.

### 7.2 Persist access tokens

Storing OAuth access tokens would enable server-to-provider API calls on behalf of the user. This capability is not needed for authentication and would increase the sensitivity of the database. Access tokens are discarded after the profile fetch.

### 7.3 Automatic user provisioning

Allowing OAuth to create new users would bypass the existing invitation and organization membership workflow. Requiring an existing invited account preserves data integrity and organizational access control.
