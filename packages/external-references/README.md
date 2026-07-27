# NEWAX External References

## Status

- Version: `0.1.0`
- Lifecycle: Draft
- Layer: Platform service
- Database ownership: `core_external_references`

## Purpose

External References maintain Organization-scoped mappings between stable NEWAX entity identifiers
and identifiers assigned by another system. They are governance records, not credentials,
integration configuration, synchronization jobs, or domain data.

This first slice completes the final table in the approved initial Central Registry data scope.

## Supported operations

### Register a current-Organization mapping

`registerCurrentOrganizationExternalReference` requires trusted actor, Tenant, and Organization
context plus `external_references.register`.

It accepts:

- A normalized NEWAX domain code.
- A normalized entity-type code.
- An opaque, case-sensitive NEWAX entity identifier.
- A normalized external-system code.
- An opaque, case-sensitive external key.

The repository revalidates the active Tenant, Organization, User, and Person before inserting.
Registration is serialized by a transaction-scoped advisory lock derived from a SHA-256
fingerprint; the opaque external key is not used in logs or event payloads.

### List current-Organization mappings

`listCurrentOrganizationExternalReferences` requires `external_references.view`. It returns at
most 100 records, validates a cursor inside the exact trusted Tenant and Organization, and never
returns global, Tenant-only, or another Organization's records.

There is no HTTP endpoint in this release. The service is available only through trusted
application composition.

## Tenant boundary

Organization-scoped rows carry both `tenant_id` and `organization_id`. PostgreSQL enforces the
canonical pair through a composite foreign key. A check constraint prevents an Organization ID
without Tenant identity.

The table continues to permit both IDs to be null for dormant global-governance mappings. This
package cannot create or read those records.

## Privacy and security

- External keys and entity identifiers are opaque values and preserve case.
- Control characters, empty values, excessive character lengths, and excessive UTF-8 byte
  lengths are rejected.
- Event and structured-log records contain only actor, Tenant, Organization, mapping, event, and
  occurrence identifiers.
- `metadata` is not accepted, written, returned, logged, or emitted by this release.
- External keys identify records. Credentials, tokens, API keys, passwords, and connection
  configuration must never be stored as External References.

## Deliberately deferred

- Public or internal HTTP endpoints.
- Global or Tenant-only service operations.
- Metadata writes or reads.
- Update, replacement, deletion, archival, restore, and merge workflows.
- External-system credentials and provider configuration.
- Synchronization, polling, webhooks, retries, reconciliation, and conflict resolution.
- Referential validation against domain-owned tables.
- Durable outbox delivery and automatic Audit ingestion.

Domain modules retain ownership of their records. External References store mappings only.
