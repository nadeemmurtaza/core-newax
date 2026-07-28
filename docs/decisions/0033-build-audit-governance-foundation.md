# ADR 0033: Build the Audit Governance Foundation

- Status: Accepted
- Date: 2026-07-14
- Owners: NEWAX Engineering

## 1. Context

The initial NEWAX data scope places Audit immediately after Files. The database already contains
**core_audit_logs**, and the HTTP Security Boundary already writes bounded security events into
that table through an application-local Prisma sink.

That state is useful but incomplete:

- Audit is still marked planned in the Module Registry.
- Persistence ownership is located under HTTP Security instead of an Audit composition.
- Audit rows do not carry Tenant identity.
- Organization attribution uses only Organization ID and does not enforce the canonical
  Tenant-Organization pair.
- No reusable permission-gated summary read exists.
- The table contains sensitive internal fields without an approved disclosure boundary.

The data architecture requires audit logs to be separate from transactions, events, workflows,
and status history. It also requires every Tenant-controlled record to carry or inherit Tenant
identity.

## 2. Decision

Build the first reusable Audit Governance foundation as a draft platform service.

The slice will:

1. Add nullable Tenant identity to Audit persistence.
2. Backfill Tenant identity for existing Organization-scoped rows.
3. Enforce that an Organization ID requires a Tenant ID.
4. Enforce the canonical Tenant-Organization pair through a composite foreign key.
5. Add a reusable package with trusted recording and current-Organization listing.
6. Require **audit.view** for summary reads.
7. Move the HTTP Security sink into the application Audit composition.
8. Keep the HTTP Security package independent by continuing to implement its existing sink port.
9. Return only bounded summaries, never raw metadata, value snapshots, network details, or
   correlation identifiers.
10. Keep the Audit module in draft status until formal module approval.

## 3. Scope semantics

Three scopes are permitted:

| Scope        | Tenant ID | Organization ID |
| ------------ | --------- | --------------- |
| Global       | null      | null            |
| Tenant       | present   | null            |
| Organization | present   | present         |

An Organization-scoped writer may omit Tenant ID only at the trusted service boundary. The
repository resolves the Organization's Tenant before insertion. If a Tenant is supplied, it must
match.

Global Audit entries remain necessary for activity that occurs before trusted Tenant or
Organization context exists, including early HTTP denials.

## 4. Recording boundary

Trusted recording is an application-adapter capability, not an HTTP or end-user operation.

The service validates:

- Identifiers.
- Module, action, and entity codes.
- Outcome and sensitivity.
- Timestamps and bounded text.
- Metadata structure, depth, count, string size, total size, and sensitive keys.

HTTP Security continues to decide which HTTP events are recorded and continues to catch
persistence failures. This decision does not make HTTP audit writes transactional with domain
operations.

Business and Foundation modules must not gain a reverse dependency on HTTP Security. Future
cross-module audit ingestion should use approved application adapters or an event/outbox decision.

## 5. Read boundary

The initial read operation:

- Requires trusted Tenant and current-Organization context.
- Requires **audit.view**.
- Uses a maximum page size of 100.
- Validates cursors inside the same Tenant and Organization.
- Orders entries newest first.
- Exposes only classification and tracing summaries.

Audit export and raw detail reads are separate, higher-risk capabilities and remain deferred.

## 6. Database migration

The migration:

1. Adds nullable **tenant_id**.
2. Backfills it by joining existing Organization-scoped rows to **core_organizations**.
3. Replaces the single-column Organization foreign key.
4. Adds a check preventing Organization identity without Tenant identity.
5. Adds Tenant and composite Tenant-Organization foreign keys.
6. Adds Tenant-aware indexes for Organization and Tenant chronology.

Global rows remain null-scoped. No historical record is reclassified without canonical
Organization evidence.

## 7. Privacy and security

The database already supports metadata, previous values, new values, IP address, user agent,
correlation ID, and request ID. Only request ID is included in the initial summary contract.

Metadata recording rejects keys associated with credentials, authorization, cookies, CSRF
values, passwords, private keys, recovery material, secrets, session identifiers, and tokens.
This is a defense in depth control; trusted emitters remain accountable for content.

This foundation does not define a legal retention period, data-subject access policy, export
policy, or legal-hold behavior.

## 8. Consequences

### Positive

- Organization Audit records gain explicit Tenant ownership.
- Cross-Tenant attribution fails at the database boundary.
- Audit table ownership becomes visible and modular.
- HTTP Security retains package independence and best-effort availability semantics.
- Current-Organization readers receive a small permission-gated contract.
- Sensitive stored fields remain private pending explicit policy.

### Negative

- The Audit table accepts a nullable Tenant ID to preserve legitimate global entries.
- Trusted recording remains synchronous and is not transactionally coupled to domain changes.
- Event-driven ingestion, retention, and export remain unfinished.
- Application composition must connect module-specific audit producers.

## 9. Deferred decisions

- Audit HTTP endpoints.
- Platform-operator, Tenant-wide, and cross-Organization browsing.
- Export formats and export authorization.
- Raw metadata, network detail, correlation, and value-snapshot access.
- Retention, legal hold, deletion, archival, and external immutable storage.
- Event schemas, ingestion guarantees, and transactional outbox delivery.
- Data-access logs, status history, record merges, and deletion requests.
- Search and analytics projections.

## 10. Approval

This decision accepts the Audit Governance foundation as the next controlled registry build
slice. It does not activate the module for production reuse and does not authorize merging the
controlled pull-request stack.
