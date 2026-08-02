# NEWAX Core Standalone Product Ecosystem Roadmap

Status: **Planned**

This roadmap defines the work required for NEWAX Core to integrate safely with standalone Harvester and Communicator products, customer applications, partner systems, and internal services without becoming a mandatory runtime dependency for any connected application.

It supplements the Data Ingestion and Normalization Engine architecture. It does not claim that the modules below are implemented or active.

## Target outcome

NEWAX Core should provide optional shared identity, relationships, provenance, governance, source facets, integration routing, controlled context, and a governed developer-application credential platform across independently deployable products.

The ecosystem must support:

```text
Harvester only
Communicator only
Harvester + Communicator directly
Harvester + Core
Communicator + Core
Harvester + Core + Communicator
Customer databases and APIs connected to any appropriate product
Customer and partner applications connected to Core through registered credentials
Internal services connected to Core through bounded service identities
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
11. Every connected application receives its own identity and credentials.
12. No universal Core API key may be shared across applications or environments.
13. Credentials are least-privilege, rotatable, revocable, observable, and displayed only once where a secret is generated.
14. Browser and mobile applications never receive permanent server credentials.

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
- Developer-application and machine-identity boundary.
- Separation of human authentication, application authentication, and webhook verification.

Acceptance:

- Core documentation does not describe either product as a dependent Core module.
- Current source-specific integration work is classified as an adapter, not the universal architecture.
- Direct product-to-product integration remains permitted.
- Application credentials are not represented as human-user sessions.

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
- Stable links between connected systems, developer applications, credentials, contracts, and subscriptions.

Acceptance:

- Every incoming event identifies the product installation, developer application or service identity, environment, and tenant.
- A service identity cannot act outside declared contracts.
- Stored credentials are referenced, protected, and write-only.
- Disabling one installation or application does not disable unrelated integrations.

# Phase CSE-2: Developer applications and integration credentials

## Product surface

Deliver the Core developer platform at:

```text
/settings/developer-applications
/settings/developer-applications/{applicationId}
/settings/developer-applications/{applicationId}/credentials
/settings/developer-applications/{applicationId}/permissions
/settings/developer-applications/{applicationId}/restrictions
/settings/developer-applications/{applicationId}/usage
/settings/developer-applications/{applicationId}/webhooks
/settings/developer-applications/{applicationId}/audit
```

## Application registry

Deliver `IntegrationApplication` with:

```text
id
tenant_id
name
description
application_type
environment
owner_user_id
status
homepage_url
callback_urls
webhook_urls
allowed_origins
allowed_ip_ranges
created_at
updated_at
disabled_at
```

Application types:

```text
FIRST_PARTY
CUSTOMER_APPLICATION
PARTNER_APPLICATION
INTERNAL_AUTOMATION
SERVER_SERVICE
WEB_APPLICATION
MOBILE_APPLICATION
```

## Credential model

Deliver `IntegrationCredential` with:

```text
id
application_id
credential_type
key_id
public_prefix
secret_hash_or_public_key
environment
status
expires_at
last_used_at
last_used_ip
created_by
created_at
rotated_at
revoked_at
revocation_reason
```

Credential types:

```text
API_KEY
OAUTH_CLIENT_SECRET
JWT_PRIVATE_KEY
MTLS_CERTIFICATE
WEBHOOK_SIGNING_SECRET
```

Secrets must:

- Be generated with cryptographically secure randomness.
- Be displayed once at creation or rotation.
- Never be returned by list, read, audit, log, or support APIs.
- Be stored as a keyed hash where verification does not require recovery.
- Use encrypted secret storage only where controlled recovery is technically required.
- Expose only a public prefix, key ID, fingerprint, status, dates, and safe usage metadata.

## Authentication methods

Deliver:

- API-key authentication for bounded server-to-server use.
- OAuth 2.0 client-credentials exchange for first-party, customer, and partner services.
- Short-lived access tokens with audience, tenant, application, environment, scope, issued-at, expiry, and unique token ID.
- Authorization Code with PKCE for approved browser and mobile delegated-access use cases.
- JWT private-key assertion support for higher-assurance service authentication.
- Mutual TLS support where enterprise policy requires it.
- Separate webhook-signing credentials for outbound event verification.

Permanent secrets must not be embedded in browser or mobile applications.

## Scope registry

Deliver versioned application scopes, initially including:

```text
core.entities.read
core.entities.write
core.organizations.read
core.organizations.write
core.people.read
core.people.write
core.relationships.read
core.relationships.write
core.observations.publish
core.facets.read
core.facets.write
core.identity-links.read
core.identity-links.write
core.context.read
core.context.request
core.events.publish
core.webhooks.manage
core.audit.read
```

Scopes must be grouped by bounded business capability, not exposed as an unrestricted `core.*` default grant.

## Restrictions and quotas

Deliver application- and credential-level restrictions for:

- Tenant.
- Environment.
- Allowed scopes.
- Allowed API audiences.
- Allowed endpoints or contract families.
- Allowed IP addresses and CIDR ranges.
- Allowed origins for approved delegated flows.
- Rate limits.
- Daily or monthly quotas.
- Expiration.
- Permitted entity types.
- Permitted field groups.
- Read, publish, propose, command, and administrative modes.
- Data-residency and regional-processing restrictions.

## Credential lifecycle

Deliver:

```text
Create
→ display once
→ activate
→ observe
→ rotate with overlap
→ revoke previous credential
→ retain safe audit metadata
```

- Multiple active credentials are permitted only for bounded rotation or migration windows.
- A failed candidate credential validation preserves the current active credential.
- Revocation is immediate for future authentication and token issuance.
- Existing short-lived tokens follow explicit revocation and maximum-lifetime policy.
- Scope escalation, credential creation, and credential export require recent human reauthentication and permission checks.

## Application principal

Every authenticated request must establish an application principal containing:

```text
principal_type = APPLICATION
application_id
credential_id or token_id
tenant_id
environment
audience
scopes
contract_ids
restriction_snapshot
```

The principal must be distinct from human users and must pass normal domain authorization after authentication.

## API surface

Deliver bounded management APIs:

```text
POST   /api/core/developer-applications
GET    /api/core/developer-applications
GET    /api/core/developer-applications/{id}
PATCH  /api/core/developer-applications/{id}
POST   /api/core/developer-applications/{id}/disable

POST   /api/core/developer-applications/{id}/credentials
GET    /api/core/developer-applications/{id}/credentials
POST   /api/core/credentials/{id}/rotate
POST   /api/core/credentials/{id}/revoke

PUT    /api/core/developer-applications/{id}/scopes
PUT    /api/core/developer-applications/{id}/restrictions

POST   /api/core/oauth/token
POST   /api/core/credentials/validate
```

Credential-read responses return metadata only.

## Usage and audit

Deliver:

- Last-used timestamp and safe source metadata.
- Requests, errors, throttles, quota consumption, token issuance, and webhook-signature failures.
- Application, credential, scope, endpoint, tenant, environment, correlation ID, and outcome dimensions.
- Audit events for application creation, owner change, scope change, restriction change, credential creation, rotation, revocation, and disablement.
- Secret-safe support diagnostics.

Acceptance:

- Harvester, Communicator, customer applications, partner systems, and internal services can each receive independent Core application identities.
- One credential can be revoked or rotated without affecting another application.
- Full credential secrets appear only once and never reappear through APIs, logs, audit, metrics, errors, or support tooling.
- API keys are verified through constant-time, secure-hash comparison.
- OAuth client credentials issue short-lived bounded tokens rather than using the permanent secret on every request.
- Browser and mobile applications cannot create or retrieve permanent server credentials.
- Default grants are minimal; unrestricted Core access is never automatic.
- Tenant, environment, scope, endpoint, IP, origin, quota, entity-type, field-group, and data-residency restrictions are enforced before domain execution.
- Application authentication does not bypass Registry services, tenancy, field ownership, context authorization, or audit.
- Rotation supports controlled overlap and a failed replacement preserves the prior working credential.
- Revocation, expiry, replay, token-audience, token-ID, and disabled-application tests pass.
- Cross-tenant credential use is rejected and audited.

# Phase CSE-3: Durable integration gateway

Deliver:

- Standard integration envelope.
- API-key, OAuth access-token, JWT assertion, mutual-TLS, HMAC, and asymmetric-signature verification paths where approved.
- Application-principal establishment.
- Scope, contract, tenant, environment, audience, IP, origin, rate, quota, and restriction enforcement.
- Timestamp, nonce, token-ID, event-ID, and replay validation.
- Durable event-ID inbox.
- Payload-hash conflict detection.
- Idempotent response replay.
- Command inbox separated from event inbox.
- Rate limits and backpressure.
- Dead-letter and reprocessing.

Authentication pipeline:

```text
Receive credential or token
→ locate active application and credential
→ verify secret, signature, certificate, or token
→ verify application, tenant, environment, audience, expiry, nonce, and replay state
→ enforce scopes, contracts, restrictions, rate, and quota
→ establish application principal
→ authorize requested Core resource and field set
→ execute governed Core service
→ record safe usage and audit metadata
```

Acceptance:

- Retried events do not duplicate Core effects.
- Same event ID with different bytes is rejected and investigated.
- Product outages and Core outages do not cause silent loss.
- Authentication success alone never grants unrestricted Registry access.
- Full credentials and authorization headers never enter logs or error payloads.

# Phase CSE-4: Source and schema registry

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
Registered customer applications
```

Acceptance:

- Unknown schemas enter quarantine rather than partial application.
- Schema changes do not silently reuse incompatible mappings.
- Every candidate and Registry write is traceable to application, credential or token, source, schema, adapter, mapping, and event.

# Phase CSE-5: Adapter and normalization engine

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

- Organization.
- Person.
- Location.
- Contact method.
- Relationship.
- Source facet.
- Consent or suppression observation.

Acceptance:

- Adapters never write Prisma repositories directly.
- Canonical writes use existing Core domain services.
- Harvester, Communicator, customer, and partner payloads can differ while resolving to the same Core identity.
- Application scopes and contracts bound every adapter action.

# Phase CSE-6: Identity and external-reference coordination

Deliver:

- Permanent source external references.
- Product installation plus source entity uniqueness.
- Application identity plus external-reference uniqueness.
- Deterministic identity signals.
- Fuzzy-match candidate review.
- Merge and split workflows.
- Source revision tracking.
- Stale and ordering policies.
- Harvester, Communicator, customer application, and Core link inspection.

Acceptance:

- Local application IDs remain valid and are never replaced by Core IDs.
- Core links improve identity without becoming required for local operation.
- Entity merges preserve source references and audit history.

# Phase CSE-7: Provenance and source facets

Deliver:

- Immutable raw-event linkage.
- Field-level provenance.
- Supporting observation graph.
- Source-owned facet model.
- Facet revision and freshness.
- Search and access policy.
- Harvester lead facet.
- Communicator engagement facet.
- Customer and partner application facets where approved.
- Conflict and ownership handling.

Acceptance:

- Core does not copy entire Harvester dossiers or Communicator transcripts by default.
- Source facets remain clearly attributed and revocable according to retention policy.
- Lead interpretation cannot overwrite Core identity fields.
- Communication engagement cannot overwrite Harvester qualification.
- Application scope does not imply ownership of fields it is allowed to submit.

# Phase CSE-8: Field ownership and merge policy

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

- Core-verified legal and identity fields.
- Source-observed public fields.
- Harvester-owned lead fields.
- Communicator-owned conversation and engagement fields.
- Customer-owned manual overrides.
- Contract and account fields.
- Consent and suppression fields.
- Application-owned bounded source facets.

Acceptance:

- A source cannot erase protected manual or legal data.
- Conflicts are visible and resolvable.
- Every applied decision records the ownership rule and evidence.
- Write scope does not bypass field ownership or merge policy.

# Phase CSE-9: Harvester adapters

Deliver:

- Dedicated Harvester developer application and environment identities.
- Harvester credential, scope, contract, restriction, rotation, and usage configuration.
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
- Harvester does not share its Core credential with Communicator or another installation.

# Phase CSE-10: Communicator adapters

Deliver:

- Dedicated Communicator developer application and environment identities.
- Communicator credential, scope, contract, restriction, rotation, and usage configuration.

Deliver inbound handling for:

- Communication profiles.
- Contact-channel status.
- Consent and suppression.
- Delivery outcomes.
- Bounces and complaints.
- Replies and engagement.
- Conversation-state summaries.
- Verification and refresh requests.

Deliver outbound subscriptions for:

- Identity changes.
- Relationship changes.
- Contact-channel changes.
- Consent and suppression changes.
- Approved source facets.
- Customer and account context.
- Merge and split notifications.

Acceptance:

- Communicator continues messaging and preserving inbound messages when Core is unavailable.
- Core receives bounded summaries and events, not unrestricted conversation-table access.
- Suppression synchronization has explicit authority and conflict policy.
- Communicator does not share its Core credential with Harvester or another installation.

# Phase CSE-11: Controlled context gateway

Deliver:

- Context request policy.
- Purpose and actor declaration.
- Application, human, and service-principal declaration.
- Scope, contract, field, source, tenant, and sensitivity authorization.
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
- `core.context.read` does not grant unrestricted raw-data or transcript access.

# Phase CSE-12: Event routing and command coordination

Deliver:

- Subscription registry.
- Application-owned webhook endpoints.
- Separate webhook-signing credentials and rotation.
- Event routing.
- Command routing.
- Correlation and causation IDs.
- Delivery outboxes.
- Retry, dead letter, circuit breaker, and backpressure.
- Destination capability negotiation.
- Product-specific acknowledgements.
- Webhook timestamp, signature, nonce, event-ID, and replay verification guidance.

Acceptance:

- Events describe completed facts.
- Commands request bounded work.
- One product or application cannot issue undeclared commands to another.
- Routing failures remain visible and recoverable.
- Webhook credentials are independent from inbound API credentials.

# Phase CSE-13: Reconciliation and repair

Deliver:

- Installation-level reconciliation.
- Application and credential-state reconciliation.
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
- Revoked or disabled credentials cannot be revived through replay or reconciliation.

# Phase CSE-14: Administration and developer console

Primary routes:

```text
/integrations/data-ingestion
/settings/developer-applications
```

Data-ingestion tabs:

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

Developer-application tabs:

```text
Overview
Credentials
Permissions
Restrictions
Usage
Webhooks
Contracts
Tokens
Audit
```

Deliver:

- Create, read, update, disable, and transfer application ownership.
- Generate API key, OAuth client credential, key-pair identity, certificate identity, or webhook signing credential according to policy.
- One-time secret display with explicit acknowledgement.
- Scope and contract assignment.
- IP, origin, environment, endpoint, entity, field, rate, quota, expiry, and regional restrictions.
- Credential validation, rotation, overlap, revocation, expiry, and last-use inspection.
- Usage, errors, throttles, token issuance, webhook health, and audit views.
- Copyable code examples that never embed real credentials after the one-time creation view.

Acceptance:

- Operators can distinguish NEWAX-owned, customer-owned, and partner systems.
- Secret values never return to the browser after the one-time creation response.
- Every operation is tenant- and permission-scoped.
- Credential creation, scope escalation, owner transfer, and revocation require recent reauthentication and explicit permissions.
- Support users cannot retrieve credential plaintext.

# Phase CSE-15: Security, tenant isolation, and abuse controls

Deliver:

- Installation and application trust levels.
- Tenant-scoped application and service identities.
- Per-contract and per-scope permissions.
- Environment and audience separation.
- Data-residency enforcement.
- Field-level context access.
- Rate and quota enforcement by tenant, application, credential, token, endpoint, and contract.
- Retention and deletion propagation.
- Security monitoring.
- Credential-stuffing, token-replay, event-replay, scope-abuse, quota-abuse, and anomalous-IP detection.
- Credential and signing-key rotation.
- Hash and cryptographic algorithm agility.
- Secret scanning and log-redaction tests.
- Emergency application disablement and credential revocation.

Acceptance:

- One customer installation or application cannot access another customer's entities, facets, context, event history, applications, credentials, tokens, or usage records.
- Product integration cannot escalate to unrestricted Registry write access.
- Deletion and retention requests propagate according to ownership and legal policy.
- Test credentials cannot authenticate to production and production credentials cannot authenticate to test audiences.
- Disabled applications, revoked credentials, expired credentials, wrong audiences, wrong environments, disallowed IPs, disallowed origins, exhausted quotas, and insufficient scopes fail closed.
- No credential, token, authorization header, private key, signing secret, or recoverable equivalent appears in logs, traces, metrics, errors, exports, or audit payloads.

# Phase CSE-16: Verification and rollout

Required scenarios:

```text
Harvester disconnected from Core
Communicator disconnected from Core
Direct Harvester-to-Communicator mode
Harvester + Core only
Communicator + Core only
Full three-product deployment
Customer application using API key
Customer service using OAuth client credentials
Service using signed JWT assertion
Approved enterprise client using mutual TLS
Browser or mobile delegated flow using Authorization Code with PKCE
Independent test and production credentials
One application credential rotated without affecting another
Old and new credential overlap during bounded rotation
Revoked credential use
Expired credential use
Wrong-tenant credential use
Wrong-environment credential use
Wrong-audience token use
Insufficient-scope request
Disallowed-IP request
Disallowed-origin delegated request
Rate-limit and quota exhaustion
Duplicate token-ID or nonce replay
Webhook signature verification and replay rejection
Emergency application disablement
Core outage and recovery
Product outage and recovery
Duplicate event replay
Schema incompatibility
Identity merge and split
Suppression conflict
Context authorization denial
Cross-tenant attack attempt
Secret-leak and log-redaction attempt
```

Activation requires:

- Exact-head CI.
- Migration validation.
- Tenant-isolation tests.
- Application-principal authorization tests.
- API-key secure-hash and constant-time verification tests.
- OAuth client-credentials, token audience, expiry, token-ID, revocation, and scope tests.
- PKCE delegated-flow tests where enabled.
- JWT assertion and mutual-TLS tests where enabled.
- Credential one-time-display, non-retrieval, rotation, overlap, expiry, and revocation tests.
- IP, origin, environment, endpoint, entity, field, rate, quota, and data-residency restriction tests.
- Webhook-signing, timestamp, nonce, event-ID, and replay tests.
- Contract tests for every active adapter.
- Replay and idempotency tests.
- Outage, backlog, dead-letter, and reconciliation tests.
- Secret-leak, log-redaction, trace-redaction, error-redaction, audit-redaction, and support-tool tests.
- Context access and redaction tests.
- Security review.
- Credential-compromise and emergency-revocation runbooks.
- Operational and support readiness.

# Relationship to source-specific PRs

Source-specific Harvester integration work may provide useful service-account, signing, external-reference, and orchestration patterns. It must be refactored behind the common engine and the Core developer-application credential platform before becoming the permanent multi-source architecture.

Existing human OAuth decisions may provide reusable authorization-server and token-validation patterns, but machine credentials, application principals, application scopes, service contracts, key lifecycle, and developer-console behavior remain separate concerns and require their own implementation and review.

# Final acceptance

The Core ecosystem layer is ready only when it improves identity and governance for connected products and registered applications without reducing their independent availability, data ownership, formatting autonomy, resale capability, credential isolation, or operational control.

The developer-application credential platform is ready only when each application can be independently registered, permissioned, restricted, observed, rotated, revoked, and audited without sharing secrets, bypassing Core domain services, or exposing credentials after creation.