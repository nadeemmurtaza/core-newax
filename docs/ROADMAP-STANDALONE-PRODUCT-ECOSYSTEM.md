# NEWAX Core Standalone Product Ecosystem Roadmap

Status: **Planned**

This roadmap defines the work required for NEWAX Core to integrate safely with standalone Harvester and Communicator products without becoming a mandatory runtime dependency for either application.

It supplements the Data Ingestion and Normalization Engine architecture. It does not claim that the modules below are implemented or active.

## Target outcome

NEWAX Core should provide optional shared identity, relationships, provenance, governance, source facets, integration routing, and controlled context across independently deployable products.

The ecosystem must support:

```text
Harvester only
Communicator only
Harvester + Communicator directly
Harvester + Core
Communicator + Core
Harvester + Core + Communicator
Customer databases and APIs connected to any appropriate product
```

## Governing principles

1. Harvester and Communicator remain standalone products.
2. Core integration is opt-in.
3. Core owns Core formatting, not source-product formatting.
4. No shared database tables or credentials.
5. Local product transactions commit independently.
6. Source-native payloads are preserved before Core transformation.
7. A common envelope is not a common internal schema.
8. Lead status does not determine entity existence.
9. Conversation history remains Communicator-owned.
10. Cross-system context is permissioned, purpose-bound, and auditable.

# Phase CSE-0: Architecture and governance decision

Deliver:

- Product ownership matrix.
- Optional-Core architecture decision.
- Data-format boundary for Harvester, Communicator, and Core.
- Direct Harvester-to-Communicator mode recognition.
- Common envelope and event vocabulary.
- Source-facet ownership rules.
- External-reference rules.
- Availability and eventual-consistency rules.
- Tenant and resale integration boundaries.

Acceptance:

- Core documentation does not describe either product as a dependent Core module.
- Current source-specific integration work is classified as an adapter, not the universal architecture.
- Direct product-to-product integration remains permitted.

# Phase CSE-1: Connected-system registry

Deliver:

- `ConnectedSystem`.
- `ProductInstallation`.
- `ServiceIdentity`.
- `InboundContract`.
- `OutboundSubscription`.
- `ConnectionCapabilitySnapshot`.
- Tenant and installation identity.
- Environment and data-residency metadata.
- Permission and rate scopes.
- Health, version, and reconciliation state.

Acceptance:

- Every incoming event identifies the product installation and tenant.
- A service identity cannot act outside declared contracts.
- Stored credentials are referenced, encrypted, and write-only.

# Phase CSE-2: Durable integration gateway

Deliver:

- Standard integration envelope.
- HMAC and asymmetric-signature options.
- Timestamp, nonce, and replay validation.
- Durable event-ID inbox.
- Payload-hash conflict detection.
- Idempotent response replay.
- Command inbox separated from event inbox.
- Rate limits and backpressure.
- Dead-letter and reprocessing.

Acceptance:

- Retried events do not duplicate Core effects.
- Same event ID with different bytes is rejected and investigated.
- Product outages and Core outages do not cause silent loss.

# Phase CSE-3: Source and schema registry

Deliver:

- Source-system definitions.
- Source connector definitions.
- Source schema versions.
- Compatibility states.
- Mapping profiles and versions.
- Adapter versions.
- Contract negotiation and deprecation policy.
- Test fixtures and preview.

Initial source families:

```text
Harvester raw observations
Harvester canonical entities
Harvester lead facets
Communicator communication profiles
Communicator engagement events
Communicator consent and suppression
Website forms
Approved imports
Partner APIs
Enterprise modules
Connected Infrastructure
```

Acceptance:

- Unknown schemas enter quarantine rather than partial application.
- Schema changes do not silently reuse incompatible mappings.
- Every candidate and Registry write is traceable to source, schema, adapter, mapping, and event.

# Phase CSE-4: Adapter and normalization engine

Deliver:

```text
Source-native event
→ source adapter
→ normalized candidate
→ validation
→ identity resolution
→ merge policy
→ governed Core service
```

Common candidates:

- Organization
- Person
- Location
- Contact method
- Relationship
- Source facet
- Consent or suppression observation

Acceptance:

- Adapters never write Prisma repositories directly.
- Canonical writes use existing Core domain services.
- Harvester and Communicator payloads can differ while resolving to the same Core identity.

# Phase CSE-5: Identity and external-reference coordination

Deliver:

- Permanent source external references.
- Product installation plus source entity uniqueness.
- Deterministic identity signals.
- Fuzzy-match candidate review.
- Merge and split workflows.
- Source revision tracking.
- Stale and ordering policies.
- Harvester, Communicator, and Core link inspection.

Acceptance:

- Local product IDs remain valid and are never replaced by Core IDs.
- Core links improve identity without becoming required for local operation.
- Entity merges preserve source references and audit history.

# Phase CSE-6: Provenance and source facets

Deliver:

- Immutable raw-event linkage.
- Field-level provenance.
- Supporting observation graph.
- Source-owned facet model.
- Facet revision and freshness.
- Search and access policy.
- Harvester lead facet.
- Communicator engagement facet.
- Conflict and ownership handling.

Acceptance:

- Core does not copy entire Harvester dossiers or Communicator transcripts by default.
- Source facets remain clearly attributed and revocable according to retention policy.
- Lead interpretation cannot overwrite Core identity fields.
- Communication engagement cannot overwrite Harvester qualification.

# Phase CSE-7: Field ownership and merge policy

Deliver actions:

```text
CREATE
POPULATE_EMPTY
REFRESH_SOURCE_OWNED
PROPOSE_CHANGE
IGNORE
REQUIRE_REVIEW
QUARANTINE
```

Ownership families:

- Core-verified legal and identity fields
- Source-observed public fields
- Harvester-owned lead fields
- Communicator-owned conversation and engagement fields
- Customer-owned manual overrides
- Contract and account fields
- Consent and suppression fields

Acceptance:

- A source cannot erase protected manual or legal data.
- Conflicts are visible and resolvable.
- Every applied decision records the ownership rule and evidence.

# Phase CSE-8: Harvester adapters

Deliver:

- Raw observation adapter.
- Canonical entity adapter.
- Lead facet adapter.
- Supporting-observation references.
- Permanent Harvester link.
- Revision and projection-hash handling.
- Core-to-Harvester verification and refresh commands.
- Reconciliation.

Acceptance:

- Harvester can publish raw evidence and resolved entities independently.
- Core ingestion remains optional for Harvester.
- Core downtime creates a Harvester backlog, not a Harvester outage.

# Phase CSE-9: Communicator adapters

Deliver inbound handling for:

- Communication profiles
- Contact-channel status
- Consent and suppression
- Delivery outcomes
- Bounces and complaints
- Replies and engagement
- Conversation-state summaries
- Verification and refresh requests

Deliver outbound subscriptions for:

- Identity changes
- Relationship changes
- Contact-channel changes
- Consent and suppression changes
- Approved source facets
- Customer and account context
- Merge and split notifications

Acceptance:

- Communicator continues messaging and preserving inbound messages when Core is unavailable.
- Core receives bounded summaries and events, not unrestricted conversation-table access.
- Suppression synchronization has explicit authority and conflict policy.

# Phase CSE-10: Controlled context gateway

Deliver:

- Context request policy.
- Purpose and actor declaration.
- Field and source authorization.
- Identity summary.
- Relationship summary.
- Approved Harvester facet retrieval.
- Communicator conversation retrieval through an adapter where authorized.
- Customer account and service context.
- Layered retrieval and token-budget controls.
- Source citations and freshness.
- Redaction and sensitivity policy.
- Context access audit.

Acceptance:

- Communicator can operate without the gateway.
- The gateway never sends every raw observation or full history by default.
- Every context item has source, purpose, permission, freshness, and sensitivity metadata.

# Phase CSE-11: Event routing and command coordination

Deliver:

- Subscription registry.
- Event routing.
- Command routing.
- Correlation and causation IDs.
- Delivery outboxes.
- Retry, dead letter, circuit breaker, and backpressure.
- Destination capability negotiation.
- Product-specific acknowledgements.

Acceptance:

- Events describe completed facts.
- Commands request bounded work.
- One product cannot issue undeclared commands to another.
- Routing failures remain visible and recoverable.

# Phase CSE-12: Reconciliation and repair

Deliver:

- Installation-level reconciliation.
- Entity-link reconciliation.
- Revision and projection comparison.
- Missing event detection.
- Stale facet detection.
- Consent and suppression comparison.
- Safe replay.
- Link repair.
- Merge and split propagation.
- Operator review queues.

Acceptance:

- Cross-system inconsistency is detected without direct database comparison.
- Repair is idempotent and audited.
- Historical events remain immutable.

# Phase CSE-13: Administration UI

Route:

```text
/integrations/data-ingestion
```

Tabs:

```text
Connected Systems
Product Installations
Sources
Schemas
Mappings
Inbound Events
Commands
Subscriptions
Source Facets
Entity Candidates
Identity Reviews
Conflicts
Dead Letter
Reprocessing
Reconciliation
Audit
```

Acceptance:

- Operators can distinguish NEWAX-owned, customer-owned, and partner systems.
- Secret values never return to the browser.
- Every operation is tenant- and permission-scoped.

# Phase CSE-14: Security and tenant isolation

Deliver:

- Installation trust levels.
- Tenant-scoped service identities.
- Per-contract permissions.
- Data-residency enforcement.
- Field-level context access.
- Rate and quota enforcement.
- Retention and deletion propagation.
- Security monitoring.
- Abuse and replay detection.
- Integration-key rotation.

Acceptance:

- One customer installation cannot access another customer's entities, facets, context, or event history.
- Product integration cannot escalate to unrestricted Registry write access.
- Deletion and retention requests propagate according to ownership and legal policy.

# Phase CSE-15: Verification and rollout

Required scenarios:

```text
Harvester disconnected from Core
Communicator disconnected from Core
Direct Harvester-to-Communicator mode
Harvester + Core only
Communicator + Core only
Full three-product deployment
Core outage and recovery
Product outage and recovery
Duplicate event replay
Schema incompatibility
Identity merge and split
Suppression conflict
Context authorization denial
Cross-tenant attack attempt
```

Activation requires:

- Exact-head CI.
- Migration validation.
- Tenant-isolation tests.
- Contract tests for every active adapter.
- Replay and idempotency tests.
- Outage, backlog, dead-letter, and reconciliation tests.
- Secret-leak tests.
- Context access and redaction tests.
- Security review.
- Operational runbooks.

# Relationship to source-specific PRs

Source-specific Harvester integration work may provide useful service-account, signing, external-reference, and orchestration patterns. It must be refactored behind the common engine before becoming the permanent multi-source architecture.

# Final acceptance

The Core ecosystem layer is ready only when it improves identity and governance for connected products without reducing their independent availability, data ownership, formatting autonomy, or resale capability.