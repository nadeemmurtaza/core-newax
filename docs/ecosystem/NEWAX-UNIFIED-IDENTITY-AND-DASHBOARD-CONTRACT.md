# NEWAX Unified Identity, Bootstrap Account, and Service Dashboard Contract

Status: proposed implementation contract. This document does not claim that authentication, provisioning, deployment, or dashboards are already implemented.

## Outcome

A person signs in once through nID and returns to the exact NEWAX service they originally opened. Core supplies one reusable authenticated application shell and dashboard framework. Each service contributes its own authorized navigation, widgets, data adapters, and saved arrangement without duplicating identity or dashboard infrastructure.

## Non-negotiable security rules

- nID is the central identity authority. A service must not create an independent password for an existing nID identity.
- Use a standards-based authorization-code flow with PKCE, exact registered redirect URIs, unpredictable one-time state, short-lived one-time codes, server-side code exchange, audience/client binding, issuer validation, expiry checks, and replay prevention. The existing nID flow is described in source as not full OAuth2/OIDC and lacks PKCE and signed ID tokens; do not represent it as production-grade OIDC until those gaps are closed or a standards-compliant provider is adopted.
- Never accept arbitrary return URLs. Resolve the destination from a registered client and exact allowlisted callback. Preserve only an opaque, validated in-service return path.
- Never place passwords, client secrets, access tokens, refresh tokens, or long-lived credentials in browser localStorage, URLs, logs, analytics, or Git.
- Prefer secure, HttpOnly, SameSite cookies for browser sessions. Apply CSRF protections where cookie-authenticated state changes require them. Tokens for server-to-server exchanges remain server-side.
- No development/mock login fallback may be active in production. Startup must fail closed if production identity configuration is missing or mock authentication is enabled.
- Authentication does not imply service access. Every service verifies the identity, active organization/tenant membership, service entitlement, and required permissions on the server.
- Enforce tenant isolation at every data/API boundary. Dashboard configuration and widget queries are tenant-scoped. Do not trust tenant IDs or roles supplied by the browser.
- Passwords are hashed with a maintained, memory-hard password hashing algorithm such as Argon2id, with parameters reviewed against deployment capacity. Never store reversible passwords or log submitted credentials. Apply rate limits, generic failure responses, breached-password checks, and audit events.
- Keep recovery and account bootstrap separate from ordinary login. Phone/OTP may remain an additional verified factor or recovery channel; it must not silently bypass password/session security.
- A real bootstrap account is created only through an explicit, audited, one-time deployment command or protected operator workflow. Username and initial password are supplied through an interactive secret prompt or a secret-manager reference, never source code, a committed seed, command-line arguments, or plain logs. Force a password change at first sign-in and disable/remove bootstrap mode after success.
- Do not publish a default username/password in documentation. The username is operator-chosen at provisioning time; the password is generated or supplied privately at deployment.

## nID deliverables

1. Add username/password credentials to the canonical Account identity without creating a second person record. Define normalized username uniqueness and account status/lockout behavior.
2. Add secure password enrollment, password sign-in, password change, reset/recovery, session revocation, rate limiting, generic errors, and audit events. Retain phone/OTP only as explicitly configured additional/recovery functionality.
3. Upgrade relying-party authentication to a standards-compliant authorization-code flow with PKCE and signed, audience-bound identity assertions or use a vetted OIDC implementation. Publish discovery and JWKS endpoints if implementing an OIDC provider.
4. Validate client registration, exact redirect URIs, scopes, state, nonce, PKCE verifier/challenge, code lifetime, single-use redemption, issuer, audience, and signature.
5. Add a one-time bootstrap operator command. It must be safe to rerun, refuse to reset an existing account silently, require secure secret input, set the mustChangePassword flag, emit no secret material, and document production deployment steps.
6. Keep the bootstrap account's organization/service access explicit. Do not give global superuser access merely because it is the first account.
7. Add integration tests for correct/incorrect credentials, normalization collisions, disabled/locked accounts, rate limits, reset, revocation, bootstrap idempotency, no password leakage, tenant membership, and OIDC/PKCE negative cases.

## Core dashboard deliverables

1. Implement the shared shell in the existing Core web application and governed shared packages. Do not create a separate dashboard application for each service.
2. Define versioned contracts for service registration, navigation items, dashboard widgets, data adapters, permission requirements, layout schema, and module lifecycle.
3. Render the same shell with service-specific contributions: service name/branding within NEWAX tokens, navigation, authorized widgets, and layout. Data must come from the owning service's backend API, not cross-service database reads.
4. Support user- and organization-scoped saved layouts with schema versioning, validation, sensible defaults, responsive behavior, accessible keyboard interaction, and migration for older layouts.
5. Enforce widget visibility and every data request on the backend. Hiding a widget in the browser is not authorization.
6. Keep extension points bounded and versioned. A service cannot inject arbitrary code, override authentication, or bypass Core permissions.
7. Ensure service manifests and widget configuration are validated at registration time. Missing/unknown modules fail closed and show a useful unavailable state.

## Service integration

- Communicator and every future service use the same nID sign-in entry point and Core shell contract.
- When a user starts sign-in from a service, preserve a validated service destination through the authorization flow. After successful callback and server-side session establishment, return to that exact service/dashboard path.
- Communicator must remove its production-capable mock-login shortcut. Mock identity is permitted only in isolated automated tests or explicitly isolated local development.
- Service APIs validate sessions and membership server-side. No service accepts an account ID or organization ID from client storage as proof of identity.

## Rollout sequence

1. Inspect and test current nID account, session, OAuth client, and tenant schemas.
2. Implement password credential support and secure bootstrap provisioning in nID; add migration and tests.
3. Close OAuth/OIDC/PKCE and production mock-auth gaps before enabling real cross-service SSO.
4. Implement the Core dashboard contracts and shared shell with one reference service.
5. Integrate Communicator as the first relying party; test sign-in, callback, return path, logout, expired sessions, and denied membership.
6. Add the remaining services one by one using the same contract.
7. Deploy behind explicit configuration, migrate users safely, rotate any exposed/reused credentials, and verify production logs contain no secrets.

## Definition of done

- A genuine nID account can sign in using its provisioned username/password; no fixed credentials exist in source or docs.
- Phone/OTP remains available only according to configured policy.
- Sign-in from each registered service returns to that service's validated original destination.
- No production mock-login path exists.
- Callback, CSRF/state, PKCE, code replay, session expiry, logout/revocation, unauthorized service, and cross-tenant access tests pass.
- Core renders service-owned data and arrangements through one shell while the owning backend enforces authorization.
- Build, lint, typecheck, migrations, integration tests, and security review pass before merge.
- Deployment runbook explains how to provision the first user without sharing or committing the password.