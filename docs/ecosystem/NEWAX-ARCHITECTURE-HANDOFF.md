# NEWAX ECOSYSTEM ARCHITECTURE & DEVELOPER HANDOFF

Harvester Integration Decision | Identity Ownership | Repository Boundaries | Integration Contracts | Migration Roadmap

Prepared for: NEWAX Engineering
Date: 23 October 2026
Status: Architecture decision and implementation specification
Brand: NEWAX, The Business Infrastructure Company

> This is the full specification as prepared for NEWAX Engineering. It is not a claim that every proposed integration already exists in production, nor that any capability described below is implemented or deployed merely because it is documented here. See section 9 ("Existing Versus Missing: Verification Rules") for the required verification discipline.

## 1. Executive Summary

NEWAX is building a connected business infrastructure ecosystem in which organizations can access multiple business services through a consistent identity, organization, permission, and integration framework.

The objective is not to create one enormous codebase or move every service into one repository. The objective is to establish clear ownership, secure integration, consistent access control, and reliable operations across independently maintained services.

The central decisions are:

1. nID is the identity authority. It owns authentication and identity-related sessions.
2. NEWAX Core is the shared platform layer. It owns the module registry and shared integration capabilities as those capabilities are implemented and verified.
3. ERP owns its assigned business operations and operational records.
4. Communicator owns conversations, messaging, and communication workflows.
5. Harvester is a first-class NEWAX ecosystem module. The previous rule treating Harvester as an independently governed product is superseded.
6. NMail owns email delivery and transport, rather than campaign strategy or general business records.
7. Every domain retains authority over its own data. Integration does not justify unrestricted access to another service's database.
8. A repository or module is not production-ready merely because its code, documentation, UI, or roadmap entry exists.
9. All cross-service access must be authenticated, authorized, auditable, and tested.
10. Repository restructuring must be incremental, reversible, and evidence-based.

The desired outcome is one coherent NEWAX ecosystem with clearly defined module boundaries and no unnecessary duplication of identity, integration, communication, or business logic.

## 2. Purpose and Scope

This document gives developers a common architecture and implementation plan for the following repositories and services:

- `nID`
- `core-newax`
- `erp-1`
- `Communicator`
- `harvester`
- `newcom`, including its email engine and other currently bundled services
- Related services whose ownership or integration requires clarification

The document addresses:

- What each repository should own.
- Which capabilities should be moved, retained, consolidated, or built.
- How organizations and agencies should use Harvester.
- How authentication and organization context should flow between services.
- How Core's module registry, gateway, and event infrastructure should be used.
- How to distinguish existing code from verified working functionality and planned work.
- How developers should execute migrations without creating competing sources of truth.

This is an architecture decision and implementation plan. It is not proof that all proposed capabilities are already implemented or deployed.

## 3. Architecture Decisions

### AD-01: One Identity Authority

nID is the identity provider for NEWAX applications.

It should own:

- User account identity.
- Authentication.
- Login and logout flows.
- Multi-factor authentication where implemented.
- Identity-related sessions and token lifecycle.
- OAuth client integration and supported authorization flows.
- Identity verification capabilities assigned to nID.
- Scoped service credentials or secrets-management capabilities where implemented and verified.

Other applications must integrate with nID instead of quietly creating their own competing login systems.

### AD-02: Harvester Is Part of the NEWAX Ecosystem

Harvester is no longer to be treated as an independently governed product platform.

It is a first-class NEWAX module that participates in the common identity, organization, authorization, and integration framework.

Harvester may remain in its own repository because separate repositories can support:

- Independent development.
- Separate testing.
- Clear code ownership.
- Independent releases.
- Different deployment requirements.
- Controlled dependency management.

A separate repository does not mean a separate identity universe or an independent architecture.

The previous blanket independence rule is superseded by this decision.

### AD-03: Domain Ownership Remains Explicit

Being part of the NEWAX ecosystem does not mean that Core owns all data or that every service shares every database.

Each service remains authoritative for its assigned domain.

Examples:

- Harvester owns its intelligence, research evidence, and qualification records.
- Communicator owns its conversations and communication history.
- ERP owns its assigned operational and financial records.
- nID owns identity and authentication records.
- Core owns shared platform metadata and integration capabilities assigned to it.

### AD-04: Core Is Shared Infrastructure, Not a Universal Database

Core should provide shared capabilities such as:

- Module registry.
- Module discovery and launch coordination.
- Approved synchronous integration gateway.
- Approved asynchronous event infrastructure.
- Shared contracts and reusable platform capabilities.
- Centralized integration observability and audit aggregation where appropriate.
- Read-only cross-domain analytical projections where explicitly designed.

Core must not become an uncontrolled repository for every domain's private records.

### AD-05: No Direct Access to Another Service's Private Database

A service must not bypass another service's ownership by directly reading or writing its private database tables.

Cross-service communication should use documented, versioned APIs or events.

Temporary migration adapters must be explicit, restricted, documented, and removed according to a defined retirement plan.

### AD-06: Repository Boundaries Are Not Product Boundaries

Services may be maintained in separate repositories while still belonging to one NEWAX ecosystem.

The correct repository structure should support clear ownership, deployment, testing, and maintenance.

Do not combine repositories simply for visual uniformity. Do not preserve unnecessary independence simply because an old architecture document said so.

### AD-07: No False Completion Claims

A module is not complete merely because:

- A folder exists.
- A database schema exists.
- A route returns a response.
- A UI card is visible.
- A README describes the capability.
- A roadmap marks it as planned.
- A build passes without exercising the full workflow.

Production readiness requires evidence of working behavior, authorization, persistence, integration, tests, monitoring, and recovery.

## 4. Repository Ownership Map

### 4.1 nID

Primary responsibility: Identity and authentication.

nID should own:

- Accounts and authentication.
- Login and logout.
- MFA/2FA where implemented.
- OAuth clients and supported session flows.
- Identity verification capabilities assigned to the identity domain.
- Identity-related credential lifecycle.
- Scoped service credentials and secrets-management capabilities if implemented to the required security standard.

nID should not own:

- ERP orders.
- Product inventories.
- Customer conversations.
- Harvester research records.
- Financial ledgers.
- Another service's private operational records.

Other applications must validate identity using the approved nID integration contract.

A successful login does not automatically grant access to every organization or module.

### 4.2 NEWAX Core — `core-newax`

Primary responsibility: Shared platform and integration infrastructure.

Core should own:

- Module registry and module metadata.
- Module status and approval metadata.
- Shared module discovery.
- Module Gateway when implemented and verified.
- Event infrastructure when implemented and verified.
- Shared platform contracts.
- Reusable capabilities genuinely needed across multiple services.
- Integration-level audit aggregation where appropriate.
- Approved read-only cross-domain analytical projections.

Core should not become:

- A competing identity provider.
- A duplicate source of truth for all organizations and memberships without an explicit architecture decision.
- A universal database for private business records.
- A substitute for ERP, Harvester, or Communicator domain logic.

**Important:** The existence of an architecture document describing a gateway or event bus does not prove that the corresponding implementation is production-ready. Developers must inspect the code, tests, deployment, and runtime behavior.

### 4.3 ERP — `erp-1`

Primary responsibility: Assigned business operations.

ERP should own its assigned implementations of:

- Product and service catalogues.
- Pricing as a business-owned record.
- Sales and orders.
- Purchasing.
- Inventory and stock movements.
- Fulfillment and delivery operations.
- POS.
- Accounting and financial ledgers.
- Finance operations.
- HR and payroll.
- Attendance and workforce operations.
- Other explicitly assigned ERP business modules.

ERP should not become the owner of:

- Identity authentication.
- A competing login account system.
- General omnichannel conversations.
- Email transport.
- A second generic communication platform.
- Identity verification infrastructure assigned to nID.

### 4.4 Communicator — `Communicator`

Primary responsibility: Communication and engagement.

Communicator should own:

- Conversations.
- Messages and communication threads.
- Drafts.
- Omnichannel inbox and channel orchestration.
- Reply assistance.
- Communication automation.
- Broadcasts and communication campaigns where assigned.
- Communication engagement history.
- Communication-specific knowledge and reply workflows.

Communicator should not become:

- A second identity provider.
- A duplicate email delivery infrastructure.
- The financial ledger.
- A universal webhook platform.
- A competing source of truth for ERP operational records.
- A second general-purpose ticketing platform without a deliberate ownership decision.

### 4.5 Harvester — `harvester`

Primary responsibility: Intelligence and lead-research workflows.

Harvester should own:

- Lead discovery.
- Source evidence and provenance.
- Research records.
- Entity resolution.
- Lead qualification.
- Opportunity assessment.
- Intelligence dossiers.
- Research and scoring history.
- Relevant intelligence outputs.
- Harvester-specific review and approval workflows.

Harvester should participate in the common NEWAX ecosystem through nID, the authoritative organization/access framework, and approved integration contracts.

Harvester should not become:

- A separate identity authority.
- A replacement for Core.
- A universal organization database.
- A source of truth for Communicator conversations.
- A source of truth for ERP financial or operational transactions.
- An ungoverned scraping or outreach system.

### 4.6 NMail — Email Delivery Service

The existing `newcom` repository contains an email-related engine alongside unrelated services.

The email engine should be treated as the NMail service identity, subject to confirming its current implementation and deployment.

NMail should own:

- Email delivery and transport.
- SMTP-related infrastructure where applicable.
- Delivery status.
- Bounce handling.
- Suppression mechanics.
- Deliverability operations.
- DKIM-related sending configuration where applicable.
- Email transport integrations.
- Delivery-level telemetry.

NMail should not own:

- ERP financial records.
- General campaign strategy.
- Universal audience segmentation.
- Every product's customer records.
- A separate campaign-management authority competing with Communicator.

Campaign orchestration can request delivery from NMail through an approved contract.

### 4.7 Collaboration Service

If the existing collaboration service is retained, it should own collaborative documents and related real-time collaboration capabilities.

It should not become another identity provider or an alternative source of truth for business records owned by other services.

Whether this service needs a separate repository should be decided after examining its deployment, dependencies, release lifecycle, and current implementation.

### 4.8 Workspace Web Application

A workspace shell may provide:

- A consistent entry point.
- Navigation between authorized modules.
- Organization selection.
- Module discovery.
- Service launch interfaces.

It should not independently determine whether a user is authorized to access an organization or service.

Authorization must be enforced server-side by the relevant services.

### 4.9 Campaign-Service Ownership

The existing ecosystem includes potential overlap between ERP marketing, Communicator broadcasts, and the campaign service inside `newcom`.

Before expanding any of these implementations, select one clear owner for campaign orchestration.

Recommended division:

- Communicator: communication and engagement workflows.
- NMail: email transport and delivery.
- ERP: operational and financial business records.
- Harvester: intelligence and lead-research records.

Campaign strategy and audience segmentation must have one explicitly designated owner rather than three competing implementations.

## 5. Harvester Operating Model

### 5.1 Organizations Are the Primary Business Context

Harvester is useful when an organization needs market intelligence, lead discovery, research, or qualification.

Examples include:

- A business finding prospective customers.
- A lead-generation agency researching prospects for clients.
- A sales organization qualifying opportunities.
- A research team building intelligence dossiers.

An agency is also an organization. It must use the same NEWAX identity and organization framework as other organizations.

### 5.2 Agency-to-Client Relationships

An agency may work for several client organizations.

This does not mean that the agency and its clients should be merged into one tenant.

The system must represent agency-to-client access as an explicit, revocable relationship with scoped permissions.

The relationship should define:

- Which agency organization is involved.
- Which client organization is involved.
- Which Harvester resources are accessible.
- Which actions are allowed.
- Whether data can be exported or shared.
- Which users may act on the relationship.
- When the relationship begins and ends.
- Who approved the access.
- How access is revoked and audited.

An agency must not automatically gain unrestricted access to a client's records merely because both organizations participate in NEWAX.

### 5.3 Lead Qualification Is Not Permission to Contact

Harvester must distinguish between:

1. Lead discovery.
2. Source verification.
3. Entity resolution.
4. Qualification.
5. Opportunity scoring.
6. Review and approval.
7. Contact eligibility.
8. Communication consent or other applicable lawful basis.
9. Publication to authorized destinations.
10. Actual outreach.

A high lead score is not proof of consent or permission to contact.

These are separate decisions and must not be collapsed into one AI-generated status.

### 5.4 Source Governance

A connector is not permission.

Before a data source is used, the implementation must account for:

- Access authorization.
- Permitted purpose.
- Source terms and redistribution restrictions.
- Data classification.
- Relevant privacy and legal requirements.
- Credential scope.
- Rate limits and usage costs.
- Retention requirements.
- Geographic restrictions where applicable.
- Approval requirements.
- Auditability.

Harvester must not bypass access controls or use unauthorized collection methods.

### 5.5 Harvester Data Ownership

Harvester should remain authoritative for its own research and intelligence records.

When a lead is approved for use by another module, Harvester publishes an approved representation through an authorized integration contract.

The receiving service remains responsible for its own records and workflows.

For example:

- Harvester discovers and qualifies a lead.
- Harvester preserves the evidence and qualification history.
- An authorized user or policy approves publication.
- Communicator may receive permitted contact context for an authorized outreach workflow.
- Communicator owns the resulting conversations and messages.
- Harvester may receive approved engagement outcomes through an explicit contract.
- ERP may receive relevant approved business records where a defined workflow requires it.

Each transfer must be authorized and traceable.

## 6. Identity, Organization, and Authorization

### 6.1 Identity Is Not Organization Membership

The architecture must distinguish:

- Person.
- nID account.
- Organization.
- Organization membership.
- Agency-to-client relationship.
- Brand.
- Service entitlement.
- User role.
- Action permission.
- Data scope.
- Active organization context.

These concepts are related but not interchangeable.

### 6.2 Authentication

nID authenticates the user using its supported, verified integration.

A downstream service must validate the identity or session using the agreed protocol. It must not blindly trust a user ID supplied by the frontend.

### 6.3 Organization Context

A request must resolve an authorized organization context.

The backend must verify:

- The user is authenticated.
- The user is allowed to access the organization.
- The user has the required service entitlement.
- The user has the necessary role and action permission.
- The requested record belongs to a scope the user may access.
- Any delegated agency-client relationship remains valid.

Never trust a client-supplied organization ID without server-side validation.

### 6.4 Brand Context

An organization may own multiple brands.

Brand must be a distinct entity if the business model supports multiple brands per organization.

Do not permanently model Brand as a one-to-one alias of Organization merely to simplify the first UI implementation.

Brand-specific knowledge, visual identity, customer-facing language, and service configuration must be scoped to the correct brand.

### 6.5 Service Entitlements and Permissions

These are separate checks:

- Is the service registered?
- Is the service approved for use?
- Is the service enabled for the organization or brand?
- Is the user authorized to access it?
- Is the user permitted to perform the requested action?
- Is the requested data within the user's authorized scope?

Passing one check does not imply that all the others pass.

### 6.6 Secure Module Launch

A visible module button is not proof that a secure session handoff exists.

The nID-to-Core-to-target-application launch flow must be implemented and tested before a service can be represented as successfully launched.

Until the secure session bridge is available, show an honest blocked or setup-required state.

Do not simulate successful POS access or pretend an authenticated session was created.

## 7. Cross-Service Integration Contract

### 7.1 Synchronous Requests

The target architecture uses the Core Module Gateway for ecosystem-mediated synchronous requests once it is implemented and verified.

Before relying on it, developers must confirm:

- The gateway exists in the target branch.
- Authentication is enforced.
- Authorization is enforced.
- Routes are registered and versioned.
- Organization context is validated.
- Timeouts and bounded retries are configured.
- Correlation IDs are available.
- Writes use appropriate idempotency protection.
- Audit records are produced.
- Failure behavior is documented.
- Contract tests pass.

If the gateway is not ready, use a documented, versioned API adapter as an interim arrangement. Do not pretend a planned gateway is already available.

### 7.2 Asynchronous Events

The target architecture uses the Core event infrastructure when implemented and verified.

Events should include appropriate fields such as:

- `event_id`
- `event_type`
- `schema_version`
- `occurred_at`
- `producer`
- Organization or tenant context where relevant.
- `correlation_id`
- The minimum payload required by authorized consumers.

Consumers must tolerate duplicate delivery and, where relevant, out-of-order events.

The system must define retry behavior, failed-message handling, idempotency, replay, monitoring, and schema evolution.

Do not place unnecessary personal or sensitive data in events.

### 7.3 Proposed Initial Contracts

These are proposed contracts, not a claim that the events already exist.

**`harvester.lead.approved.v1`**
Producer: Harvester.
Purpose: Publish approved lead or intelligence records to authorized destinations.
Requirements:

- Approval must be traceable.
- Source provenance must be preserved.
- Organization scope must be validated.
- Only permitted fields may be shared.
- Consumers must not treat lead approval as blanket contact consent.

**`harvester.lead.updated.v1`**
Producer: Harvester.
Purpose: Notify authorized consumers that a Harvester record has changed.
Requirements:

- Include a stable record reference.
- Include an update version.
- Preserve organization scope.
- Prevent duplicate downstream creation.

**`harvester.contact.suppressed.v1`**
Producer: The explicitly designated authority for the suppression decision.
Purpose: Communicate applicable suppression or deletion constraints to relevant systems.
Requirements:

- Identify the scope of the constraint.
- Record the reason and source where appropriate.
- Define propagation and acknowledgment behavior.
- Preserve an audit trail.
- Do not silently reverse suppression through automated enrichment.

**`communicator.engagement.outcome.v1`**
Producer: Communicator.
Purpose: Return authorized communication outcome information to Harvester where the business workflow requires it.
Requirements:

- Respect the permissions of both organizations.
- Share only approved outcome fields.
- Preserve correlation and provenance.
- Do not expose unrelated conversation content.

**`organization.access.changed.v1`**
Producer: The authoritative organization or access service, to be confirmed.
Purpose: Notify relevant subscribers of access changes where necessary.
Requirements:

- Define the authoritative producer.
- Include a version or sequence mechanism where appropriate.
- Ensure downstream services can invalidate stale access.
- Do not treat event delivery alone as the security enforcement mechanism.

## 8. Security and Data Boundaries

All services must follow these requirements.

1. Enforce tenant isolation in APIs, background workers, scheduled jobs, files, caches, search indexes, exports, and analytics queries.
2. Do not assume nID authentication proves organization membership or module authorization.
3. Do not share database-owner credentials across services.
4. Give each service least-privilege database and external-system credentials.
5. Record sensitive administrative actions, authorization denials, publication approvals, exports, suppression changes, and integration failures.
6. Use a verified secrets-management solution for credentials. Do not commit real secrets to code, example files, logs, or documentation.
7. AI may assist with extraction, classification, synthesis, and drafting. It must not independently authorize access, consent, publication, deletion, billing, or retention changes.
8. Use explicit permissions for consequential actions.
9. Do not use stealth browser automation, account farms, fingerprint evasion, CAPTCHA circumvention, or other methods that bypass access controls.
10. Ensure service-to-service calls are authenticated and auditable.
11. Treat cross-organization and agency-client access as an explicit authorization decision.
12. Make access revocation effective at the backend, not merely by hiding UI elements.

## 9. Existing Versus Missing: Verification Rules

The audit must distinguish four states.

**Present in repository:** Relevant code or documentation exists.
**Verified working:** The behavior has been demonstrated with appropriate tests or runtime evidence.
**Partial:** Some implementation exists, but required behavior, security, integration, or operational handling remains incomplete.
**Planned or blocked:** The capability is documented or desired but is not verified as implemented.

Developers must apply these labels to each module, route, API, event, migration, and integration.

### 9.1 Core

Verify:

- API and web foundations.
- Database and migration status.
- Module registry behavior.
- Whether module status is draft or approved.
- Gateway implementation and contract tests.
- Event infrastructure implementation and recovery behavior.
- Organization and membership ownership.
- Audit and monitoring behavior.
- Dependency security findings.

### 9.2 nID

Verify:

- Authentication flows.
- Session creation and validation.
- Logout and revocation behavior.
- Token expiry.
- OAuth configuration.
- Redirect URI allowlists.
- MFA where supported.
- Service-to-service identity.
- Secret storage and rotation where implemented.
- Production callback and domain configuration.

The existence of OAuth-related code does not by itself prove complete OpenID Connect compliance or a production-ready identity integration.

### 9.3 ERP

Verify each business module independently:

- Routes and APIs.
- Database tables and migrations.
- UI workflows.
- Authorization.
- Organization isolation.
- Tests.
- External integrations.
- Scheduled jobs.
- Runtime configuration.

Pay particular attention to CRM, support, notifications, identity verification, local user management, marketing, and RAG capabilities because they may overlap with other repositories.

### 9.4 Communicator

Verify:

- Conversation and message ownership.
- Channel integrations.
- Reply assistance.
- Automation behavior.
- Identity integration.
- Email transport integration.
- Billing overlap.
- Generic ticketing and SLA overlap.
- Webhook infrastructure overlap.
- Tenant isolation.
- Audit and operational visibility.

### 9.5 Harvester

Verify:

- nID integration.
- Organization and agency-client context.
- Source authorization.
- Research provenance.
- Entity resolution.
- Lead qualification.
- Approval workflow.
- Contact eligibility and suppression handling.
- Data retention and deletion.
- Cross-service publication.
- AI output evaluation.
- Tenant isolation across APIs, workers, files, and exports.

### 9.6 NMail and `newcom`

Verify:

- Email sending and delivery.
- Authentication and authorization for send requests.
- Credential management.
- SPF/DKIM/DMARC configuration where applicable.
- Bounce and suppression behavior.
- Delivery telemetry.
- Retry handling.
- Campaign-service overlap.
- Deployment and repository ownership.

### 9.7 Security Alerts

Previous audit evidence reported:

- Core: 68 Dependabot alerts as of 22 October 2026, including 7 critical and 23 high.
- Harvester: four high-severity Dependabot alerts as of 22 October 2026.

These are historical snapshot figures, not guaranteed current counts.

Developers must re-check the live repositories, assess exploitability, prioritize critical and high-severity findings, apply patches, run tests, and document any accepted risk.

## 10. Repository and Branch Governance

Before implementation:

1. Record the repository URL.
2. Record the default branch.
3. Record the exact commit SHA.
4. Confirm CI status.
5. Confirm deployment status.
6. Identify the relevant architecture documentation.
7. Identify the module's current owner.
8. Identify the source of truth for its data.
9. Inventory dependencies and consumers.
10. Record known security findings.

The previously observed nID default branch was:
`claude/nid-profile-management-141twl`

This differs from `main`. Developers must verify whether that is intentional before treating it as the canonical release branch.

The ecosystem documents have also used inconsistent repository counts. Establish one canonical inventory and count each repository consistently.

Do not rename repositories, change default branches, or merge feature branches merely to make names consistent. Use an explicit, reviewed migration plan.

## 11. Implementation Roadmap

### Phase 0: Baseline and Freeze

Tasks:

- Record the current branch and commit SHA for every repository.
- Run the available CI pipelines.
- Inventory modules, routes, database tables, migrations, jobs, events, environment variables, and dependencies.
- Identify deployed services and their actual configurations.
- Create one canonical repository inventory.
- Mark the old Harvester independence rule as superseded while preserving historical records.
- Re-check critical and high dependency alerts.

Exit criteria:

- A reviewed baseline exists.
- Every task references a specific repository and branch.
- Existing production dependencies are documented.
- No migration begins against an assumed or unverified code state.

### Phase 1: Lock the Identity and Organization Boundary

Tasks:

- Document the approved nID integration contract.
- Identify competing identity implementations.
- Define account, person, organization, membership, brand, and delegated access semantics.
- Design agency-to-client relationships and revocation.
- Define how services receive and validate organization context.
- Determine which service is authoritative for organizations, memberships, and authorization metadata.

Exit criteria:

- There is one agreed identity authority.
- Organization access is enforced server-side.
- Unauthorized cross-organization requests fail closed.
- Existing identity paths have a reviewed migration and rollback plan.

### Phase 2: Core Integration Foundation

Tasks:

- Inspect the actual Module Gateway implementation.
- Inspect the actual event infrastructure.
- Complete missing authentication, authorization, routing, and audit behavior.
- Define versioned API and event contracts.
- Add timeouts, retries, idempotency, and failure handling.
- Add monitoring and integration-level diagnostics.
- Use a documented interim adapter where Core capabilities are not yet production-ready.

Exit criteria:

- Integration contract tests pass.
- Duplicate events and retries do not create unsafe duplicate actions.
- Failed integrations are observable.
- No integration requires direct access to another service's private database.

### Phase 3: Integrate Harvester

Tasks:

- Connect Harvester to nID using the approved authentication contract.
- Connect Harvester to the authoritative organization and access framework.
- Preserve Harvester's ownership of intelligence and research records.
- Implement agency-client relationships with scoped permissions.
- Define source governance and contact eligibility rules.
- Publish approved lead records through versioned contracts.
- Add suppression, deletion, and engagement-outcome flows only when their authority and data rules are explicit.

Exit criteria:

- Cross-tenant isolation passes tests.
- Agency-client access is scoped and revocable.
- Published records preserve provenance and approval status.
- Replayed events do not create duplicate records.
- Unauthorized publication and outreach fail closed.

### Phase 4: Resolve Communicator and Email Ownership

Tasks:

- Replace local identity authority with the approved nID integration.
- Route email delivery through NMail.
- Resolve generic webhook ownership with Core.
- Resolve billing and ticketing/SLA overlap.
- Select one campaign orchestration owner.
- Preserve communication-specific data in Communicator.
- Split unrelated services from `newcom` only when the deployment and ownership plan is ready.

Exit criteria:

- There is no competing identity authority.
- Email transport has one designated owner.
- Campaign orchestration ownership is explicit.
- Communication data ownership is documented.
- Integrations and migration paths have tests.

### Phase 5: De-conflict ERP

Tasks:

- Inventory CRM, support, notification, messaging, identity verification, marketing, user management, and RAG capabilities.
- Trace all routes, imports, tables, jobs, and consumers before deciding to move a capability.
- Identify which functionality belongs to ERP, Communicator, nID, Core, or another explicitly designated service.
- Migrate one capability at a time.
- Preserve ERP ownership of its assigned business and financial records.

Exit criteria:

- No two services are authoritative for the same business fact.
- Migrated data has reconciliation evidence.
- Consumers have been updated and tested.
- Rollback remains possible until cutover is accepted.

### Phase 6: Workspace and Analytical Read Models

Tasks:

- Build module discovery from the approved registry.
- Build launch flows using authenticated identity and authorized organization context.
- Keep unavailable modules visibly blocked rather than pretending they launched.
- Build read-only cross-domain analytical projections only after event contracts and data ownership are established.
- Ensure analytics can reconcile with authoritative domain records.

Exit criteria:

- Module launch cannot bypass authorization.
- The UI accurately reflects module readiness.
- Analytical projections do not become write authorities.
- Data reconciliation and backfill are tested.

## 12. Mandatory Migration Safety Rules

1. Do not move code based only on directory names.
2. Trace route registration, imports, database tables, migrations, scheduled jobs, event consumers, permissions, secrets, files, and deployment dependencies.
3. Before moving a module, publish a module card containing:
   - Owner.
   - Source of truth.
   - Data tables.
   - API routes.
   - Permissions.
   - Events.
   - Dependencies.
   - Secrets.
   - Runtime jobs.
   - Tests.
   - Migration steps.
   - Rollback procedure.
4. Use the sequence: expand → migrate → verify → cut over → contract.
5. Do not perform destructive schema changes in the same release as an unverified consumer cutover.
6. Do not allow two services to remain authoritative for the same business fact.
7. Keep temporary compatibility layers read-only where possible and give them a retirement date.
8. Do not share database credentials as an integration shortcut.
9. Rotate any real secret found in Git history. Removing it from the latest commit is insufficient.
10. Preserve audit trails for identity, authorization, organization-context changes, financial actions, and sensitive data access.
11. Test tenant isolation, API contracts, migrations, end-to-end flows, and rollback before declaring a migration complete.
12. Tie release approval to the exact tested commit.

## 13. Developer Acceptance Checklist

A migration or module integration is complete only when the applicable checks pass.

**Ownership**

- Each module has one declared owning repository.
- Each domain has an identified source of truth.
- Each database and table has a clear owner.
- Overlapping CRM, messaging, campaign, identity, and webhook implementations have been reconciled.
- Repository boundaries and deployment ownership are documented.

**Identity and Access**

- All login flows use the approved nID integration.
- No product quietly creates a competing identity authority.
- Organization membership is validated server-side.
- Brand context is validated server-side where applicable.
- Agency-client access is scoped and revocable.
- Module entitlements and action permissions are separate checks.
- Cross-tenant access tests fail closed.
- Logout, expiry, revocation, and organization switching are tested.

**Integration**

- Every cross-service API has a versioned contract.
- Every event has an owner and schema version.
- Service-to-service authentication is enforced.
- Correlation and audit information are available.
- Retries and duplicate events are safe.
- Failed events and integrations are observable.
- No service accesses another service's private database directly.
- Core gateway and event infrastructure are proven working before being treated as production dependencies.

**Harvester**

- Harvester is registered and governed as a NEWAX module.
- Harvester uses the approved identity and organization framework.
- Research records preserve provenance.
- Agency-client boundaries are enforced.
- Lead qualification is not treated as consent.
- Publication requires the applicable approval and authorization.
- Suppression and deletion behavior is tested.
- AI-assisted decisions have the appropriate review and audit controls.

**Security and Operations**

- Critical and high dependency alerts have been triaged.
- Secrets are not exposed in source code, logs, or documentation.
- Permissions are enforced in background jobs, exports, and files as well as APIs.
- Monitoring and failure recovery are available.
- Migration reconciliation has been performed.
- Rollback steps have been tested or otherwise demonstrated.
- Documentation reflects actual implementation status.

## 14. Required Developer Reporting Format

For each module, report:

- Module name:
- Owning repository:
- Branch and commit SHA:
- Domain owner:
- Authoritative database/tables:
- Routes and APIs:
- Events produced:
- Events consumed:
- Authentication method:
- Organization and brand context:
- Permissions enforced:
- Dependencies:
- Implementation status: Present / Partial / Verified Working / Planned / Blocked
- Tests executed and results:
- Security findings:
- Migration required: Yes / No
- Migration plan:
- Rollback plan:
- Remaining blockers:
- Production readiness evidence:

Do not report a module as complete without listing the tests and evidence supporting that conclusion.

## 15. Source Repositories and Reference Documents

The following repositories and documents form the reference set for this handoff. Verify their current contents before implementation.

- Core repository: https://github.com/nadeemmurtaza/core-newax
- Core ecosystem audit and roadmap: https://github.com/nadeemmurtaza/core-newax/blob/main/docs/ecosystem/MODULE-AUDIT-AND-ROADMAP.md
- Core ecosystem map: https://github.com/nadeemmurtaza/core-newax/blob/main/ECOSYSTEM.md
- Core module registry: https://github.com/nadeemmurtaza/core-newax/blob/main/registry/module-registry.json
- ERP repository: https://github.com/nadeemmurtaza/erp-1
- ERP Start Here: https://github.com/nadeemmurtaza/erp-1/blob/main/START-HERE.md
- nID repository: https://github.com/nadeemmurtaza/nID
- Communicator repository: https://github.com/nadeemmurtaza/Communicator
- Communicator ecosystem document: https://github.com/nadeemmurtaza/Communicator/blob/main/ECOSYSTEM.md
- Harvester repository: https://github.com/Newax-Technologies/harvester
- Harvester ecosystem document: https://github.com/Newax-Technologies/harvester/blob/master/ECOSYSTEM.md
- Newcom repository: https://github.com/nadeemmurtaza/newcom
- AegisDesk repository: https://github.com/nadeemmurtaza/AegisDesk

## 16. Final Instruction to Developers

Build toward one coherent NEWAX ecosystem, not one giant codebase.

nID is the identity authority. Core provides verified shared infrastructure. ERP owns its assigned business operations. Harvester owns intelligence and lead-research records while operating as an integrated NEWAX module. Communicator owns communication workflows. NMail owns email delivery.

Keep domain data under the authority of its owning service. Enforce organization, brand, membership, and action permissions server-side. Use versioned, auditable integration contracts. Do not treat planned infrastructure as production-ready. Do not move code or data until ownership, security boundaries, migration steps, and rollback procedures are explicit.

The governing principle is:

> NEWAX should make business operations simpler by connecting dependable systems, while preserving clear ownership, security, and control.

NEWAX — The Business Infrastructure Company.

---

## 17. Ownership Decision Matrix

### 17.1 Authoritative ownership

The following matrix defines the intended ownership boundaries across NEWAX services. Repository implementation, existing APIs, and deployment status must be verified before treating any proposed capability as operational.

| Capability / responsibility                        | Owning service                                                                      | Other services may                                                    | Ownership rule                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Authentication and identity                        | **nID**                                                                             | Consume validated identity and authentication contracts               | No application creates a competing identity authority                                        |
| Sessions and authentication lifecycle              | **nID**                                                                             | Use supported session-validation and authentication flows             | No independent authentication workaround                                                     |
| Organization and membership authority              | **nID**, subject to verification of the existing organization model                 | Consume organization context and membership results                   | One authoritative organization model; do not create competing tenant records                 |
| Shared module registry and platform contracts      | **core-newax**                                                                      | Register, discover, and consume supported modules                     | Core provides shared infrastructure, not ownership of every business entity                  |
| Cross-service integration                          | **core-newax**, where the integration gateway or event infrastructure is confirmed  | Publish or consume authorized contracts                               | Integrations must use documented, versioned interfaces                                       |
| Business operations and ERP records                | **erp-1**                                                                           | Consume authorized business data through APIs or events               | ERP owns its operational records and domain rules                                            |
| Product catalogue                                  | **erp-1**, unless repository verification establishes a separate owner              | Consume approved catalogue data                                       | Do not duplicate catalogue authority across applications                                     |
| Orders and sales transactions                      | **erp-1**                                                                           | Consume permitted transaction summaries or events                     | One authoritative transaction record per defined business entity                             |
| Inventory and stock movements                      | **erp-1**                                                                           | Consume authorized stock availability and movement data               | Stock balances must not be independently maintained by multiple services                     |
| Point of sale                                      | **erp-1**, including its verified POS domain and transaction flow                   | Use supported identity, catalogue, inventory, and payment interfaces  | Do not report successful transactions before the authoritative operation succeeds            |
| Finance and accounting records                     | **erp-1**, subject to confirming the actual module boundary                         | Consume permitted financial records and summaries                     | Financial posting rules remain within the owning domain                                      |
| HR and workforce records                           | **erp-1**, subject to verifying current module scope                                | Consume authorized workforce information                              | Apply least-privilege access to employee data                                                |
| Conversations and messaging                        | **Communicator**                                                                    | Request authorized messaging and engagement operations                | Other services do not create competing conversation histories                                |
| Email transport and delivery                       | **NMail / `newcom`**, subject to repository verification                            | Submit authorized email-delivery requests and receive delivery status | Email transport ownership does not automatically include campaign strategy or lead ownership |
| Lead discovery, qualification, and source evidence | **Harvester**                                                                       | Consume approved lead outputs and evidence through contracts          | Harvester owns its discovery and qualification records                                       |
| Marketing campaign orchestration                   | **Campaign service**, if confirmed as a distinct service                            | Consume approved audience and engagement data                         | Resolve actual repository ownership before splitting or duplicating this capability          |
| Documents and real-time collaboration              | **Collaboration service**, if confirmed as a distinct service                       | Access authorized documents and collaboration features                | Verify whether this is a separate service or part of another repository                      |
| Workspace navigation and application launch        | **Workspace/web shell**, subject to verifying the actual repository split           | Launch modules using supported identity and authorization contracts   | The shell handles navigation; it does not become the authority for domain permissions        |
| Brand configuration                                | **Shared brand configuration package or explicitly designated configuration owner** | Import approved brand configuration                                   | Avoid duplicated application-level brand, locale, and design-system literals                 |
| Cross-service reporting and read models            | Designated reporting/read-model owner, to be decided                                | Consume authorized projections                                        | Read models are derived data, not replacement sources of truth                               |
| Security monitoring and vulnerability remediation  | Each repository's owning team; platform-level controls where designated             | Report findings and consume shared security tooling                   | A shared platform does not remove individual repository accountability                       |

### 17.2 Decision rights

| Decision                                                  | Accountable owner                                                       | Required consultation or validation                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Change identity or authentication contracts               | nID owner                                                               | Core and every affected consumer                                                          |
| Change shared platform contracts                          | Core owner                                                              | All affected service owners                                                               |
| Change ERP business rules or domain schema                | ERP owner                                                               | Consumers of affected contracts                                                           |
| Change lead qualification or source-evidence rules        | Harvester owner                                                         | Core and affected consumers                                                               |
| Change messaging or conversation semantics                | Communicator owner                                                      | Services using those contracts                                                            |
| Change email delivery behavior                            | NMail owner                                                             | Communicator and any other authorized consumers                                           |
| Introduce a new cross-service event or API                | Owner of the publishing domain, with Core coordination where applicable | All known producers and consumers                                                         |
| Split a capability between repositories                   | Existing owner plus designated architecture decision-maker              | Affected service owners; document the migration plan                                      |
| Introduce a second source of truth for an existing entity | **Not permitted without an explicit architecture decision**             | Architecture review, data migration plan, reconciliation rules, and rollback plan         |
| Change tenant or organization access rules                | nID and the affected resource-owning service                            | Security review and all affected consumers                                                |
| Mark an integration production-ready                      | Owner of the integration                                                | Evidence of authorization, contract compatibility, failure handling, and end-to-end tests |

### 17.3 Conflict-resolution rules

When two repositories appear to own the same capability, apply these rules in order:

1. **Preserve the existing source of truth.** Do not move ownership merely because another repository is easier to modify.
2. **Assign one domain owner.** Other services may consume data or request actions through supported interfaces.
3. **Separate shared infrastructure from business authority.** Core can provide common mechanisms without owning every domain record.
4. **Prefer contracts over database access.** A service must not read or write another service's private database directly.
5. **Keep authorization at the resource boundary.** Valid authentication alone does not grant access to an organization, brand, lead, transaction, or document.
6. **Resolve ambiguous ownership explicitly.** Record the decision, accountable owner, affected contracts, migration steps, and rollback conditions before implementation.
7. **Verify before declaring completion.** A planned owner, existing code, and a working production integration are three different states.

### 17.4 Required ownership metadata

Every cross-service capability must have a recorded owner and a defined interface. Maintain the following fields in the architecture register:

- Capability name and business purpose
- Authoritative service and repository
- Accountable technical owner
- Source-of-truth entities and data boundaries
- API or event contract and version
- Authorized consumers
- Authentication and organization/tenant authorization requirements
- Dependencies and failure behavior
- Current status: **Verified working**, **Present but unverified**, **Partial**, or **Planned/Blocked**
- Migration, compatibility, and rollback requirements

### 17.5 Approval rule

No new service, duplicate database, cross-repository dependency, or ownership transfer should be introduced solely to make an individual feature easier to implement. The change must preserve clear domain ownership, enforce organization-level authorization, reduce operational complexity, and maintain long-term control over NEWAX infrastructure.

**Architecture principle:** One authoritative owner per business capability, explicit contracts between services, and no hidden dependencies on another service's private implementation.

---

# NEWAX MULTI-TENANT ARCHITECTURE AND ENGINEERING RULES

**Classification:** Mandatory engineering requirements
**Applies to:** nID, Core, ERP, Harvester, Communicator, NMail, workspace applications, APIs, workers, integrations, and all future NEWAX modules.

## M1. Architectural objective

NEWAX is a multi-tenant business infrastructure ecosystem. It serves multiple independent customer organizations through shared platform capabilities while maintaining strict authorization, data isolation, and organizational boundaries.

Every service must preserve these principles:

1. A user's identity is distinct from their membership in an organization.
2. Every protected resource has a clear owner and access policy.
3. Organization context is explicitly resolved and authorized on the server.
4. Each domain service owns its records and enforces access to them.
5. Cross-organization access is denied unless an explicit, authorized relationship permits it.
6. Tenant isolation applies to APIs, databases, caches, files, events, background jobs, analytics, logs, exports, and backups.
7. Client-specific customization must not leak into other tenants or compromise safe upgrades.
8. A shared database or deployment must never be treated as proof of authorization.

## M2. Identity, organizations, and tenant context

### Identity authority

nID is the designated identity authority, subject to verification of the existing implementation.

The architecture must distinguish:

- **Person:** The real-world individual.
- **User identity:** The account used to authenticate.
- **Organization:** A business or other organizational entity.
- **Membership:** The relationship between a user and an organization.
- **Role and permissions:** The actions a user may perform within a defined scope.
- **Resource:** A record, document, conversation, transaction, or other protected object.
- **Tenant context:** The organizational security boundary under which an operation is performed.

Do not model a person, user, organization, and membership as interchangeable entities.

A user may belong to multiple organizations and have different roles in each. Membership in one organization must not automatically grant access to another.

### Organization context

Every organization-scoped operation must resolve an authorized organization context on the server.

The client may submit an organization identifier to indicate which workspace it intends to use. That identifier is a **selection, not proof of access**.

For every protected operation, the server must:

1. Authenticate the caller.
2. Resolve the requested organization context.
3. Verify the caller's active membership or other explicitly authorized access relationship.
4. Check the required permission for the operation.
5. Verify that the requested resource belongs to the authorized scope.
6. Apply the operation and record the appropriate audit event.

Never trust a client-supplied `tenant_id`, `organization_id`, role, permission list, or ownership field without server-side verification.

## M3. Tenant data isolation

Every domain service must enforce tenant isolation at its own resource boundary.

### Data ownership

- nID owns identity and its designated organization-access foundations.
- Core owns shared platform capabilities that have been explicitly assigned to it.
- ERP owns its designated business-operation records.
- Harvester owns its lead discovery, qualification, and source-evidence records.
- Communicator owns its designated conversation and messaging records.
- NMail owns its designated email transport and delivery records.

These are intended ownership boundaries. Confirm actual repositories, schemas, and service responsibilities before implementation.

### Data access rules

- Every tenant-owned record must have a reliable, enforceable ownership or access relationship.
- Related records must be checked against the same authorized organizational scope.
- A child record's identifier must not allow access to a parent or related record belonging to another tenant.
- Cross-tenant queries must be prohibited by default.
- Queries must not rely solely on frontend filtering to isolate tenant data.
- A record must not be reassigned to another tenant by changing an organization identifier in a request.
- Shared reference data must be explicitly classified as global, tenant-specific, or shared through a defined relationship.
- Global administrative access must be explicitly authorized, narrowly scoped, and audited.

Do not blindly add a `tenant_id` column to every table. First classify each entity by ownership, scope, lifecycle, and access requirements. Some entities are global; some belong to an organization; others inherit access through a parent or explicit relationship.

## M4. Database isolation strategy

NEWAX may use shared databases, separate schemas, or separate databases depending on the service and its requirements. The selected model must be documented and verified rather than assumed.

For shared relational databases:

- Use tenant-aware query patterns and enforce them consistently.
- Consider database-level row security where supported and appropriate.
- If row-level security is used, establish tenant context safely within each transaction and prevent connection-pool context leakage.
- Use tenant-aware uniqueness constraints where the business rule requires uniqueness within an organization.
- Enforce referential integrity so tenant-owned records cannot be linked across organizations accidentally.
- Ensure background tasks and maintenance operations cannot silently bypass required isolation.
- Use migrations that preserve existing ownership and correctly backfill organizational relationships.
- Test all relevant queries and write paths for cross-tenant access.

Database row security is defense in depth, not a replacement for application authorization.

For separate databases or dedicated deployments, retain application-level identity, authorization, and resource-ownership checks. Physical separation alone does not eliminate access-control defects.

## M5. Multi-tenant API requirements

Every protected API must define:

- Authentication requirements
- Organization-context resolution
- Required permissions
- Resource ownership validation
- Allowed cross-organization relationships
- Input validation
- Audit requirements
- Error behavior
- Rate and resource limits where relevant

An authenticated user must not be able to access another organization's resources by changing a URL identifier, request body, query parameter, or header.

Use consistent authorization middleware or shared libraries where appropriate, but retain enforcement in each service that owns the resource.

Service-to-service authentication must identify the calling service. The receiving service must also verify whether that service is permitted to perform the requested action for the relevant organization.

A service credential must not automatically grant access to every tenant.

## M6. Agency and client access

NEWAX must support legitimate business relationships, including agencies managing work for client organizations, without merging their data boundaries.

Represent such access through an explicit organization-to-organization relationship or delegated-access model.

Every delegated relationship must define:

- The granting organization
- The receiving organization
- The permitted capabilities and resources
- The allowed actions
- The applicable scope
- The activation and expiry rules, where applicable
- Revocation behavior
- Audit requirements

A user's access through an agency must not be inferred from their agency membership alone.

Lead qualification, record visibility, and a commercial relationship do not automatically grant permission to contact a person, export their information, or use their data for unrelated purposes.

Revoking a delegated relationship must prevent future unauthorized access across all applicable services, including APIs, workspace entry points, background jobs, and integrations. Define how cached authorization and already-issued credentials are invalidated.

## M7. Tenant isolation across the ecosystem

| Component               | Mandatory tenant requirement                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| nID                     | Resolve identity, organization membership, and scoped access without confusing authentication with authorization    |
| Core                    | Maintain shared platform boundaries; do not become a universal store for tenant business records                    |
| ERP                     | Enforce organization scope on catalogue, orders, inventory, POS, finance, HR, and other assigned domains            |
| Harvester               | Scope leads, evidence, saved searches, exports, and agency-client access to authorized organizations                |
| Communicator            | Scope conversations, messages, contacts, and engagement history to authorized organizations and participants        |
| NMail                   | Enforce authorization over sender identities, message metadata, delivery records, and tenant-specific configuration |
| Workspace               | Display and launch only modules and resources the current user is authorized to access                              |
| File and object storage | Enforce access to uploaded files, generated documents, attachments, and export artifacts                            |
| Cache and search        | Include appropriate organization scope in keys, filters, indexes, and authorization checks                          |
| Event infrastructure    | Validate event ownership, consumer authorization, tenant context, and delivery scope                                |
| Background workers      | Carry and validate trusted organization context; never process tenant data under an ambiguous global context        |
| Analytics and reporting | Prevent unauthorized aggregation, drill-down, exports, and inference across organizations                           |
| Logs and monitoring     | Minimize sensitive tenant data and restrict access to operational records                                           |
| Backups and restore     | Preserve tenant boundaries and define safe recovery and tenant-specific restoration procedures                      |

## M8. Caches, files, and background jobs

Tenant isolation must continue beyond the primary database.

### Caching

- Include the appropriate tenant or organization scope in tenant-specific cache keys.
- Never reuse a tenant-specific cached response across organizations without an explicit, validated sharing rule.
- Invalidate affected cached permissions and resource data after membership, role, or delegated-access changes.
- Test cache behavior with two or more organizations using identical resource identifiers where the storage model permits such collisions.

### Files and object storage

- Associate every tenant-owned object with an authoritative ownership or access record.
- Validate authorization before issuing downloads, uploads, previews, or signed URLs.
- Apply suitable expiration and scope restrictions to signed URLs.
- Prevent predictable object paths or filenames from acting as authorization.
- Ensure temporary files and generated exports retain their intended ownership.

### Background jobs

- Include explicit, validated organization context in tenant-scoped jobs.
- Derive authorization-relevant context from trusted server-side records, not arbitrary user-provided job payloads.
- Ensure retries and dead-letter processing preserve the original tenant scope.
- Make tenant-scoped jobs idempotent where appropriate.
- Ensure scheduled global jobs are explicitly classified and cannot accidentally expose or modify tenant data.

## M9. Events and integrations

Cross-service events must carry sufficient context to route and authorize processing without exposing unnecessary sensitive data.

Tenant-scoped event contracts should define, as applicable:

- Event identifier
- Event type and version
- Authoritative producer
- Organization scope
- Entity identifier
- Occurrence time
- Correlation identifier
- Schema and validation rules

Consumers must validate the event, verify the producer, enforce their own authorization and ownership rules, and handle duplicate delivery safely.

Do not treat an event's organization identifier as independent proof that its producer is entitled to act for that organization.

Never publish unrestricted tenant records to shared event streams simply because several services need some of the information. Prefer purpose-specific payloads and authorized retrieval through the owning service.

## M10. Global administrators and support access

Platform administration must be separated from ordinary tenant administration.

- A tenant administrator can manage only the organization and capabilities for which they have authority.
- A platform administrator must use explicitly granted platform permissions.
- Support access to customer data must be limited to a defined purpose and scope.
- Elevated access must be auditable and subject to appropriate approval and expiration controls.
- Cross-tenant support operations must not become an undocumented bypass around normal authorization.
- Administrative interfaces must clearly distinguish platform-level operations from tenant-level operations.

## M11. Tenant-aware customization

Use the following conceptual structure:

**Reusable NEWAX infrastructure + tenant configuration + authorized tenant extensions.**

- Keep reusable platform logic separate from client-specific behavior.
- Store tenant-specific settings under the appropriate organization scope.
- Define which configuration values are inherited, overridden, or prohibited.
- Prevent one tenant's branding, workflow rules, integrations, feature flags, or credentials from leaking into another tenant.
- Avoid tenant-specific forks of shared logic unless an explicit, versioned exception is approved.
- Ensure configuration changes are authorized, validated, audited, and upgrade-safe.
- Keep secrets out of ordinary configuration records and logs.

## M12. Mandatory multi-tenant testing

The test suite must include at least two independent organizations with separate users, memberships, roles, and data.

Test the following scenarios:

1. Organization A cannot read Organization B's records.
2. Organization A cannot update, delete, export, or enumerate Organization B's records.
3. Changing an identifier in a URL, query, header, or request body does not bypass authorization.
4. A user belonging to two organizations receives only the permissions associated with the selected authorized context.
5. Removing membership prevents subsequent unauthorized access.
6. Revoking delegated agency-client access prevents access through every supported route.
7. Cached responses and permission data cannot cross tenant boundaries.
8. Search, reporting, pagination, exports, and aggregate queries enforce the intended scope.
9. File access, signed URLs, and background jobs preserve ownership and authorization.
10. Events from one tenant cannot cause unauthorized actions in another tenant.
11. Duplicate events and retries do not create incorrect cross-tenant effects.
12. Tenant-specific uniqueness constraints and relationships behave correctly.
13. Global administrative operations require explicit authorization and create appropriate audit records.
14. Database migrations preserve tenant ownership and do not orphan or expose records.
15. Tenant-specific configuration and secrets remain isolated.
16. Error messages do not reveal protected information about another organization's resources.

Use automated negative tests and, where feasible, database-level enforcement tests. A successful happy-path test is not evidence of tenant isolation.

## M13. Stop conditions

Stop implementation and reassess if:

- The authoritative organization model is unclear.
- A service cannot determine the authorized scope of a protected resource.
- A service depends on unrestricted access to another service's database.
- A cache, event, file, job, or export can bypass tenant authorization.
- A migration cannot reliably establish existing records' ownership.
- A cross-tenant access test fails.
- A shared administrative credential bypasses required tenant restrictions.
- Existing behavior conflicts with these requirements and no approved migration plan exists.

Do not resolve a tenant-isolation defect by hiding the affected UI, relying on client-side filtering, or adding an undocumented exception.

## M14. Definition of done

A multi-tenant feature is complete only when:

- Its ownership and scope are documented.
- Authentication and authorization are verified.
- Tenant isolation is enforced by the resource-owning service.
- Relevant database, cache, file, event, and job boundaries are tested.
- Positive and negative authorization tests pass.
- Migrations and existing data have been verified.
- Relevant audit and monitoring behavior is implemented.
- Documentation matches the actual implementation.
- The final status distinguishes verified behavior from assumptions and remaining work.

**Permanent rule:** No tenant may access, alter, infer, or control another tenant's data or operations unless an explicit, authorized, scoped, and auditable relationship permits that exact action.
