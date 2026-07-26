# NEWAX Contacts Module

## Status

Draft reusable foundation module.

Version: `0.1.0`

## Purpose

The Contacts module maintains reusable communication channels without placing contact data inside People, Organizations, or business-domain records.

This first controlled slice supports organization-scoped email and phone contacts. It deliberately does not expose person contacts until NEWAX defines which organization may view or manage a globally linked person's contact methods.

## Owned data

The module owns the existing Central Registry tables:

- `core_contact_methods`
- `core_person_contact_methods`
- `core_organization_contact_methods`

No schema or migration is introduced by this slice.

## Public package API

The package exports:

- `ContactsService`
- `ContactsRepository`
- Contact request, response, persistence, pagination, and event contracts
- `CONTACT_PERMISSIONS`
- `ContactsModuleError`

Implemented operations:

```text
addCurrentOrganizationContact
listCurrentOrganizationContacts
```

## Tenancy and authorization

Every implemented operation requires a trusted organization identifier and actor user identifier supplied through `ContactsRequestContext`.

The service never accepts a separate organization identifier for these current-organization operations.

Permissions:

```text
contacts.create
contacts.view
```

The stable permission namespace also reserves `contacts.update` and `contacts.remove`, but no update or removal operation is implemented in this slice.

## Contact types and normalization

The initial supported contact types are:

```text
email
phone
```

Email addresses are trimmed, lowercased, validated, and stored canonically.

Phone numbers are normalized to international E.164 form. Local numbers without a country code are rejected because silently guessing a country is not infrastructure; it is optimism wearing a database badge.

The shared contact method table enforces uniqueness through contact type and normalized value. The Prisma adapter serializes competing creation requests with PostgreSQL transaction-scoped advisory locks. Primary assignment also uses an organization-and-type lock so concurrent creation of different primary values cannot leave multiple primaries.

## Primary contact rule

When a new contact is marked primary, the adapter clears the current primary flag for other active contacts of the same type inside the same organization transaction.

An organization may therefore have one active primary email and one active primary phone under the module contract.

## Privacy and event data

Contact values are sensitive operational data.

The `contact.created` event contains only actor, organization, contact identifiers, contact type, and occurrence time. It does not include the contact value or normalized value.

No public HTTP endpoint is included.

Global contact-method verification is relationship-specific evidence, not proof that every Organization reusing the canonical method has verified it. Organization-scoped records therefore remain `isVerified: false` with `verifiedAt: null`; the service fails closed if a repository attempts to project global verification into this boundary.

## Deferred decisions

- Person-contact visibility and organization access rules
- Contact update and non-destructive removal lifecycle
- Verification ownership and evidence
- Self-service contact management
- Emergency-contact relationship modeling
- Addresses, which remain a separate foundation
- Public HTTP contracts
- Durable audit and outbox delivery

## Testing

Unit tests cover normalization, authorization, pagination, foreign-cursor rejection, duplicate handling, organization availability, tenant-boundary integrity, persisted-data integrity, and sensitive event minimization.

The API adapter includes PostgreSQL integration coverage for global method reuse without verification leakage, duplicate prevention, concurrent primary assignment, primary-contact replacement, foreign-cursor rejection, and organization-scoped reads.
