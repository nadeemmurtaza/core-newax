# ADR 0025: Build the Organization Contacts Registry Foundation

## 1. Decision Title

Build the first organization-scoped Contacts Registry service foundation.

## 2. Status

Accepted

## 3. Date

2026-07-12

## 4. Context

The Central Registry schema already contains shared contact methods and separate links for people and organizations. No reusable Contacts package currently owns those contracts or safely exposes the existing persistence model.

Contact data is operationally useful but privacy-sensitive. Organization contact ownership is clear because trusted organization context supplies the tenant boundary. Person-contact visibility is not yet clear because the current global person-contact link does not record which organization may view or manage that contact.

## 5. Problem

NEWAX Core needs a reusable foundation for organization email and phone contacts without:

- duplicating contact values in Organizations or business domains;
- accepting organization authority from arbitrary callers;
- exposing person contacts across organizations;
- logging sensitive values;
- creating a second schema beside the existing Central Registry tables;
- allowing duplicate normalized methods or multiple active primaries of the same type.

## 6. Decision

NEWAX Core will create the `@newax/contacts` foundation package and a Prisma application adapter.

The first slice will implement:

```text
addCurrentOrganizationContact
listCurrentOrganizationContacts
```

The service will:

- derive organization identity from trusted service context;
- require `contacts.create` for creation;
- require `contacts.view` for reads;
- support email and phone contact types;
- normalize emails canonically and phones to E.164;
- reuse one global contact-method row for the same type and normalized value;
- never project global contact-method verification onto an organization-specific link;
- create organization-specific link records;
- reject duplicate active assignment inside one organization;
- keep at most one active primary contact per type for an organization, including concurrent creation;
- paginate reads and reject cursors outside the trusted organization boundary;
- recheck that the organization remains active and non-deleted;
- fail closed on repository tenant-boundary or persisted-data inconsistencies;
- emit `contact.created` without contact values;
- expose no public HTTP endpoint.

## 7. Reasoning

Organization contacts have a clear tenant boundary and can be implemented without inventing a person-contact sharing policy.

Starting with create and read operations delivers a useful, auditable foundation while leaving update, removal, and verification rules for separate decisions. This avoids defining destructive lifecycle behavior or verification ownership merely because columns happen to exist.

The existing schema already separates globally normalized contact methods from organization links. Reusing it preserves one source of truth and avoids migration risk.

Verification cannot safely be reused in the same way. A global contact method may have been verified for another Person or Organization relationship. Until NEWAX defines relationship-specific ownership, evidence, expiry, and audit rules, organization-scoped results must report `isVerified = false` and `verifiedAt = null`.

## 8. Alternatives Considered

### Implement person and organization contacts together

Rejected for this slice. The schema does not encode which organization may see a globally linked person's contacts. Treating membership as automatic access would invent a privacy rule.

### Store contact fields directly on organizations

Rejected. It would duplicate shared contact data and weaken the Central Registry design.

### Add new contact tables

Rejected. The required tables already exist.

### Add update, removal, and verification now

Deferred. Each requires lifecycle, audit, evidence, and ownership rules not yet approved.

### Expose HTTP endpoints immediately

Rejected. The package and persistence foundation should be verified before transport contracts are introduced.

## 9. Consequences

### Positive

- Organization contacts gain a reusable service and repository boundary.
- Tenant authority remains server-derived.
- Email and phone data are normalized consistently.
- Concurrent duplicate creation and primary assignment are serialized.
- Contact values remain out of events and logs.
- No migration or parallel source of truth is introduced.
- Person-contact privacy remains protected by omission rather than guessed policy.

### Negative

- Person contacts remain inaccessible through the module.
- Update, removal, verification, and HTTP workflows require later slices.
- Phone input must already contain an international country code.
- Global contact-method verification remains unused until ownership is defined.

## 10. Impact On NEWAX Core

- Adds the `@newax/contacts` foundation package.
- Adds a NestJS Contacts module and Prisma repository adapter.
- Adds `@newax/contacts` to the API workspace dependency and foundation build sequence.
- Activates the existing Contacts registry entry as draft implementation.
- Corrects database ownership to the three existing contact tables.
- Adds no Prisma schema change or migration.

## 11. Impact On Client Systems

Future client systems can reuse organization contact channels without storing duplicate email and phone fields in every domain.

No client-facing API is created by this decision.

## 12. Security Considerations

- All operations require explicit permission checks inside the package.
- Organization identity is taken from trusted context, not operation input.
- Repository results are checked against the trusted organization boundary.
- Contact values and normalized values are excluded from event and logging payloads.
- Person-contact access is deferred until a visibility policy exists.
- Verification is deferred until evidence ownership and audit requirements are defined.
- Global contact-method verification is never exposed as organization verification; the service fails closed if an adapter attempts to return it.

## 13. Scalability Considerations

- Reads are paginated.
- Global contact-method uniqueness is supported by the existing database constraint.
- Competing method creation and organization/type primary assignment use transaction-scoped PostgreSQL advisory locks.
- Organization links remain independently queryable and indexed.

## 14. Maintenance Considerations

Email and phone normalization remain inside the Contacts package so business domains do not invent competing rules.

Future contact types require explicit normalization, validation, privacy, and compatibility review.

## 15. Related Documents

- ADR 0002: Use Permission-Based Access Control.
- ADR 0003: Design for Multi-Tenancy.
- ADR 0008: Use Central Identity and Organization Registry.
- ADR 0012: Implement Central Registry Data Foundation.
- ADR 0018: Build Trusted Request Context Foundation.
- NEWAX Central Identity and Organization Registry Architecture.
- NEWAX Contacts module README.

## 16. Approved By

- NEWAX Leadership.
- NEWAX Engineering.
- NEWAX Architecture.
- NEWAX Security.
