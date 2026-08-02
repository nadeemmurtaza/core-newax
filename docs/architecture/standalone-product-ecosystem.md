# Standalone Product Ecosystem and Optional Core Integration

Status: **Planned architecture**

## 1. Decision

Harvester and Communicator are standalone, resellable applications.

NEWAX Core is an optional shared identity, governance, and business-infrastructure layer. It strengthens deployments that use it, but it must not be a hidden runtime dependency for either product.

> Core owns governed existence and identity when connected. Harvester and Communicator continue to own their product-specific databases, formatting, workflows, and customer value.

## 2. Product ownership

### Harvester

Harvester owns:

- Source discovery and collection
- Raw observations and evidence
- Source provenance
- Resolution inside the lead-intelligence domain
- Lead profiles
- Qualification and scoring
- Research dossiers
- Opportunity signals
- Publishing rules

Harvester formats information for lead discovery, evidence, qualification, and research.

### Communicator

Communicator owns:

- Communication profiles
- Organizations and people as communication context
- Contact channels
- Consent and suppression
- Dynamic groups and static groups
- Frozen campaign audiences
- Campaigns and sequences
- Conversations and messages
- Replies, bounces, complaints, and engagement
- Communication context and drafting

Communicator formats information for messaging, conversation continuity, engagement, and response quality.

### NEWAX Core

Core owns, when connected:

- Canonical organization and person identity
- Existence and lifecycle state
- Cross-system external references
- Relationships and memberships
- Provenance and source facets
- Field ownership and merge policy
- Tenant-scoped governance
- Shared consent and suppression where configured
- Integration registry, inboxes, outboxes, and audit
- Optional controlled context assembly

Core formats information for existence, identity, relationships, ownership, and governance.

## 3. Independent operation rule

Core integration must be optional at installation and runtime.

```text
Harvester only
Sources → Harvester → leads, dossiers, exports, APIs, customer systems

Communicator only
Customer data → Communicator → audiences, campaigns, conversations, replies

Harvester + Communicator
Harvester publishing rule → direct adapter → Communicator

Full NEWAX deployment
Harvester and Communicator → optional NEWAX Core identity and governance
```

Core unavailability must not prevent:

- Harvester from storing observations, resolving records, qualifying leads, or exporting data.
- Communicator from receiving inbound messages, enforcing opt-out, sending approved messages, drafting replies, or preserving conversations.

Optional integrations use durable local outboxes and continue after Core recovers.

## 4. No shared database rule

The products must never integrate by sharing tables or database credentials.

Forbidden patterns:

- Communicator reading Harvester tables.
- Harvester writing Communicator tables.
- Either product writing Core Registry tables.
- Core querying tenant product databases with unrestricted credentials.
- One product's migration changing another product's schema.

Supported patterns:

- Versioned APIs
- Signed webhooks
- Durable event delivery
- Approved database connectors owned by the connecting product
- File import and export
- Message queues
- Object storage exchange
- Customer-configured adapters

## 5. Product-specific connector engines

Harvester and Communicator each maintain their own:

- Connection profiles
- Credential references
- Connector registry
- Source-schema registry
- Mapping profiles and versions
- Normalization engine
- Synchronization cursors and checkpoints
- Conflict policy
- Inbox and outbox
- Audit and reconciliation

The two products may share connector-interface libraries and security utilities, but they must not share runtime state or one central mapping database.

The same external source can therefore be interpreted differently:

```text
Customer CRM account
→ Harvester: evidence, organization candidate, lead profile, qualification
→ Communicator: organization context, contact profile, audience eligibility
→ Core: organization identity, source facet, external reference
```

## 6. Common integration envelope

Products may use a common outer envelope while preserving source-native payloads:

```json
{
  "integration_version": 1,
  "event_id": "unique-event-id",
  "event_type": "source-specific.event",
  "source_system": "source-identifier",
  "source_schema": "source-schema-and-version",
  "occurred_at": "ISO-8601 timestamp",
  "tenant_reference": "tenant-identifier",
  "entity_reference": "source-entity-id",
  "correlation_id": "optional-workflow-id",
  "causation_id": "optional-causing-event-id",
  "payload_checksum": "sha256",
  "payload": {}
}
```

The envelope standardizes delivery and audit. It does not force shared internal schemas.

## 7. Core source facets

Core should store bounded, source-owned facets rather than copying every product table.

Example Harvester facet:

```json
{
  "source": "harvester",
  "source_entity_id": "lead-932",
  "lead_status": "qualified",
  "lead_score": 82,
  "qualification_updated_at": "2026-08-02T06:00:00Z",
  "dossier_reference": "harvester-dossier-932"
}
```

Example Communicator facet:

```json
{
  "source": "communicator",
  "communication_profile_id": "profile-661",
  "last_contacted_at": "2026-08-02T07:00:00Z",
  "conversation_state": "engaged",
  "preferred_channel": "email",
  "conversation_reference": "conversation-440"
}
```

Source facets are:

- Versioned
- Source-owned
- Searchable only where policy permits
- Linked to canonical Core entities
- Not authoritative for fields owned by another system
- Replaceable through source revision and merge policy

## 8. Optional identity links

When Core is connected, each product stores a permanent link:

```text
Harvester source entity ↔ Core entity
Communicator profile ↔ Core entity
```

The Core ID improves cross-system identity but does not replace each product's local ID.

Example:

```text
Harvester lead_id           lead_932
Communicator profile_id     profile_661
Core organization_id        core_org_4821
```

Each record remains usable without resolving the Core reference.

## 9. Harvester integration modes

Core supports optional Harvester inputs:

### Raw observation stream

Every accepted Harvester source observation may be published after durable Harvester storage.

Core stores immutable raw evidence, validates the source schema, and may create or enrich an entity candidate.

### Canonical entity stream

Every new or materially changed Harvester-resolved entity may be published after Harvester validation.

Core applies its own identity, provenance, field-ownership, and canonical-write policy.

### Lead facet stream

Selected lead interpretation may be published separately:

- Qualification
- Score
- Opportunity summary
- Dossier reference
- Freshness

Lead interpretation never determines whether an entity is allowed to exist in Core.

## 10. Communicator integration modes

Core supports optional Communicator inputs:

- Communication profile links
- Contact-channel status
- Consent and suppression outcomes
- Delivery, bounce, complaint, reply, and engagement events
- Conversation state summaries
- Relationship and preference observations
- Verification and refresh requests

Core may publish to Communicator:

- Canonical identity changes
- Relationship changes
- Contact-channel changes
- Consent and suppression changes
- Customer or account relationship context
- Approved source facets
- Controlled context packages

Communicator remains responsible for its own conversation and message store.

## 11. Controlled communication context

Core may provide an optional context gateway, but Communicator must also be able to build context independently.

A context package may combine:

```text
Core identity and relationships
+ approved Harvester lead summary or dossier retrieval
+ Communicator conversation history
+ customer account and service context
+ consent and suppression
```

Core should not send every raw observation or message to an AI model.

Use layered retrieval:

1. Identity summary
2. Relationship and lead summary
3. Recent conversation history
4. Promises, objections, preferences, and open actions
5. Relevant older records retrieved on demand
6. Raw evidence available for verification

Every context item requires source attribution, permission, purpose, freshness, and sensitivity metadata.

## 12. Core ingestion changes

The planned Data Ingestion and Normalization Engine must treat source autonomy as a first-class rule.

Required modules:

```text
Integration gateway
Durable inbound inbox
Immutable raw event store
Source and connector registry
Source schema registry
Source adapter registry
Mapping and normalization engine
Entity candidate store
Identity resolution coordinator
Provenance graph
Field-ownership and merge policy
Canonical write orchestrator
Source facet store
External-reference registry
Context-access policy
Reprocessing and reconciliation
```

Adapters convert source-native payloads into Core candidate models. They never require the source application to format Prisma rows.

## 13. Connection registry

Core should maintain metadata for connected systems:

```text
ConnectedSystem
ServiceIdentity
InboundContract
OutboundSubscription
SourceSchema
AdapterVersion
PermissionScope
TenantScope
HealthState
LastDelivery
LastReconciliation
```

Secrets are stored through approved secret references and never returned to the frontend.

Core may connect to approved customer databases through its own connectors, but that capability does not replace Harvester or Communicator connector engines.

## 14. Cross-product commands and events

Events state what happened:

```text
harvester.observation.recorded
harvester.entity.revised
harvester.lead.requalified
communicator.contact.invalidated
communicator.message.bounced
communicator.reply.received
core.entity.merged
core.suppression.changed
```

Commands request work:

```text
harvester.organization.refresh.requested
harvester.contact.verify.requested
communicator.audience.publish.requested
communicator.conversation.handoff.requested
```

Commands and events use independent IDs, idempotency, retries, dead letter, audit, and permission checks.

## 15. Availability and consistency

The ecosystem uses eventual consistency across products.

Rules:

- Product-local transactions commit first.
- Outbox insertion is atomic with the local change.
- Remote delivery is asynchronous.
- Receiving inboxes are durable and idempotent.
- Source revisions and payload hashes detect stale or conflicting events.
- Reconciliation compares external references, revisions, and projections.
- No distributed transaction spans product databases.

## 16. Resale and tenant boundaries

Core must not assume every connected Harvester or Communicator deployment belongs to NEWAX's own tenant.

Each integration includes:

- Product installation identity
- Customer tenant identity
- Contract and schema versions
- Allowed event and command types
- Field and context permissions
- Retention and deletion policy
- Rate and usage limits
- Data residency metadata
- Connection ownership

Cross-customer linking is forbidden unless explicitly governed by a multi-party business relationship and authorization model.

## 17. Administration experience

Core route:

```text
/integrations/data-ingestion
```

Tabs:

```text
Connected Systems
Sources
Schemas
Mappings
Inbound Events
Source Facets
Entity Candidates
Identity Reviews
Conflicts
Subscriptions
Dead Letter
Reprocessing
Reconciliation
Audit
```

The page distinguishes:

- NEWAX-owned Harvester and Communicator installations
- Customer-owned product installations
- Customer databases
- Partner APIs
- Enterprise modules
- Connected Infrastructure sources

## 18. Acceptance criteria

The ecosystem architecture is not complete until:

1. Harvester and Communicator function with Core disabled.
2. Core can ingest from either product independently.
3. The products retain their local IDs and databases.
4. No product reads another product's private tables.
5. Product-specific mappings remain independent.
6. A common envelope does not become a common internal schema.
7. Core stores immutable inbound evidence before transformation.
8. Core adapters perform Core-specific normalization.
9. Source facets remain source-owned.
10. Lead qualification is separate from entity existence.
11. Conversation history remains Communicator-owned.
12. Core downtime does not block product-local operations.
13. Cross-product delivery is idempotent and replay-safe.
14. Context access is permissioned, purpose-bound, source-attributed, and auditable.
15. Direct Harvester-to-Communicator mode remains supported.
16. Multi-tenant resale deployments remain isolated.
17. Reconciliation detects missing links, stale revisions, and delivery gaps.
18. Exact-head tests, security checks, migrations, and CI pass before activation.

## 19. Locked rule

> NEWAX Core strengthens identity, governance, relationships, and controlled context across connected systems. It never turns Harvester or Communicator into dependent modules, and it never replaces their product-specific formatting engines.
