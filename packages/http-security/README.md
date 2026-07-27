# NEWAX HTTP Security Boundary

## Status

Draft reusable platform service.

Version: `0.1.0`

## Purpose

The HTTP Security Boundary protects the transition from untrusted network requests into trusted NEWAX application operations.

It establishes transport assumptions, request framing controls, browser-origin protections, session transport, distributed throttling, Trusted Request Context resolution, permission enforcement, public error redaction, response redaction, and HTTP security auditing.

The boundary is named for the HTTP application protocol. Production clients must connect over HTTPS.

## Core sequence

```text
HTTPS request
  -> trusted TLS proxy validation
  -> early request framing and size checks
  -> security response headers
  -> route-aware distributed rate limiting
  -> origin and Fetch Metadata validation
  -> secure session cookie validation
  -> Trusted Request Context resolution
  -> signed CSRF validation for state changes
  -> permission enforcement
  -> application service
  -> response redaction
  -> durable audit record
```

## Public module API

The package exports:

- `CookieHeaderParser`
- `SecureCookieTransport`
- `RequestOriginPolicy`
- `SignedCsrfTokenService`
- `HttpRateLimiter`
- `SecurityHeadersPolicy`
- `SensitiveResponseRedactor`
- HTTP security policy, request, audit, rate-limit, cookie, and header contracts
- Cryptography, clock, rate-limit-store, and audit-sink ports
- `HttpSecurityError`

The NestJS application adapter additionally provides:

- `HttpBoundaryMiddleware`
- `HttpSecurityGuard`
- `HttpSecurityInterceptor`
- `HttpSecurityExceptionFilter`
- Route decorators for public, account, organization, permission, and authentication-sensitive boundaries

## HTTPS and proxy trust

Production requires:

- `HTTP_REQUIRE_HTTPS=true`
- Exact HTTPS origins
- An explicit CSRF secret
- One or more exact trusted TLS proxy IP addresses or CIDR networks

The application trusts forwarded protocol and client-address information only from configured proxy networks. Hop-count proxy trust is not used because network paths change while attackers remain strangely motivated.

The application may receive plain HTTP from an approved reverse proxy after HTTPS termination. The application port must remain private and unreachable from the public internet.

HSTS is emitted only when the request is recognized as secure.

## Early request boundary

The middleware runs before body parsing and routing.

It:

- Generates a server-controlled UUID request identifier.
- Applies security headers.
- Rejects unsupported methods and method-override headers.
- Rejects unsupported `Expect` headers.
- Rejects duplicate or ambiguous `Content-Length` and `Transfer-Encoding` framing.
- Rejects invalid transfer encodings.
- Rejects declared bodies above the configured limit.
- Rejects insecure requests when HTTPS is required.
- Produces a minimal public error envelope.
- Attempts to persist denial audit records without exposing request secrets.

The middleware does not trust a client-supplied request identifier. External correlation identifiers can be supported later as separate untrusted metadata.

## Session transport

Authenticated browser sessions use a host-only cookie:

```text
__Host-newax_session
```

Properties:

- `Secure`
- `HttpOnly`
- `Path=/`
- No `Domain`
- `SameSite=Lax`
- `Priority=High`

The session token is opaque. Only its keyed hash is stored by Authentication.

Clearing a security cookie sets both `Max-Age=0` and an expiration date in the past.

Bearer authorization headers are not enabled in this slice.

## Membership selection

Organization context is selected through:

```text
x-newax-membership-id
```

The header carries only a membership identifier. Trusted Request Context derives and verifies:

- User identity from the authenticated session.
- Person identity from the Users Registry.
- Organization identity from the selected membership.
- Membership ownership and status.
- Organization status.
- Effective permissions from Access Control.

Clients cannot assert trusted user, person, organization, role, status, or permission values.

## Origin and CSRF protection

State-changing requests require:

- An exact allowed `Origin` or valid allowed-origin `Referer` fallback.
- Acceptable Fetch Metadata site classification.
- JSON or structured JSON content type when a body exists.
- A valid authenticated session unless a later ADR explicitly permits a public mutation.
- A signed CSRF token in both the CSRF cookie and request header.

The CSRF cookie is:

```text
__Host-newax_csrf
```

The matching header is:

```text
x-newax-csrf
```

CSRF tokens are random, signed with keyed HMAC, and bound to the authenticated session identifier. Replaying a valid token against another session fails.

The CSRF token is readable by the same-origin client and therefore is not treated as a confidential response value. Its integrity and session binding are the security properties.

CORS is a browser cooperation mechanism. It is not authentication or authorization.

## Rate limiting

The boundary applies route-aware limits before authentication and context resolution.

Authentication-sensitive routes use a lower configured limit.

Rate-limit state is stored in PostgreSQL so limits remain consistent across multiple application instances. Keys are HMAC-hashed before persistence; raw IP-and-route key material is not stored in the rate-limit table.

The initial implementation uses fixed windows. More advanced risk scoring and distributed edge controls remain deferred.

## Permission enforcement

Route permission metadata is valid only on organization-context endpoints.

Permission codes are:

- Required to be explicit.
- Validated at decorator construction.
- Deduplicated.
- Checked against the immutable permission set produced by Trusted Request Context.

Role names and job titles are never used as authorization evidence.

Endpoints without explicit context metadata default to organization context. This is fail-closed behavior, not an invitation to omit decorators forever.

## Response and error controls

Successful responses pass through a recursive sensitive-value redactor.

Sensitive key matching is case-insensitive and separator-insensitive. Credentials, authorization values, passwords, secrets, raw session tokens, token hashes, cookies, private keys, and recovery materials are removed.

Public errors use a stable envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "The request is not allowed.",
    "requestId": "..."
  }
}
```

Internal error messages, stack traces, persistence details, and security-rule details are not returned to clients.

Only known NEWAX error-code namespaces are mapped as domain errors. Arbitrary thrown objects cannot choose their own HTTP status by supplying a convenient `code` property, because apparently even error objects require a trust boundary.

## Security headers

The boundary applies API-oriented headers including:

- `Cache-Control: no-store, max-age=0`
- Strict Content Security Policy with no default resource loading
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-site`
- `Origin-Agent-Cluster: ?1`
- Restrictive Permissions Policy
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-Permitted-Cross-Domain-Policies: none`
- HSTS on secure requests

The policy is intentionally API-focused. A future HTML application boundary may require a nonce-based Content Security Policy rather than reusing this one.

## Audit records

The boundary writes security records to the shared `core_audit_logs` governance table.

Recorded examples include:

- HTTPS rejection.
- Framing rejection.
- Rate-limit denial.
- Authentication or membership denial.
- Permission denial.
- Failed request.
- Completed authenticated state-changing request.

Audit metadata excludes raw cookies, session identifiers, session tokens, CSRF tokens, credentials, request bodies, and complete query strings.

Audit persistence is best-effort for early denials and completed requests so an audit outage does not automatically turn into a platform-wide availability outage. Audit-write failures are logged as structured event types without copying secrets or exception messages.

## Database ownership

The module owns:

- `core_http_rate_limit_buckets`

The module writes security records to the shared governance-owned:

- `core_audit_logs`

It does not own Authentication sessions, Users, Memberships, Organizations, roles, permissions, or domain records.

## Public endpoint posture

This slice enables only explicitly marked safe public reads such as health status.

Unauthenticated state-changing endpoints remain disabled.

Business controllers remain deferred until each endpoint has:

- Explicit context mode.
- Explicit permission metadata where required.
- Input validation and output contract.
- Sensitive-field review.
- Idempotency policy where relevant.
- Domain audit requirements.
- Integration and abuse tests.

## Configuration

```text
HTTP_ALLOWED_ORIGINS
HTTP_CSRF_SECRET
HTTP_REQUIRE_HTTPS
HTTP_TRUSTED_PROXY_CIDRS
HTTP_BODY_LIMIT_BYTES
HTTP_RATE_LIMIT_WINDOW_MILLISECONDS
HTTP_RATE_LIMIT_MAXIMUM_REQUESTS
HTTP_AUTH_RATE_LIMIT_MAXIMUM_REQUESTS
HTTP_HSTS_MAX_AGE_SECONDS
HTTP_HSTS_INCLUDE_SUBDOMAINS
HTTP_HSTS_PRELOAD
```

HSTS preload is disabled by default and requires deliberate infrastructure review. Preload is easy to enable and impressively tedious to undo.

## Dependencies

The platform service depends on:

- Trusted Request Context `>=0.1.0`
- Shared database and audit infrastructure through application adapters

Foundation modules do not depend on the HTTP Security Boundary.

## Known limitations

- Public login, logout, invitation, verification, password-reset, and recovery endpoints are not enabled.
- No bearer-token or service-account transport exists.
- No trusted platform-operator HTTP context exists.
- Rate limiting uses PostgreSQL fixed windows rather than an edge or dedicated distributed limiter.
- No device, ASN, reputation, or behavior-based risk scoring exists.
- No multipart or file-upload boundary exists.
- No response-schema allowlisting exists beyond the redactor.
- Audit delivery is not transactional with domain writes.
- External distributed tracing remains deferred.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0010: Define Authentication and User Identity Strategy.
- ADR 0015: Consolidate Roles and Permissions into Access Control.
- ADR 0016: Build the Users Registry Service Foundation.
- ADR 0017: Build the Authentication Service Foundation.
- ADR 0018: Build the Trusted Request Context Foundation.
- ADR 0019: Build the HTTP Security Boundary.
