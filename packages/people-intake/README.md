# NEWAX People Intake Module

## Status

Draft reusable foundation module.

Version: `0.1.0`

## Purpose

People Intake provides controlled staging and independent verification for proposed people, official identifiers, and person-to-person relationships before any information is applied to the canonical People Registry.

The first dashboard experience supports family data. The module remains reusable for future employee, student, patient, customer, and other identity-intake workflows.

## Ownership boundary

People Intake owns:

- Intake workflow identity and Organization scope.
- Versioned draft payloads.
- Draft creator and timestamps.
- Submission state.
- Independent approval or rejection evidence.
- Review notes and optimistic version.

People Intake does not own canonical people, identifiers, relationships, files, memberships, users, or audit records.

Database ownership:

```text
core_people_intakes
```

## Workflow

```text
draft -> submitted -> approved
                  -> rejected
```

Rules:

- Only the creator may edit or submit a draft.
- Submitted content is immutable.
- The creator cannot approve or reject the same submission.
- Rejection requires nonblank reviewer notes.
- Every update increments the optimistic version exactly once.
- Approval verifies the intake record only. It does not create canonical People Registry records.

## Payload

A version-1 payload contains:

- 1 to 50 proposed people.
- Up to 8 identifiers per proposed person.
- Up to 100 proposed relationships.
- Stable client keys linking relationships to proposed people.
- Name, optional date-of-birth, gender, identifier, and relationship fields.

Validation rejects duplicate client keys, repeated normalized official identifiers, unknown relationship endpoints, self-links, duplicate relationships, future or invalid dates, and parentage cycles.

## Permissions

```text
people_intake.view
people_intake.create
people_intake.update
people_intake.submit
people_intake.review
```

The HTTP boundary and service layer both enforce the relevant permission.

## Public service operations

```text
createDraft
get
list
updateDraft
submit
review
```

## Security and privacy

- Every intake is bound to one Tenant and one Organization by a composite foreign key.
- List responses exclude the payload and therefore do not expose identifier values.
- Detail responses require `people_intake.view` and use `Cache-Control: no-store`.
- Mutations require trusted Organization context and CSRF protection through the shared HTTP boundary.
- No real client data may be committed as fixtures, examples, or seeds.

## Dependencies

- Tenants
- Organizations
- People
- Users
- Request Context
- HTTP Security
- Audit

## Events

No durable module events are published in version `0.1.0`. Event publication remains deferred until the shared transactional outbox capability is approved.

## Testing

Tests cover permissions, normalization, duplicate identifiers, parent cycles, schema ownership, migration state constraints, four-eye review, immutable submitted content, migration deployment, API input boundaries, type-checking, and production builds.

## Known limitations

- Approved intake application to canonical People Registry tables is not included.
- Evidence-file attachment is not included.
- Duplicate matching against existing canonical people is not included.
- Field-level reviewer comments are not included.
- The first UI is an internal operational dashboard, not a public self-service form.
