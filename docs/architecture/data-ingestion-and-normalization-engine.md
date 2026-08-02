# Data Ingestion and Normalization Engine

## Status

- Lifecycle: Planned
- Layer: Core platform infrastructure
- Repository: `core-newax`
- Primary purpose: Accept source-native data from NEWAX systems and approved external integrations, preserve what was received, normalize it consistently, resolve entity identity, and write canonical records through governed Core services.

This document defines the target architecture. It does not claim that the complete engine is already implemented.

## Architectural decision

NEWAX Core owns the final formatting, normalization, identity resolution, merge policy, and canonical Registry write process.

Source systems must not write directly to Core database tables and must not be forced to understand Prisma models or every internal Registry field. Each source sends versioned source-native data through a common integration envelope. Core authenticates the source, preserves the raw submission, selects the correct adapter, normalizes the data, resolves identity, applies ownership rules, and invokes the approved Registry services.

```text
Source system
→ Standard integration envelope
→ Integration gateway
→ Durable inbound inbox
→ Immutable raw event store
→ Source schema registry
→ Source adapter
→ Normalization engine
→ Entity candidate builder
→ Identity resolution
→ Field-ownership and merge policy
→ Canonical write orchestrator
→ Central Registry services
→ Canonical identifiers and processing result
```

The Central Registry never accepts direct writes from an external source system.

## Product boundary

The engine is not a lead-only intake service.

An organization remains an organization whether it is a customer, supplier, regulator, partner, competitor, rejected lead, or not commercially relevant to NEWAX. A person remains a person whether or not that person is a sales contact. Commercial interpretation belongs after entity existence and identity.

```text
Raw Observation
→ Entity Candidate
→ Canonical Entity
→ Business Roles and Classifications
→ Lead / Customer / Supplier / Partner / Competitor / Other
```

Lead qualification must never determine whether an organization, person, location, contact method, domain, website, or relationship is allowed to exist in the Registry.

## Supported source classes

The common engine is designed to accept data from sources such as:

- NEWAX Harvester
- NEWAX Communicator
- CRM and commercial applications
- Website forms
- Authorized spreadsheet and file imports
- Partner APIs
- Enterprise software modules
- Connected Infrastructure and telemetry systems
- Future NEWAX products

Each source receives an adapter and a versioned source contract. The engine remains common.

## Common integration envelope

Every source submits the same outer envelope while retaining a source-specific `payload`.

```json
{
  "integration_version": 1,
  "event_id": "01915f26-f4d5-7d16-8f93-dfa3b42006dd",
  "event_type": "observation.recorded",
  "source_system": "newax_harvester",
  "source_connector": "google_places",
  "source_schema": "harvester.google_places.place.v1",
  "occurred_at": "2026-08-02T02:00:00.000Z",
  "received_at": "2026-08-02T02:00:03.000Z",
  "tenant_reference": "newax",
  "source_record_reference": "ChIJ123456789",
  "entity_reference": null,
  "subject_hint": "organization",
  "correlation_id": "harvest-job-id",
  "canonical_revision": null,
  "payload_checksum": "sha256-value",
  "payload": {}
}
```

Required envelope responsibilities:

- Stable event identity
- Source identity
- Source schema and version
- Event type
- Event and receipt timestamps
- Tenant routing reference
- Stable source-record reference where available
- Optional canonical source-entity reference
- Optional workflow correlation
- Optional canonical revision
- Payload checksum
- Source-native payload

The envelope is stable. The payload is source-specific.

## Two ingestion streams

The engine must process two independent streams.

### Raw observation stream

Raw observations preserve what a source actually reported before Core or the source system resolves final identity.

Examples:

```text
observation.recorded
```

With subject hints such as:

```text
organization
person
location
contact_method
domain
website
relationship
document
social_profile
unknown
```

A raw observation may be incomplete, duplicated across sources, unrelated to sales, or not yet attributable to one canonical entity. It is still valuable evidence when it satisfies source, privacy, retention, and integrity policy.

### Canonical entity stream

Canonical events represent a source system's resolved understanding after its own normalization, deduplication, validation, and identity process.

Examples:

```text
organization.canonical_created
organization.canonical_updated
organization.canonical_retired
person.canonical_created
person.canonical_updated
person.canonical_retired
location.canonical_created
location.canonical_updated
relationship.canonical_created
relationship.canonical_updated
relationship.canonical_retired
```

Canonical events should reference their supporting raw observation identifiers where available.

## Integration gateway

The gateway owns transport-level controls:

- Service-account or approved machine identity
- HMAC, OAuth client credentials, mTLS, or another approved authentication method
- Tenant resolution
- Request-size and rate limits
- Replay-window checks
- Content-type enforcement
- Envelope validation
- Payload checksum verification
- Schema identification
- Initial audit record
- Safe rejection of unknown or disabled sources

The gateway does not write directly to canonical Registry tables.

## Durable inbound inbox

Every event is persisted before business processing.

Suggested model:

```text
CoreInboundEvent
```

Suggested fields:

```text
id
event_id
source_system
source_connector
source_schema
event_type
tenant_id
source_record_reference
entity_reference
subject_hint
occurred_at
received_at
payload
payload_hash
processing_status
attempt_count
next_attempt_at
last_error
completed_at
created_at
```

Required idempotency behavior:

- Same `event_id` and same payload hash: return the previously recorded processing result.
- Same `event_id` and different payload hash: reject as an integrity conflict.
- New `event_id`: persist and process normally.

The inbox is required for safe at-least-once delivery from upstream systems.

## Immutable raw event store

Raw submissions remain immutable and source-attributed.

Corrections create new event versions. They do not rewrite historical evidence.

The raw store supports:

- Audit
- Replay
- Reprocessing after mapping upgrades
- Investigation
- Source accountability
- Provenance
- Data-quality review
- Retention and deletion workflows

Raw payload storage must follow data-classification, minimization, encryption, retention, and access-control rules. Preserving evidence is not permission to collect or retain unrestricted personal information forever. Humanity has tried that approach; regulators noticed.

## Source schema registry

Suggested model:

```text
CoreSourceSchema
```

Each registered source contract defines:

- Source system
- Connector or producer
- Schema name
- Schema version
- Supported event types
- Required source fields
- Payload validator
- Active adapter version
- Compatibility state
- Activation date
- Deprecation date
- Retention class
- Data classification

Unknown, disabled, or incompatible schemas enter quarantine rather than being interpreted heuristically.

## Source adapters

Each producer uses a versioned adapter, for example:

```text
HarvesterObservationAdapter
HarvesterCanonicalEntityAdapter
CommunicatorAdapter
WebsiteFormAdapter
AuthorizedImportAdapter
PartnerApiAdapter
```

Adapters:

- Validate the source payload contract
- Map source field names into an intermediate candidate model
- Preserve source identifiers and provenance
- Perform source-specific enumeration mapping
- Report unsupported values explicitly
- Never call Prisma repositories directly
- Never contain source-independent canonical merge policy

The open Lead Harvester integration work may serve as the first adapter, but the long-term architecture must route it through this common engine rather than retaining a permanent source-specific path directly into Registry services.

## Intermediate candidate model

Core requires stable transport-independent models between source adapters and final Registry services.

Suggested candidate types:

```text
NormalizedOrganizationCandidate
NormalizedPersonCandidate
NormalizedLocationCandidate
NormalizedContactMethodCandidate
NormalizedRelationshipCandidate
NormalizedDomainCandidate
NormalizedWebsiteCandidate
```

A candidate stores:

- Source and event references
- Normalized fields
- Original values
- Provenance
- Confidence
- Validation results
- Candidate relationships
- Proposed canonical classification
- Mapping version

Candidate models are independent from source payloads and Prisma table structure.

## Normalization engine

The common engine owns reusable normalization.

### Names

- Unicode normalization
- Whitespace cleanup
- Case preservation
- Legal-suffix extraction where supported
- Alternate-name preservation
- Display-name candidates

### Domains and websites

- Lowercase host normalization
- Canonical URL
- Tracking-parameter removal where safe
- Root-domain extraction
- Internationalized-domain handling
- Scheme and redirect verification

### Telephone numbers

- E.164 normalization
- Country-context handling
- Extension separation
- Separate phone and WhatsApp capabilities

### Email addresses

- Whitespace cleanup
- Syntax validation
- Domain normalization
- Personal versus generic mailbox classification
- Careful preservation of the local part

### Addresses and locations

- Raw address retention
- Structured components
- ISO country code
- Region mapping
- Postal-code formatting
- Coordinates and geocoding provenance

### Dates and times

- ISO 8601 validation
- UTC storage
- Original timezone preservation where material

### Organization classification

```text
Source category
→ Normalized classification candidate
→ Approved Registry organization type
```

Mappings are versioned and reviewable.

## Mapping engine

Suggested model:

```text
CoreMappingVersion
CoreMappingRule
```

Supported rule types include:

- Direct field mapping
- Rename
- Constant
- Conditional mapping
- Enumeration mapping
- Split
- Combine
- Lookup
- Normalize
- Ignore
- Preserve as metadata
- Require review

Used mapping versions remain immutable. A change creates a new mapping version and supports explicit reprocessing.

## Validation engine

Validation occurs before canonical mutation.

Outcomes:

```text
READY
READY_WITH_WARNINGS
NEEDS_REVIEW
REJECTED
QUARANTINED
```

Validation covers:

- Required fields
- Source-schema compliance
- Taxonomy compatibility
- Country and location formatting
- Contact formatting
- URL validity
- Unsupported source values
- Tenant restrictions
- Data classification
- Suspicious payloads
- Missing identity evidence
- Relationship integrity

Every failure or warning is structured and attributable to a field, rule, adapter, and mapping version.

## Entity candidate layer

Raw observations may remain unresolved.

Suggested models:

```text
CoreEntityCandidate
CoreCandidateOrganization
CoreCandidatePerson
CoreCandidateLocation
CoreCandidateRelationship
```

Candidate states:

```text
UNRESOLVED
POSSIBLE_MATCH
LINKED
CANONICALIZED
QUARANTINED
IGNORED
```

`IGNORED` means invalid, prohibited, duplicate evidence, or outside the approved data policy. It must not mean merely `NOT_A_LEAD`.

## Identity resolution

Resolution signals may include:

- Existing external reference
- Legal registration number
- Tax identifier
- Domain
- Website
- Phone
- Email domain
- Address
- Coordinates
- Name similarity
- Parent-child relationship
- Source-provided canonical identifier

Strong deterministic identifiers take priority. Fuzzy matching creates a possible match or review task unless an approved policy permits automatic linking.

The primary durable link is:

```text
source_system + source_entity_reference
→ CoreExternalReference
→ Core canonical entity
```

## Provenance graph

Core must preserve a traceable path:

```text
Canonical Core entity
→ Core external reference or candidate link
→ Source canonical entity where supplied
→ Raw inbound observation
→ Source system and source record
```

Canonical facts must identify their supporting observations, mapping version, adapter version, confidence, and last verification time where applicable.

## Field ownership and merge policy

Core applies field-level ownership rather than replacing complete entities blindly.

Suggested incoming actions:

```text
CREATE
POPULATE_EMPTY
REFRESH_SOURCE_OWNED
PROPOSE_CHANGE
IGNORE
REQUIRE_REVIEW
FORCE_REPLACE
```

`FORCE_REPLACE` is disabled by default and requires explicit permission and audit.

Examples:

| Field           | Typical source authority |                   Core authority |
| --------------- | -----------------------: | -------------------------------: |
| Public website  |                     High |        Manual override protected |
| Observed domain |                     High |        Manual override protected |
| Legal name      | Candidate until verified | Authoritative after verification |
| Public phone    |                     High |      Manual correction protected |
| Account owner   |                     None |                        Exclusive |
| Sales stage     |                     None |                        Exclusive |
| Internal notes  |                     None |                        Exclusive |
| Contract status |                     None |                        Exclusive |

Incoming evidence may enrich Core without erasing trusted business context.

## Canonical write orchestrator

Only the common orchestrator may invoke approved domain services, including:

```text
OrganizationsService
PeopleService
AddressesService
ContactsService
MembershipsService
ExternalReferencesService
AuditService
```

The orchestrator owns:

- Transaction boundary
- Permission and tenant context
- Identity-resolution result
- Field-level merge decision
- External-reference registration
- Provenance links
- Audit event
- Domain event
- Final response

Adapters do not call repositories or Prisma directly.

## Processing lifecycle

```text
RECEIVED
AUTHENTICATED
SCHEMA_VALIDATED
MAPPING
NORMALIZED
VALIDATING
IDENTITY_RESOLUTION
NEEDS_REVIEW
READY_TO_APPLY
APPLYING
APPLIED
APPLIED_WITH_WARNINGS
REJECTED
FAILED
DEAD_LETTER
```

All nonterminal work remains observable and recoverable.

## Ordering and revisions

Canonical source events should carry an aggregate reference and revision.

Core records the latest applied revision per source entity.

- Older revision: return stale or superseded.
- Same revision and same hash: return the recorded result idempotently.
- Same revision and different hash: reject as an integrity conflict.
- Newer revision: evaluate normally.

A full-state source projection may permit Core to accept the latest revision despite an intermediate gap, but the gap remains recorded for reconciliation.

## Integration administration page

Planned route:

```text
/integrations/data-ingestion
```

Suggested navigation:

```text
Infrastructure
└── Data Ingestion
```

Tabs:

```text
Sources
Schemas
Mappings
Inbound Events
Raw Observations
Entity Candidates
Validation
Identity Reviews
Conflicts
Dead Letter
Reprocessing
Audit
```

The page shows what Core received from every integration, how it was mapped, what candidate was produced, how identity was resolved, what merge actions were selected, and which canonical records resulted.

## Permissions

Suggested permissions:

```text
data_ingestion.read
data_ingestion.read_raw
data_ingestion.manage_sources
data_ingestion.manage_schemas
data_ingestion.manage_mappings
data_ingestion.review_candidates
data_ingestion.resolve_identity
data_ingestion.resolve_conflicts
data_ingestion.reprocess
data_ingestion.manage_dead_letter
data_ingestion.view_audit
```

Raw payload access requires a stronger permission than metadata access.

Production source activation, mapping activation, bulk reprocessing, identity merge, and dead-letter replay require reauthentication and may require separate approval.

## Planned APIs

```http
POST   /api/v1/integrations/events
GET    /api/v1/data-ingestion/overview
GET    /api/v1/data-ingestion/sources
POST   /api/v1/data-ingestion/sources
POST   /api/v1/data-ingestion/sources/{source_id}/validate
POST   /api/v1/data-ingestion/sources/{source_id}/enable
POST   /api/v1/data-ingestion/sources/{source_id}/disable

GET    /api/v1/data-ingestion/schemas
POST   /api/v1/data-ingestion/schemas
POST   /api/v1/data-ingestion/schemas/{schema_id}/activate
POST   /api/v1/data-ingestion/schemas/{schema_id}/deprecate

GET    /api/v1/data-ingestion/mappings
POST   /api/v1/data-ingestion/mappings/versions
POST   /api/v1/data-ingestion/mappings/{mapping_version_id}/test
POST   /api/v1/data-ingestion/mappings/{mapping_version_id}/activate

GET    /api/v1/data-ingestion/events
GET    /api/v1/data-ingestion/events/{event_id}
POST   /api/v1/data-ingestion/events/{event_id}/reprocess

GET    /api/v1/data-ingestion/candidates
GET    /api/v1/data-ingestion/candidates/{candidate_id}
POST   /api/v1/data-ingestion/candidates/{candidate_id}/resolve

GET    /api/v1/data-ingestion/conflicts
POST   /api/v1/data-ingestion/conflicts/{conflict_id}/resolve

GET    /api/v1/data-ingestion/dead-letter
POST   /api/v1/data-ingestion/dead-letter/{event_id}/requeue
```

These are planned interfaces, not claims about current endpoints.

## Harvester integration

Harvester publishes two independently controlled streams.

### Raw observations

Every accepted `RawSourceRecord`, page snapshot, or other approved source observation is published immediately after durable local storage through Harvester's transactional outbox.

The event is source-native and may describe an organization, person, location, contact method, domain, website, relationship, document, social profile, or unknown subject.

### Canonical entities

Every new or materially changed Harvester canonical entity is published after Harvester completes its own resolution and validation. Canonical events include the Harvester entity reference, canonical revision, payload checksum, and supporting observation identifiers.

Lead qualification is not a prerequisite for either stream.

### Current source-specific integration

Open Core PR #1627 proposes a signed `institution.upserted` Harvester webhook and service-account identity. That work is a pending source-specific integration, not the complete general engine. Its useful service-account, HMAC, external-reference, and orchestration patterns should be retained where appropriate, while its Harvester-specific mapping is moved behind the common intake, schema, adapter, normalization, inbox, and merge-policy layers.

Automatic production delivery must not be considered complete until Core has durable `event_id` inbox replay protection and a safe transaction or resumable-workflow boundary for canonical application.

## Delivery sequence

### Phase A: intake foundation

- Integration envelope contract
- Service-account identity and permissions
- Durable inbound inbox
- Payload hashing and replay protection
- Raw-event storage
- Source registration

### Phase B: schema and adapter framework

- Source schema registry
- Adapter interface
- Harvester raw-observation adapter
- Harvester canonical-entity adapter
- Structured validation results

### Phase C: normalization and candidates

- Common normalization services
- Mapping versions
- Candidate models
- Provenance graph
- Candidate administration APIs

### Phase D: identity and merge policy

- Deterministic identity signals
- Possible-match review
- External-reference linking
- Field ownership
- Conflict workflow
- Canonical write orchestrator

### Phase E: operations and frontend

- Data Ingestion page
- Source and schema administration
- Mapping testing and activation
- Inbound event explorer
- Candidate and conflict reviews
- Dead-letter and reprocessing controls
- Audit and metrics

### Phase F: source expansion

- Communicator adapter
- Website form adapter
- Authorized import adapter
- Partner adapters
- Additional NEWAX product adapters

## Acceptance criteria

The engine is not complete until:

1. Every accepted event is authenticated and durably recorded before processing.
2. Duplicate event delivery is idempotent.
3. An event ID cannot be reused with different payload bytes.
4. Raw submissions remain immutable and source-attributed.
5. Unknown source schemas are quarantined.
6. Source adapters never write directly to Registry repositories.
7. Common normalization is not duplicated inside every adapter.
8. Mapping versions are immutable after use.
9. Candidate entities may exist without lead profiles.
10. Organizations and people may exist when they are not leads.
11. Raw observations can remain unresolved without being discarded.
12. Multiple source observations can link to one canonical entity.
13. Canonical facts preserve supporting provenance.
14. Deterministic identity signals take priority over fuzzy matching.
15. Ambiguous matches enter review rather than being merged casually.
16. Field ownership protects Core-managed and manually corrected values.
17. Canonical writes use approved domain services and one safe transaction or resumable boundary.
18. Applied source revisions are ordered and replayable.
19. Failed work remains visible, retryable, or dead-lettered.
20. Raw payload access is separately permissioned and audited.
21. Retention, suppression, and deletion requirements apply to inbound data.
22. The Data Ingestion page exposes real processing state without revealing secrets.
23. Harvester raw and canonical streams can be processed independently.
24. Lead qualification remains separate from entity existence.
25. Exact-head tests, integration checks, migrations, security checks, and CI pass before activation.

## Governing principles

1. One integration envelope, many source-native payloads.
2. Core owns canonical formatting and merge policy.
3. Source adapters are versioned and replaceable.
4. Raw evidence is immutable; canonical entities are governed views.
5. Entity existence is independent from commercial usefulness.
6. Lead status is a business role, not an admission gate.
7. Every canonical fact remains traceable to evidence.
8. Direct external writes to Registry tables are prohibited.
9. Failures are durable, observable, and recoverable.
10. Organizations should own the infrastructure and data relationships that power their operations.
