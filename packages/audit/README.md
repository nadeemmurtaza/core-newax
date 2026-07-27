# NEWAX Audit Governance

## Status

Draft reusable platform service.

Version: 0.1.0

Draft status does not approve the module for production reuse.

## Purpose

Audit records who or what performed a security-relevant or administrative action against a
known entity. It is separate from business transactions, domain events, workflow history, and
status history.

This foundation establishes:

- Validated trusted internal recording.
- Explicit global, Tenant, and Organization scope.
- Tenant-safe current-Organization summary listing.
- Permission enforcement for human-readable access.
- A narrow summary contract that does not disclose stored metadata or network details.

## Public package surface

The package exports:

- **AuditService**
- **AuditRepository**
- Audit entry, input, page, scope, classification, and repository contracts
- **AUDIT_PERMISSIONS**
- **AuditModuleError**

The application composes persistence and HTTP-security integration. The reusable package has no
NestJS, Prisma, HTTP Security, or business-domain dependency.

## Operations

### Record a trusted entry

**AuditService.recordTrustedEntry** is an internal application-adapter boundary. It is not an
end-user operation and must not be bound directly to an untrusted request.

The operation validates and bounds:

- Tenant, Organization, actor, and correlation identifiers.
- Module, action, and entity classification.
- Outcome and sensitivity.
- Request, address, and user-agent text.
- JSON metadata depth, entry count, string size, total size, and keys.

Metadata keys associated with credentials, authorization, cookies, CSRF values, passwords,
private keys, recovery material, secrets, session identifiers, or tokens are rejected. Trusted
emitters remain responsible for sending only data approved for durable audit storage.

Organization-scoped writes may omit Tenant identity. The persistence adapter resolves the
Organization's canonical Tenant and stores both identifiers. If a Tenant is supplied, the
Organization must belong to it.

### List current-Organization entries

**AuditService.listCurrentOrganizationEntries** requires a trusted current-Organization context
and **audit.view**.

Reads are:

- Bound to the exact Tenant and Organization.
- Limited to 100 records per page.
- Ordered newest first.
- Cursor-validated inside the same Tenant and Organization.
- Returned as immutable summaries.

Each summary contains only:

- Audit entry ID.
- Tenant and Organization scope.
- Optional actor user ID.
- Module, action, entity type, and optional entity ID.
- Outcome and sensitivity.
- Optional request ID.
- Creation time.

Stored metadata, previous values, new values, IP addresses, user agents, and correlation IDs are
not returned by this foundation.

## Scope model

Audit entries support three explicit scopes:

| Scope        | Tenant ID | Organization ID | Initial use                                      |
| ------------ | --------- | --------------- | ------------------------------------------------ |
| Global       | null      | null            | Pre-context platform and HTTP boundary activity. |
| Tenant       | present   | null            | Tenant-wide governance activity.                 |
| Organization | present   | present         | Current-Organization activity.                   |

An Organization ID cannot be stored without a Tenant ID. The database uses a composite foreign
key to prevent cross-Tenant Organization attribution.

## Permission model

| Permission | Meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| audit.view | List bounded summaries for the trusted current Organization. |

Recording is restricted by application composition rather than an end-user permission. Audit
export is deferred.

## Database ownership

Audit owns:

- **core_audit_logs**

The table retains internal fields for metadata, value snapshots, network details, correlation,
and request tracing. Their presence in persistence does not make them part of the read contract.

## HTTP Security integration

HTTP Security continues to define its own audit-sink port and does not depend on this package.
The NestJS application supplies **AuditHttpSecuritySink**, which maps that port to the validated
Audit service.

Best-effort semantics remain unchanged: HTTP boundary callers catch audit-write failures and log
a bounded structured failure event rather than failing an otherwise valid request.

Foundation and business modules should use approved application adapters or future event
ingestion rather than importing an app-local persistence implementation.

## Events and configuration

This release emits no public events, consumes no event stream, and defines no runtime
configuration.

Transactional outbox delivery, event ingestion, retention configuration, and export controls
require separate decisions.

## Exclusions

This release does not provide:

- HTTP endpoints.
- Audit export.
- Raw metadata or network-detail reads.
- Previous-value or new-value recording policy.
- Retention, legal hold, deletion, or archival automation.
- Search, analytics, or external audit storage.
- Event-bus ingestion or a transactional outbox.
- Domain transaction, workflow, event, or status-history storage.
- Platform-operator or cross-Organization browsing.

## Dependencies

Conceptual data references:

- Tenants at 0.1.0 or later.
- Organizations at 0.2.0 or later.
- Users at 0.1.0 or later.

The package itself depends only on its repository contract.

## Testing

Required verification includes:

- Unit coverage for validation, sensitive-key rejection, permissions, pagination, and
  fail-closed repository boundaries.
- PostgreSQL integration coverage for Tenant resolution, actor validation, cursor isolation,
  ordering, and composite Organization ownership.
- Prisma schema validation and migration deployment.
- Repository formatting, linting, type-checking, tests, and production build.

## Client extension guidance

Client-specific audit fields must not be added to the reusable summary contract or core table
without architecture, privacy, retention, and compatibility review. Client integrations should
use approved adapters after the shared policy is defined.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0005: Use Event-Driven Module Communication.
- ADR 0009: Define Module Registry and Dependency Rules.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0019: Build the HTTP Security Boundary.
- ADR 0027: Separate Tenant Ownership from Organizations.
- ADR 0033: Build the Audit Governance Foundation.
