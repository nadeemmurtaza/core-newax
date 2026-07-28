# NEWAX People Intake Module

## Status

Draft reusable foundation module.

Version: `0.2.0`

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
- Links between intake drafts and existing File metadata.
- Structured certificate-import extraction, review, and application state.

People Intake does not own canonical people, identifiers, relationships, file bytes, storage credentials, memberships, users, or audit records.

Database ownership:

```text
core_people_intakes
core_people_intake_evidence
core_certificate_imports
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
people_intake.evidence.view
people_intake.evidence.attach
people_intake.certificate_import.extract
people_intake.certificate_import.review
people_intake.certificate_import.apply
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
attachEvidence
listEvidence
createImport
getImport
recordExtraction
reviewImport
applyImport
```

## Security and privacy

- Every intake, evidence attachment, and certificate import is bound to one Tenant and one Organization through composite database ownership.
- List responses exclude intake and extraction payloads unless the protected detail operation requires them.
- Detail responses use `Cache-Control: no-store`.
- Mutations require trusted Organization context and CSRF protection through the shared HTTP boundary.
- Evidence summaries never expose storage providers, storage keys, checksums, or binary bytes.
- No real client data may be committed as fixtures, examples, or seeds.

## Dependencies

- Tenants
- Organizations
- People
- Users
- Files
- Request Context
- HTTP Security
- Audit

## Events

No durable module events are published in version `0.2.0`. Event publication remains deferred until the shared transactional outbox capability is approved.

## Testing

Tests cover permissions, normalization, duplicate identifiers, parent cycles, schema ownership, migration state constraints, four-eye review, immutable submitted content, evidence scope, draft-only evidence attachment, certificate-import lifecycle, independent review, optimistic versions, explicit application, HTTP input boundaries, type-checking, and production builds.

Live PostgreSQL tests prove Tenant and Organization isolation, submitted-evidence immutability, lifecycle transition enforcement, reviewer separation, and version integrity against the real migration.

## Known limitations

- Approved intake application to canonical People Registry tables is not included.
- Duplicate matching against existing canonical people is not included.
- Field-level reviewer comments are not included.
- The first UI is an internal operational dashboard, not a public self-service form.
- File upload, malware scanning, storage-provider integration, signed file downloads, and automatic OCR remain separate File, Storage, and extraction-provider concerns.

## Evidence and certificate imports

Version 0.2.0 links an editable People Intake draft to active same-Organization File metadata and stages structured certificate extraction separately from the draft payload.

Evidence attachment supports PDF, PNG, and JPEG files up to 25 MiB. It references `core_files`; it does not upload bytes, expose storage keys, or duplicate checksums. Evidence can only be attached while the intake remains a draft and becomes immutable after submission.

A certificate import progresses through `pending`, `extracted`, `accepted`, or `rejected`. The extraction actor cannot review the same import. Rejection requires notes. An accepted extraction is copied into the draft only through an explicit apply operation by the intake creator with matching import and intake versions.
