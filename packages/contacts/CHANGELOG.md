# Changelog

All notable changes to the NEWAX Contacts module are documented here.

## 0.1.0 - 2026-07-12

### Added

- Reusable Contacts service, repository, permission, event, error, and data contracts.
- Organization-scoped email and phone contact creation.
- Paginated current-organization contact reads.
- Canonical email and E.164 phone normalization.
- Global shared contact-method reuse with organization-specific links.
- Primary-contact replacement by contact type with concurrency-safe organization/type locking.
- Organization-bound cursor validation for paginated reads.
- Sensitive-value-free `contact.created` events.
- Prisma application adapter and NestJS module composition.
- Unit and PostgreSQL integration tests.

### Security

- Organization identity comes only from trusted service context.
- `contacts.create` and `contacts.view` are checked inside the package.
- Cross-organization repository results fail closed.
- Contact values are excluded from event and logging payloads.
- Person-contact access remains disabled until a visibility policy is approved.
- Global contact-method verification is not inherited by Organization links; Organization-scoped results remain unverified until relationship-specific ownership and evidence rules are approved.

### Database

- Uses the existing `core_contact_methods` and `core_organization_contact_methods` tables.
- Declares Contacts ownership of the existing `core_person_contact_methods` table while deferring person-contact operations.
- Adds no schema change or migration.
