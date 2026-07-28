# Changelog

## 0.1.0 - 2026-07-16

### Added

- Tenant- and Organization-scoped People Intake drafts.
- Versioned proposed-person, identifier, and relationship payloads.
- Draft creation, editing, listing, reading, submission, approval, and rejection contracts.
- Independent-review protection that prevents creators from reviewing their own submissions.
- Strict payload validation, duplicate-identifier detection, and parentage-cycle detection.
- Explicit view, create, update, submit, and review permissions.
- PostgreSQL state, scope, review, immutability, and transition constraints.

### Security

- Draft intake records remain separate from canonical People Registry data.
- Submitted payloads become immutable.
- Rejected submissions require a nonblank reviewer note.
- No real client or family data is included in fixtures or seeds.
