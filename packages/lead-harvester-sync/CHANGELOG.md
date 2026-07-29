# Changelog

All notable changes to the NEWAX Lead Harvester Sync module are recorded here.

## 0.1.0 - 2026-07-29

### Added

- Added `LeadHarvesterSyncService.syncInstitutionUpserted`, orchestrating institution, branch,
  contact-point, and contact-person sync via `CoreExternalReference` mappings.
- Added namespaced external keys (`institution:`, `branch:`, `contact:`, `contact-person:`) under
  a dedicated `lead_harvester` external system and `marketing_leads` domain code.
- Added stale/out-of-order event rejection via a `lastSyncedOccurredAt` metadata marker.
- Added a lossy v1 person-name-splitting heuristic and a Harvester-contact-type-to-ContactType
  mapper that skips (not fails) unsupported contact types.

### Deferred

- Delivery durability (outbox/inbox), deletion/reconciliation, and cross-record person
  deduplication are tracked as follow-up work, not solved in this version.
