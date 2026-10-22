# ADR 0034: Build the External References Governance Foundation

- Status: Accepted
- Date: 2026-07-14
- Owners: NEWAX Engineering

## 1. Context

The approved initial Central Registry persistence scope ends with Files, Audit Logs, and External
References. Files and Audit now have controlled reusable foundations, while
`core_external_references` remains a dormant table with an incomplete Tenant boundary.

The table currently:

- Carries an optional Organization ID but no Tenant ID.
- Uses an Organization-only foreign key that can turn an Organization mapping into a global row
  on hard deletion.
- Has no reusable permission boundary or application adapter.
- Allows a JSON metadata field without an approved content or disclosure policy.

External References belong to governance. They map a NEWAX domain entity identifier to an
identifier assigned by another system. They are not credentials, provider configuration,
synchronization state, domain transactions, or an integration engine.

## 2. Decision

Build a draft External References platform-service foundation.

The slice will:

1. Add nullable Tenant identity to External Reference persistence.
2. Backfill Tenant identity for existing Organization-scoped mappings.
3. Require Tenant identity whenever Organization identity is present.
4. Enforce the canonical Tenant-Organization pair through a composite foreign key.
5. Add a reusable package for current-Organization registration and bounded listing.
6. Require `external_references.register` and `external_references.view` at the package boundary.
7. Revalidate active Tenant, Organization, actor User, and actor Person state in persistence.
8. Serialize duplicate registration with an advisory-lock fingerprint and a unique index.
9. Exclude mapping values from events and structured logs.
10. Keep metadata and all integration execution outside this first release.

## 3. Scope semantics

The persistence model permits:

| Scope        | Tenant ID | Organization ID | Package access |
| ------------ | --------- | --------------- | -------------- |
| Global       | null      | null            | Deferred       |
| Tenant       | present   | null            | Deferred       |
| Organization | present   | present         | Supported      |

The service accepts Tenant and Organization authority only through trusted context. It cannot
create or list global or Tenant-only records.

## 4. Mapping contract

A mapping contains:

- `domain_code`: the stable NEWAX domain or module code.
- `entity_type`: the stable NEWAX entity classification.
- `entity_id`: the opaque identifier assigned by the owning NEWAX domain.
- `external_system`: a stable code identifying the other system.
- `external_key`: the opaque, case-sensitive identifier assigned by that system.

The mapping does not prove that either entity exists. Domain-owned tables remain independent and
cannot be coupled to this governance service through speculative foreign keys.

## 5. Uniqueness and concurrency

Within one Tenant and Organization, an external-system code and external key identify at most one
mapping. The repository hashes the scoped key material before acquiring a transaction advisory
lock, checks for an existing mapping, then inserts under a database unique index.

The same external-system key may be valid in another Organization. No rule is invented that an
entity may have only one external key per system.

## 6. Privacy and security

External keys are identifiers, not secrets. Credentials, access tokens, API keys, passwords,
connection strings, and provider configuration are forbidden conceptually and remain outside the
contract.

The package:

- Preserves opaque entity identifiers and external keys without Unicode or case normalization.
- Rejects blank values, control characters, character-limit overflow, and UTF-8 byte overflow.
- Normalizes only stable codes.
- Emits no domain code, entity identifier, external-system code, external key, or metadata in its
  event and logging contracts.
- Does not accept, store, return, or disclose the dormant metadata field.

## 7. Database migration

The migration:

1. Adds nullable `tenant_id`.
2. Backfills it from the canonical Organization.
3. Stops if an Organization-scoped mapping cannot resolve a Tenant.
4. Replaces the Organization-only foreign key and former indexes.
5. Adds an Organization-requires-Tenant check.
6. Adds Tenant and composite Tenant-Organization foreign keys with restrictive deletion.
7. Adds scoped uniqueness, entity lookup, and cursor indexes.

Global rows remain unchanged. No external identifier or metadata value is rewritten.

## 8. Consequences

### Positive

- The approved initial Central Registry table sequence gains its final service boundary.
- Organization mappings have explicit and relationally enforced Tenant ownership.
- Cross-Tenant inserts and cursors fail closed.
- Domain modules can use one mapping contract without embedding provider execution.
- Sensitive integration configuration remains outside the governance table.

### Negative

- Global and Tenant-only records remain inaccessible through the package.
- External entity existence is not validated generically.
- Mapping lifecycle and synchronization remain unavailable.
- Events are synchronous and not durably delivered.

## 9. Deferred decisions

- HTTP exposure.
- Global and Tenant-only authority models.
- Metadata schema and disclosure policy.
- Update, replacement, deletion, archival, restore, and record-merge behavior.
- Provider credentials and connection configuration.
- Webhooks, polling, retries, synchronization, reconciliation, and conflict resolution.
- Durable outbox publication and automatic Audit ingestion.
- Integrations module activation.

## 10. Approval

This decision accepts the External References governance foundation as the next controlled
registry build slice. It does not activate the module for production reuse and does not authorize
merging the controlled pull-request stack.
