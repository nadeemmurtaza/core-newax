# ADR 0027: Stage Certificate Imports and Link Evidence Files

- Status: Accepted
- Date: 2026-07-16
- Decision owners: NEWAX Core Architecture
- Depends on: ADR 0025, ADR 0026, and PR #47

## Context

Family data may arrive from certificates such as CRCs, family registration certificates, birth certificates, marriage certificates, court orders, or guardianship documents. The People Intake workflow can stage structured family data, while the File Metadata Registry can identify a binary object that a trusted storage component has already stored. The platform still needs a governed way to attach evidence to an intake, stage extracted certificate data, review the extraction independently, and deliberately apply an accepted extraction to an editable intake draft.

Storing document bytes inside People Intake would duplicate the File capability. Copying extracted data directly into canonical People records would bypass the existing intake and independent review controls. Treating an OCR result as verified truth would also confuse machine confidence with evidence, a recurring human achievement now available to software.

## Decision

NEWAX adds evidence and certificate-import records owned by the People Intake module.

### Evidence attachment

An evidence record:

- belongs to one Tenant and Organization;
- links one People Intake record to one active `CoreFile` in the same Tenant and Organization;
- classifies the document type and evidence role;
- preserves who attached it and when;
- avoids copying storage provider, storage key, checksum, or binary bytes;
- can only be attached while the intake is an editable draft;
- becomes immutable after the intake is submitted.

Allowed evidence media types are initially PDF, PNG, and JPEG up to 25 MiB. File metadata size and status are checked before attachment. Actual upload, malware scanning, storage-provider integration, and signed download URLs remain responsibilities of the File and future Storage boundaries.

### Certificate import staging

A certificate import:

- belongs to one evidence attachment;
- stores a versioned structured extraction payload separately from the People Intake payload;
- records extractor identity or extractor code, extraction version, confidence basis points, and extraction time;
- moves through `pending`, `extracted`, `accepted`, or `rejected` states;
- requires a reviewer other than the extraction actor for acceptance or rejection;
- records review time, decision, and notes;
- protects extraction and review evidence from later mutation;
- uses optimistic versions for every transition;
- never creates canonical People or relationships directly.

An accepted extraction may be copied into the linked intake only through an explicit apply operation by the intake creator while that intake remains an editable draft. The normal People Intake validator and matching import and intake versions govern the resulting draft.

## Permissions

- `people_intake.evidence.view`
- `people_intake.evidence.attach`
- `people_intake.certificate_import.extract`
- `people_intake.certificate_import.review`
- `people_intake.certificate_import.apply`

Permissions are evaluated by code, never role name.

## Privacy and security

- Evidence summaries expose file name, media type, size, document type, and workflow status but never storage credentials or provider keys.
- Structured extraction payloads are sensitive and use `Cache-Control: no-store`.
- Tenant and Organization scope comes only from Trusted Request Context.
- No raw CNIC, CRC, passport, or certificate value is written to logs or events.
- No real certificate data is committed or seeded.

## Verification

Acceptance requires:

- unit tests for permissions, file eligibility, lifecycle, four-eye review, optimistic versions, and explicit apply behavior;
- live PostgreSQL tests for composite Tenant and Organization ownership, draft-only attachment, immutable submitted evidence, lifecycle consistency, reviewer separation, optimistic versions, and post-application immutability;
- HTTP input and route-metadata tests;
- complete repository formatting, lint, type-check, tests, builds, migrations, and database-registry generation against the exact final commit.

## Acceptance evidence

Exact-head workflow identifiers are stored in the Pull Request #48 completion record rather than this source-controlled ADR. This avoids changing the commit merely to describe the checks that verified it.

No temporary construction workflow or script, unresolved review thread, or known implementation issue may remain when the PR is marked ready.
