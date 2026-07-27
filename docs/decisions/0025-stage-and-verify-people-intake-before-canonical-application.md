# ADR 0025: Stage And Verify People Intake Before Canonical Application

## Status

Proposed.

## Context

Family certificates and other identity documents may contain several people, official identifiers, and relationships. Writing extracted or manually entered values directly into canonical People Registry tables would make incomplete, mistyped, or unreviewed information operationally authoritative.

## Decision

NEWAX Core will stage proposed identity data in the People Intake module. A draft belongs to one Tenant and Organization context, contains a versioned payload, and follows `draft -> submitted -> approved | rejected`.

Submitted content is immutable. The creator cannot review the same submission. Approval records reviewer and time but does not create canonical people, identifiers, or relationships. Canonical application is a separate future transaction with its own duplicate detection and permissions.

## Consequences

- Data entry and verification can proceed without contaminating canonical identity records.
- Review queues can show non-sensitive summaries while detailed values remain permission-protected.
- Concurrent edits and decisions use optimistic versions plus transaction-scoped advisory locks.
- The dashboard must treat an approved intake as approved evidence, not as completed canonical import.
- A later application slice must map approved proposals to existing or new people in one audited transaction.
