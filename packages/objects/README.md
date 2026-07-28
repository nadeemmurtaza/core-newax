# NEWAX Objects Registry

## Purpose

The Objects Registry identifies individually trackable non-human entities used across NEWAX business domains.

Examples include vehicles, rooms, buildings, devices, sensors, machines, equipment, property units, book copies, and other operational assets.

The central Object record identifies the thing. Domain modules own specialized details such as vehicle specifications, sensor telemetry definitions, room attributes, or medical-device characteristics.

## Public service operations

- `registerObjectType`
- `addCurrentOrganizationObject`
- `listCurrentOrganizationObjects`

## HTTP application boundary

The API application exposes:

```text
GET  /api/core/organizations/current/objects
POST /api/core/organizations/current/objects
```

Both endpoints require trusted Organization context, enforce `objects.view` or `objects.create`, reject client-supplied Tenant and Organization authority, and return minimized `no-store` responses. Global Object Type registration is not exposed through this Organization-scoped HTTP contract.

## Ownership

This initial foundation owns:

- `core_object_types`
- `core_objects`

The following existing tables remain deliberately inactive until separate rules are approved:

- `core_object_assignments`
- `core_object_addresses`

## Tenant boundary

Every Object has an immutable `tenant_id` and one owning Organization inside that Tenant.

Parent Objects may belong to another Organization only when both Objects remain inside the same Tenant. Cross-Tenant hierarchy is rejected by both the service boundary and PostgreSQL composite foreign keys.

Clients never supply Tenant or Organization authority through the Object input. Those values come from trusted request context.

## Permissions

- `objects.types.manage` registers global Object Types.
- `objects.create` creates Objects for the trusted current Organization.
- `objects.view` lists active Objects for the trusted current Organization.

Role names are not authorization rules.

## Object Type rules

Object Types are global reusable definitions identified by stable lowercase codes.

Examples might include `vehicle`, `building`, `room`, `sensor`, or a domain-qualified code such as `healthcare.medical_device`.

This module does not seed business-specific Object Types. Deployments register only the types they actually need.

## Events

- `object.type_registered`
- `object.created`

Events contain identifiers and type metadata only. They exclude Object names, reference codes, serial numbers, and descriptions.

## Validation

The service normalizes Unicode text, bounds field lengths, validates UUIDs, validates stable codes, and normalizes Organization reference codes to uppercase.

The repository revalidates active Tenant and Organization state, active Object Type state, parent Tenant ownership, cursor ownership, and reference-code conflicts.

## Dependencies

- Tenants
- Organizations

Application composition also uses the existing Database module.

## Deliberately deferred

- Assignment to people or memberships.
- Location and address linkage.
- Transfers between Organizations.
- Status transition policy.
- Update, retirement, archive, restore, and deletion operations.
- Search beyond bounded current-Organization listing.
- Domain-specific attributes.

Those capabilities require separate business rules rather than speculative generic fields.

## Client customization

Client-specific attributes must live in domain extension tables or client extension modules. They must not be added directly to `core_objects` unless they are valid for every supported NEWAX deployment.

## Code necessity and simplicity

This package uses TypeScript, NestJS composition, Prisma, and PostgreSQL capabilities already present in the repository.

No new dependency, validation framework, identifier library, event framework, or generic utility package is introduced. Small validation functions remain private to the module because extracting them before a stable shared contract would create abstraction without proven reuse.
