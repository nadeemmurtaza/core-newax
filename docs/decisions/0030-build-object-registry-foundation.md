# ADR 0030: Build the Object Registry Foundation

## Status

Accepted

## Date

2026-07-13

## Context

NEWAX Core already contains tables for Object Types, Objects, assignments, and locations, but table existence does not establish a reusable module or a safe Tenant boundary.

Objects represent individually identifiable non-human entities such as vehicles, devices, buildings, rooms, equipment, machines, sensors, property units, and book copies. Domain modules describe specialized characteristics while the central Object Registry preserves stable identity, ownership, hierarchy, and reference codes.

The existing Object hierarchy used only `parent_object_id`. After Tenant and Organization separation, that relationship could not prove in PostgreSQL that parent and child belonged to the same customer Tenant.

## Decision

NEWAX will activate a reusable `@newax/objects` foundation module with three initial operations:

- Register a global reusable Object Type through `objects.types.manage`.
- Create an Object for the trusted current Organization through `objects.create`.
- List active Objects for the trusted current Organization through `objects.view`.

Each Object receives an immutable `tenant_id` in addition to `owning_organization_id`.

PostgreSQL composite foreign keys enforce:

- The owning Organization belongs to the Object Tenant.
- A parent Object belongs to the same Tenant as its child.
- An Object cannot silently cross the customer isolation boundary.

Object Types remain global reusable definitions. Object instances remain Tenant-owned and Organization-operated.

## Boundaries

The module owns:

- `core_object_types`
- `core_objects`

This decision does not activate:

- Object assignments to memberships.
- Object addresses or locations.
- Ownership transfer between Organizations.
- Update, retirement, archival, restoration, or deletion workflows.
- Object identifiers beyond the existing Organization reference code and serial number.
- Domain-specific Object attributes.
- HTTP endpoints.

Those capabilities require separately approved lifecycle and authority rules.

## Data migration

Existing Objects inherit `tenant_id` from their owning Organization.

The migration stops when:

- An Object has no valid owning Organization.
- An existing parent-child relationship crosses Tenant boundaries.

After backfill, `tenant_id` becomes required and database-enforced composite relationships replace the earlier global hierarchy relationships.

No Object, Object Type, assignment, address, Organization, or Tenant record is deleted.

## Security and privacy

- Tenant and Organization identity comes from trusted context, never Object input.
- Global Object Type registration requires explicit platform authority.
- Current-Organization Object creation and reads require explicit permissions at the package boundary.
- Pagination cursors must belong to the current Tenant and Organization.
- Object event and structured-log metadata exclude name, reference code, serial number, and description.
- Domain modules must reference `object_id` instead of duplicating central Object identity.

## Code necessity and simplicity

- Existing Prisma tables are reused rather than replaced.
- PostgreSQL foreign keys provide isolation instead of duplicated application-only checks.
- Prisma transactions and the existing NestJS composition pattern are reused.
- JavaScript and TypeScript built-ins provide normalization and validation.
- No new runtime or development dependency is introduced.
- Assignments, locations, lifecycle operations, HTTP contracts, and domain extensions are excluded because they are not required for the initial reusable identity foundation.

## Consequences

Positive:

- Vehicles, devices, facilities, equipment, and other non-human entities receive one reusable central identity.
- Tenant ownership and same-Tenant hierarchy are enforced in PostgreSQL.
- Domain modules can extend Objects without duplicating identity.
- The first API remains intentionally small and independently testable.

Cost:

- Objects now carry a direct Tenant key as well as an owning Organization key.
- Existing Object rows require a controlled backfill.
- Assignment, location, transfer, and retirement workflows remain unavailable until their policies are approved.

## Related decisions

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use the Central Identity and Organization Registry.
- ADR 0012: Implement the Central Registry Data Foundation.
- ADR 0027: Separate Tenant Ownership from Organizations.

## Approval

This decision is accepted as the baseline for Tenant-safe Object identity and current-Organization Object creation and listing in NEWAX Core.
