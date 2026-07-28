# Changelog

All notable changes to the NEWAX HTTP Security Boundary are documented here.

## 0.1.0 - 2026-07-12

### Added

- Production HTTPS enforcement with exact trusted TLS proxy networks.
- Early request boundary before body parsing and routing.
- Server-controlled request identifiers.
- Request-method, expectation, framing, declared-body-size, and transport checks.
- API-oriented security response headers and HSTS policy.
- Host-only secure session and CSRF cookie serialization.
- Exact-origin, Fetch Metadata, JSON body, and signed session-bound CSRF validation.
- Organization membership selection through Trusted Request Context.
- Explicit route permission metadata and enforcement.
- PostgreSQL-backed distributed fixed-window rate limiting with HMAC-hashed keys.
- Authentication-sensitive rate-limit policy.
- Sensitive response redaction and stable public error envelopes.
- Shared governance audit integration for denials, failures, and completed state changes.
- NestJS middleware, guard, interceptor, exception filter, decorators, infrastructure adapters, and tests.
- Documentation, Module Registry registration, and ADR 0019.

### Security

- Client-supplied request identifiers are not trusted as server audit identifiers.
- Client-supplied user, person, organization, role, status, and permission claims are not accepted as authority.
- Forwarded protocol and client-address values are trusted only from configured proxy networks.
- Hop-count proxy trust is not used.
- Ambiguous `Content-Length` and `Transfer-Encoding` framing is rejected.
- Unknown public state-changing endpoints are denied.
- CSRF tokens are signed and bound to the authenticated session.
- Raw rate-limit keys, cookies, credentials, session identifiers, session tokens, CSRF tokens, request bodies, query strings, and stack traces are excluded from audit metadata and public errors.
- Arbitrary error objects cannot select their own public HTTP status.
- Successful state-changing operations are audited after completion rather than before execution.

### Database

- Adds `core_http_rate_limit_buckets` for cluster-consistent rate limiting.
- Continues using shared `core_audit_logs` for governance records without taking ownership of that table.
