# NEWAX Addresses Module

## Status

Draft reusable foundation module. Version `0.1.0`.

## Purpose

The Addresses module maintains reusable canonical location records and permission-controlled Organization links inside the NEWAX Central Registry.

The first approved capability is deliberately limited to Organization addresses. It supports operational locations such as registered offices, branches, campuses, facilities, billing addresses, shipping addresses, and mailing addresses.

Person-address operations remain disabled until NEWAX approves explicit privacy, consent, visibility, retention, and safeguarding rules.

## Database ownership

- `core_addresses`
- `core_person_addresses`
- `core_organization_addresses`

The module owns all three registry tables, but this version exposes operations only for `core_addresses` and `core_organization_addresses`. Ownership of a table does not grant permission to expose every record in it, a distinction database diagrams tend to omit while looking very confident.

## Initial operations

- Add an address to the current trusted Organization.
- List addresses for the current trusted Organization with bounded pagination.

## Permissions

- `addresses.view`
- `addresses.create`

## Address types

- `registered`
- `office`
- `billing`
- `shipping`
- `mailing`
- `campus`
- `facility`
- `other`

## Tenant and privacy boundary

- Tenant and Organization IDs come only from trusted request context.
- The repository revalidates the active, non-deleted Tenant and Organization.
- Global canonical addresses can be reused, but reads always begin from an Organization-owned link.
- Cursors cannot cross Tenant or Organization boundaries.
- At most one active primary address is allowed for each Organization and address type.
- At most one active link is allowed for the same Organization, canonical address, and address type.
- Removed links remain history and do not block creating a later active link for the same canonical address and type.
- Events and structured logs contain IDs and address classification only. They do not contain street lines, city, region, postal code, or country code.
- Organization membership is not automatic authority to view a Person's address.

## Deferred

- Public HTTP endpoints.
- Person-address creation or reads.
- Address update and non-destructive removal.
- Address verification evidence.
- Postal validation, geocoding, maps, and delivery-zone services.
- Tenant-level addresses without an Organization owner.
