# ADR 0028: Build Organization Addresses Registry Foundation

## Status

Accepted

## Date

2026-07-12

## Context

NEWAX Core already contains canonical address records plus separate Person and Organization link tables. Addresses are reusable foundation data, but address visibility and control differ sharply by owner.

Organization addresses support operational needs such as registered offices, campuses, facilities, billing locations, shipping locations, and mailing locations. Personal addresses carry greater privacy, consent, safety, and sharing implications. Treating both as one immediately available service would create an authority boundary the current system has not approved.

## Decision

Build the first Addresses Registry capability for Organization addresses only.

The reusable Addresses module will:

- Create and list addresses for the current trusted Organization.
- Derive Tenant and Organization authority only from trusted request context.
- Revalidate that the Tenant and Organization are active and non-deleted.
- Reuse equivalent canonical records from `core_addresses` where possible.
- Store Organization ownership through `core_organization_addresses`.
- Support fixed address types: `registered`, `office`, `billing`, `shipping`, `mailing`, `campus`, `facility`, and `other`.
- Allow at most one primary address for each Organization and address type.
- Preserve removed Organization-address links as history while allowing the same canonical address and type to be added again as a new active link.
- Publish metadata-only `address.created` events without street, locality, postal, or country values.
- Keep all list cursors inside the trusted Tenant and Organization boundary.

## Canonical address policy

Canonical address records are global reusable location data. Equivalent normalized values may be reused by several Organizations, including Organizations in different Tenants.

Canonical reuse does not grant cross-Tenant access. Every read begins from the Organization link and validates the trusted Tenant and Organization. A caller cannot search or retrieve arbitrary global addresses through this module.

Normalization is deliberately conservative:

- Unicode NFKC normalization.
- Leading and trailing whitespace removal.
- Internal whitespace collapse.
- Uppercase country and postal codes.
- Two ASCII-letter country-code syntax validation.

The module does not claim postal deliverability, official country assignment, geocoding accuracy, or government verification.

## Primary-address integrity

The service serializes primary assignment per Tenant, Organization, and address type with a PostgreSQL transaction-scoped advisory lock.

Migration-owned partial unique indexes provide database backstops so:

- only one row can have `is_primary = true` for the same `(organization_id, address_type)`; and
- only one active link can exist for the same `(organization_id, address_id, address_type)`.

Removed links are retained as immutable history and are excluded from active uniqueness. Re-adding the same canonical address and type creates a new active link instead of rewriting the removed record.

The migrations stop if existing data already contains competing active rows rather than selecting one silently.

## Privacy boundary

Person-address creation, reads, search, and sharing remain disabled.

A later ADR must define:

- Self-service versus administrative authority.
- Organization visibility into personal addresses.
- Consent and purpose limitation.
- Emergency and safeguarding exceptions.
- Verification evidence.
- Retention and deletion rules.
- Audit requirements.

Membership in an Organization is not automatic permission to view a Person's address.

## Deferred capabilities

- Public HTTP endpoints.
- Address updates or non-destructive removal. This slice only handles pre-existing removed links safely during a later create request.
- Address verification and evidence.
- Geocoding and map-provider integration.
- Delivery-zone validation.
- Person addresses.
- Emergency contacts and alternate recipients.
- Tenant-level addresses without an Organization owner.

## Consequences

Positive:

- Organizations gain reusable operational location data.
- Tenant isolation is enforced through trusted Organization ownership.
- Equivalent global addresses can be reused without duplicating location records.
- Primary-address races and duplicate active links are controlled in PostgreSQL.
- Removed link history no longer blocks a later active assignment of the same canonical address and type.
- Personal privacy remains protected until policy exists.

Cost:

- Canonical equivalence remains conservative and is not a postal-standardization engine.
- Address lifecycle operations require later work.
- The partial unique index is migration-owned because Prisma does not represent it directly.
