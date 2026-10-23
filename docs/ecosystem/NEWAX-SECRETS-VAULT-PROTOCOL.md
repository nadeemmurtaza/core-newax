# NEWAX CENTRAL SECRETS VAULT

## Engineering Architecture, Security, Migration and Implementation Protocol

**Document Type:** Mandatory Engineering Specification
**Organization:** NEWAX (SMC-PRIVATE) LIMITED
**System:** NEWAX Business Infrastructure Ecosystem
**Status:** Proposed architecture. Implementation requires audit, approved decisions, and verification.
**Priority:** Security-critical infrastructure
**Applies To:** All NEWAX repositories, services, deployments, environments, integrations, CI/CD pipelines, and tenants.

---

## 1. Executive Directive

NEWAX must establish a centralized, secure, auditable secrets-management system for the entire Business Infrastructure ecosystem.

The system must provide one governed mechanism for storing, accessing, rotating, revoking, and auditing sensitive credentials without requiring every application to maintain its own unmanaged collection of secrets.

The vault must support:

- Database passwords and connection credentials.
- API keys and access tokens.
- OAuth client secrets and refresh tokens.
- Application signing keys.
- Encryption keys and certificates.
- SMTP credentials and email-provider tokens.
- Payment-provider credentials.
- Webhook signing secrets.
- Cloud, storage, and infrastructure credentials.
- Service-to-service authentication credentials.
- Customer-specific integration credentials.
- CI/CD and deployment credentials.
- Other sensitive operational configuration identified during the audit.

**Core principle: Centralize secret governance, not unrestricted secret access.**

Every application, employee, automation, and deployment process must receive only the credentials required for its authorized responsibilities.

The vault is not a replacement for nID. nID remains the intended identity and organization authority, subject to verification of its current implementation. The vault is a separate security service with its own authentication, authorization, encryption, audit, backup, and recovery controls.

### 1.1 Non-negotiable rules

1. Actual secrets must never be committed to Git.
2. Private repositories must not be treated as secure secret storage.
3. No application may receive unrestricted access to the entire vault.
4. No tenant may access another tenant's secrets without an explicitly authorized and audited mechanism.
5. No developer may silently change production credentials or authentication architecture.
6. No secret may be logged, exposed in an API response, included in an exception, or embedded in generated documentation.
7. Existing credentials must not be revoked until dependent systems have migrated and the replacement has been verified.
8. All implementation claims must be supported by evidence from the actual repository and running infrastructure.
9. Security-sensitive changes require tests, rollback planning, and documented operational procedures.
10. The vault itself must not depend on a circular authentication process that prevents recovery when nID or another dependency is unavailable.

---

## 2. Architectural Boundaries

NEWAX must preserve clear ownership across its ecosystem.

| Component                 | Responsibility                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| nID                       | User identity, organization identity, memberships, roles, and permission authority, according to verified contracts |
| Central secrets vault     | Secret storage, access policies, credential issuance, rotation, revocation, and secret-access auditing              |
| Core                      | Shared business infrastructure and platform capabilities owned by Core                                              |
| ERP                       | ERP business operations and domain data                                                                             |
| Harvester                 | Its verified operational domain and authorized integrations                                                         |
| Communicator              | Communication services and associated integrations                                                                  |
| NMail                     | Email service and associated integrations                                                                           |
| Other services            | Their own business responsibilities and explicitly assigned credentials                                             |
| Deployment infrastructure | Workload execution, secret delivery, network boundaries, service authentication, and runtime configuration          |

The exact service responsibilities must be verified against current repositories and deployments before implementation.

### 2.1 Separate control planes

The following responsibilities must remain distinct:

- Identity proves who or what is requesting access.
- Authorization determines which resources that identity can access.
- The vault protects secret material and enforces secret-access policies.
- Applications perform their assigned business operations.
- Deployment infrastructure provides the environment in which services run.

nID may authenticate a user or workload where appropriate, but the vault must not trust an arbitrary user ID, organization ID, HTTP header, or client-supplied claim as sufficient proof of authorization.

### 2.2 Repository placement

Do not store the entire vault implementation or its production secrets inside the nID application repository merely because nID is the identity authority.

Evaluate a dedicated infrastructure repository, such as:

`newax-secrets-infrastructure`

The final repository name must be approved after reviewing existing repository conventions.

That repository may contain:

- Infrastructure-as-code.
- Sanitized configuration templates.
- Secret policy definitions.
- Deployment manifests.
- Access-control policy templates.
- Documentation.
- Automated security tests.
- Non-sensitive bootstrap procedures.
- Recovery and operational runbooks.

It must not contain:

- Actual production `.env` files.
- Vault root tokens.
- Unencrypted recovery keys.
- Private signing keys.
- Customer credentials.
- Database passwords.
- Exported secret-store contents.

Actual secret values belong in the vault or another explicitly approved secure storage mechanism.

---

## 3. Phase 0: Mandatory Discovery and Baseline Audit

No production migration begins before the current state is understood.

### 3.1 Audit every relevant repository

At minimum, inspect the six previously identified core repositories:

- nID.
- core-newax.
- erp-1.
- Communicator.
- Harvester.
- NMail within the newcom repository structure, subject to verification.

Also inspect related deployment repositories, shared packages, campaign services, collaboration services, workspace applications, infrastructure configurations, and CI/CD definitions where they exist.

Do not assume that the six-repository list is exhaustive.

### 3.2 Inventory existing secret usage

For each repository and deployed service, document:

- Environment variables and their purposes.
- Where actual values are currently stored.
- Which components consume each variable.
- Whether a value is a credential, public configuration, or ordinary application data.
- The environment in which it is used.
- The credential's owner and issuing provider.
- Its privileges and scope.
- Whether rotation is supported.
- Whether the credential is shared between services.
- Whether the secret appears in Git history.
- Whether the credential appears in logs, CI output, artifacts, or backups.
- Dependencies that would fail if the credential changed.
- Existing fallback behavior and failure modes.

Do not copy actual secret values into the inventory. Record secret references, classifications, and sanitized fingerprints where useful.

### 3.3 Search safely

Use approved secret-scanning tools against current working trees, repository history, deployment files, CI/CD configuration, and available logs.

Do not print discovered credentials into terminal output, issue descriptions, pull requests, or chat.

Scanning tools must use redacted output and secure reporting channels. Test the scanner against synthetic credentials before relying on it.

If an exposed credential is discovered, treat it as potentially compromised. Assess its scope and rotate or revoke it through a controlled incident procedure.

Removing a secret from the latest commit does not remove it from previous Git history, cloned repositories, logs, or artifacts.

### 3.4 Required baseline deliverables

Before implementation, produce:

1. Repository and service inventory.
2. Secret classification inventory without secret values.
3. Credential ownership map.
4. Dependency and rotation-impact map.
5. Current authentication and authorization flow.
6. Current deployment and CI/CD secret-delivery flow.
7. Existing security gaps and exposure findings.
8. Proposed vault deployment architecture.
9. Recovery and rollback plan.
10. Approved architecture decision record.

Each finding must be labeled as verified, inferred, proposed, or unresolved.

**Phase 0 is complete only when the team can explain where secrets currently live, which workloads use them, and how each affected system can be migrated without an uncontrolled outage.**

---

## 4. Phase 1: Select and Design the Vault

### 4.1 Evaluate candidate implementations

Evaluate OpenBao and HashiCorp Vault as initial candidates. The final selection must be based on verified operational requirements, licensing, support needs, integrations, deployment constraints, and maintenance capability.

Compare:

- Encryption and key-management model.
- Authentication methods.
- Workload identity support.
- Fine-grained access policies.
- Dynamic credential issuance.
- Secret rotation and revocation.
- Audit capabilities.
- High availability.
- Backup and disaster recovery.
- Integration with Docker, CI/CD, and the actual deployment platform.
- Operational complexity and upgrade procedures.

Do not choose a technology solely because it is open source or familiar.

### 4.2 Define the storage model

Separate secrets into logical namespaces or equivalent access-controlled paths.

Illustrative structure:

`secret/platform/<environment>/...`

`secret/services/nid/<environment>/...`

`secret/services/core/<environment>/...`

`secret/services/erp/<environment>/...`

`secret/services/communicator/<environment>/...`

`secret/services/harvester/<environment>/...`

`secret/services/nmail/<environment>/...`

`secret/integrations/<provider>/<environment>/...`

`secret/tenants/<tenant-reference>/<integration>/...`

These are examples, not prescribed paths for a particular vault engine. Adapt them to the selected implementation's security model.

The path structure must not be the sole authorization mechanism. Enforce permissions using the vault's actual access-control system.

Production, staging, development, and testing secrets must be separated by policy and, where justified by the threat model, by independent vault instances or security boundaries.

Production credentials must never be copied into development or test environments.

### 4.3 Define secret metadata

For each managed secret, maintain appropriate metadata:

- Stable secret identifier.
- Owning service or team.
- Environment.
- Credential type.
- Issuing provider or system.
- Authorized workload identities.
- Tenant scope, if applicable.
- Creation and last-rotation timestamps.
- Expiration or rotation policy.
- Dependencies and migration notes.
- Revocation procedure.
- Classification and operational criticality.

Metadata must not contain the secret value or other sensitive material.

---

## 5. Phase 2: Vault Security and Key Management

### 5.1 Encryption

Secret material must be encrypted in transit and at rest.

Use maintained cryptographic implementations and approved protocols. Do not implement custom cryptography.

The design must specify:

- Transport encryption and certificate validation.
- Vault storage encryption.
- Encryption-key ownership and lifecycle.
- Key-encryption-key separation where applicable.
- Secure key initialization.
- Rotation and recovery of encryption keys.
- Protection against unauthorized administrative access.

Where the chosen vault supports an external key-management service or hardware-backed key protection, evaluate whether the additional control is justified.

### 5.2 Bootstrap and root credentials

The vault must not bootstrap itself using a permanent root token stored inside the same repository or deployment manifest that starts it.

Establish a controlled initialization procedure that includes:

- Restricted initialization access.
- Secure generation and distribution of initial credentials.
- Separation of duties for critical recovery material.
- Storage of recovery material outside the vault's normal failure domain.
- Explicit ownership and access procedures.
- Audited emergency access.
- Revocation or retirement of bootstrap credentials after initialization where supported.
- Documented recovery and reinitialization procedures.

Never assume that splitting a root token or recovery material is automatically required or automatically sufficient. Follow the selected vault's documented security model.

### 5.3 Network security

The vault must not be publicly accessible without a deliberately approved architecture.

Required controls:

- Restrict network access to approved workloads and administrative entry points.
- Use authenticated and encrypted connections.
- Enforce certificate validation.
- Avoid exposing management ports to the public internet.
- Restrict outbound connectivity.
- Protect administrative interfaces.
- Rate-limit or otherwise protect exposed authentication endpoints where applicable.
- Monitor unusual access attempts.
- Document network dependencies and firewall rules.

Network location alone must never establish authorization.

### 5.4 Administrative access

Define separate permissions for:

- Vault administrators.
- Security auditors.
- Platform operators.
- Application workload identities.
- Developers using approved non-production environments.
- Incident responders.

A person authorized to deploy a service must not automatically be authorized to read every production secret.

Administrative access must be attributable to an individual or explicitly identified workload, restricted to its purpose, and audited.

---

## 6. Phase 3: Workload Authentication and Access Policies

### 6.1 Every service has its own identity

Each service must authenticate to the vault using a supported workload authentication mechanism.

Preferred options depend on the environment and may include:

- Workload identity.
- Short-lived authenticated tokens.
- Machine identity with controlled issuance.
- Platform-native workload authentication.
- A carefully managed alternative where stronger mechanisms are unavailable.

Do not distribute one permanent, ecosystem-wide vault token to every application.

A compromised service must not automatically inherit the privileges of other services.

### 6.2 Least privilege

Define explicit read, write, rotation, and administrative permissions.

For example:

- ERP may read its database credentials and explicitly approved integration secrets.
- Communicator may read its communication-provider credentials.
- NMail may read its email-service credentials.
- nID may read only the credentials needed for its own operations.
- CI/CD may access the credentials required for an approved deployment, without obtaining general read access to unrelated production secrets.
- Developers may use approved development credentials but do not automatically receive production secret access.
- Auditors may inspect permitted audit records without reading secret values.

The examples above must be adapted to actual dependencies discovered during Phase 0.

### 6.3 No arbitrary secret proxy

Do not build a general-purpose endpoint in nID that allows callers to request any secret by providing a path or key name.

If an application needs a credential, authorize the requesting workload and the exact permitted secret. Avoid returning arbitrary secret values through a shared application API.

Where possible, workloads should authenticate directly to the vault using approved workload credentials. If a broker service is necessary, give it narrowly scoped authority and document why direct access is unsuitable.

### 6.4 Revocation

The architecture must support disabling a workload's vault access without unnecessarily disabling unrelated services.

Revocation procedures must cover:

- Compromised service identities.
- Departing developers or administrators.
- Leaked tokens.
- Terminated customer integrations.
- Decommissioned services.
- Expired or replaced certificates.
- Emergency access removal.

Test that revocation actually prevents further access.

---

## 7. Phase 4: Multi-Tenant Secret Isolation

NEWAX is a multi-tenant ecosystem. Tenant-specific credentials require special protection.

### 7.1 Distinguish secret classes

Every secret must be classified into one of these categories:

**Platform secrets**

Used by shared infrastructure, such as platform-level database administration or encryption infrastructure.

**Service secrets**

Used by a specific application or workload.

**Tenant integration secrets**

Credentials belonging to, or used on behalf of, a particular customer organization.

**User-delegated credentials**

Credentials granted by an individual or organization through an explicitly authorized integration flow.

The exact ownership and permitted use of a credential must be documented. Do not assume that every credential supplied by a customer belongs to NEWAX or can be reused for unrelated purposes.

### 7.2 Tenant authorization

A tenant identifier is not proof of authorization.

When a tenant-scoped operation occurs, the system must establish:

1. The requesting workload or user is authenticated.
2. The relevant organization is resolved using trusted identity and authorization contracts.
3. The requesting principal has permission to perform the requested action for that organization.
4. The secret belongs to the authorized scope.
5. The requested operation is permitted by the vault policy.
6. Access is recorded in the appropriate audit trail.

Never rely solely on a client-supplied organization ID, a URL parameter, a request header, or a database lookup that does not enforce tenant ownership.

### 7.3 Tenant secret access

Customer-specific secrets must be isolated using explicit access policies and tenant-aware identifiers.

Do not grant a general application workload permission to read all tenant secrets merely because it serves multiple tenants.

If an application legitimately needs to process multiple tenants, use a controlled mechanism that verifies the tenant context and restricts the exact operation.

Avoid exposing raw secret values to front-end clients. Prefer server-side use, scoped operations, or delegated authorization that does not disclose the underlying credential.

### 7.4 Tenant lifecycle

Define behavior for:

- Organization creation.
- Integration authorization.
- Secret creation and update.
- Credential rotation.
- Permission changes.
- Integration disconnection.
- Organization suspension.
- Organization deletion.
- Contract termination.
- Legal retention requirements.

Revoking an integration must prevent new use of its credentials. Handle external-provider revocation where supported and authorized.

Do not automatically delete credentials or audit records until applicable retention and recovery requirements are understood.

### 7.5 Agency and delegated access

Where NEWAX supports agencies, operators, or organizations acting on behalf of clients, model that authority explicitly.

A relationship between two organizations does not automatically grant access to every credential owned by either organization.

Define permitted actions, tenant scope, expiry, revocation, and auditing for delegated access.

---

## 8. Phase 5: Application Integration

### 8.1 Standard secret-consumption interface

Create a shared, documented approach for services to consume secrets.

The interface must define:

- Authentication to the vault.
- Secret reference conventions.
- Retrieval permissions.
- Startup behavior.
- Refresh and rotation behavior.
- Error handling.
- Timeout and retry limits.
- Redaction requirements.
- Local development behavior.
- Testing and mocking.
- Operational diagnostics.

Do not create a custom secret-management implementation independently in every repository.

A shared library may be appropriate if it does not couple every service to one application's internal code or create an unnecessarily broad dependency. A small, stable integration contract may be preferable to a shared library when runtimes differ.

### 8.2 Avoid hard-coded secrets

Applications must not contain secret values in:

- Source code.
- Dockerfiles.
- Container image layers.
- Front-end bundles.
- Committed configuration files.
- Example files.
- Test fixtures.
- Generated code.
- Documentation.
- Shell scripts.
- CI/CD definitions.

Secret references and non-sensitive configuration may be committed.

### 8.3 Environment variables

Environment variables may remain a compatible delivery mechanism for applications that require them. They must not become the authoritative long-term secret store.

The preferred flow is:

**Vault → authenticated deployment or workload mechanism → application runtime**

Where appropriate, retrieve secrets directly at runtime. For other services, inject secrets through a protected deployment mechanism or restricted in-memory/file delivery.

Avoid placing secret values in command-line arguments, build arguments, diagnostic endpoints, process listings, or broadly readable temporary files.

If a secret must be written to a file, restrict permissions, minimize its lifetime, prevent accidental inclusion in images and backups, and clean it up safely.

### 8.4 Startup and failure behavior

Define behavior when the vault is unavailable.

For every service, decide:

- Which credentials are required to start.
- Whether already-authorized operations may continue temporarily.
- Whether a missing or expired credential must block startup.
- How readiness and liveness are reported.
- How recovery occurs when the vault returns.
- How cached secret material is invalidated.

Never silently fall back to hard-coded credentials or weaker authentication when vault access fails.

A service must not report itself as fully operational if a required credential is unavailable and its core functionality cannot work.

### 8.5 Secret caching

Cache only when necessary and justified.

Define:

- Maximum cache lifetime.
- Refresh behavior.
- Rotation awareness.
- Memory protection.
- Cache isolation by service and tenant.
- Invalidation behavior.
- Failure behavior during refresh.

Never allow a tenant-specific secret retrieved for one request to leak into another tenant's request through shared mutable state or a cache-key collision.

---

## 9. Phase 6: Dynamic Credentials and Rotation

### 9.1 Prefer short-lived credentials

Where supported, use dynamically issued or short-lived credentials instead of permanent static credentials.

Examples include database credentials, workload tokens, and provider credentials that support delegated or temporary access.

Do not promise dynamic rotation for a provider or system that does not support it.

### 9.2 Rotation policy

Create a policy for every secret category based on its risk, exposure, provider capabilities, and operational impact.

The policy must define:

- Rotation trigger.
- Rotation procedure.
- Responsible owner.
- Validation step.
- Consumer refresh behavior.
- Rollback or recovery behavior.
- Revocation of old credentials.
- Audit evidence.

Rotate immediately when compromise is suspected or confirmed.

### 9.3 Zero-downtime rotation

For production credentials, use a staged process where supported:

1. Create or issue the replacement credential.
2. Store it securely.
3. Grant the required workload access.
4. Update or refresh consumers.
5. Verify real operations using the new credential.
6. Monitor failures and unexpected access.
7. Revoke the previous credential only after successful verification.

If the provider supports only one active credential, document the expected disruption and obtain approval before changing it.

Never revoke the old credential simply because a deployment command succeeded. Verify the dependent service's actual behavior.

---

## 10. Phase 7: CI/CD and Developer Workflows

### 10.1 CI/CD requirements

Pipelines must not print secret values or expose them through unrestricted build logs, artifacts, caches, or test reports.

Use narrowly scoped, short-lived credentials for deployment whenever practical.

Separate:

- Pull-request validation.
- Development deployment.
- Staging deployment.
- Production deployment.
- Emergency recovery.

Untrusted pull-request code must not receive production secrets.

A pipeline must not have broad secret-read permission merely because it builds multiple repositories.

### 10.2 Local development

Developers must receive a documented, safe local setup.

Provide:

- `.env.example` files containing variable names and safe placeholders.
- Setup instructions.
- Non-production credentials through an approved mechanism.
- Test doubles or local services where suitable.
- Clear failure messages when required configuration is missing.

Do not require developers to copy production `.env` files into their machines.

### 10.3 Repository hygiene

Add or improve:

- Secret scanning in pull requests.
- Secret scanning of relevant Git history.
- Pre-commit detection where practical.
- CI checks for prohibited credential patterns.
- Redacted security findings.
- Incident procedures for accidental exposure.

Scanner findings must be reviewed carefully to avoid both false confidence and unnecessary exposure of the finding itself.

If a secret is committed, rotate it as appropriate even if the commit is later removed or rewritten.

---

## 11. Phase 8: Audit Logging and Monitoring

### 11.1 Audit events

Record appropriate metadata for:

- Authentication attempts.
- Secret reads and writes.
- Secret creation and deletion.
- Policy changes.
- Credential issuance and revocation.
- Rotation events.
- Administrative actions.
- Recovery operations.
- Denied access attempts.
- Unexpected changes to vault configuration.

Logs should identify the principal, action, target reference, time, result, and relevant context without revealing secret values.

### 11.2 Protect the audit trail

Audit records must be protected from unauthorized modification and deletion.

Separate access to audit records from the privileges required to read secrets.

Where practical, forward logs to a separately protected monitoring system. A compromised vault must not automatically grant an attacker unrestricted control over the only record of its activity.

### 11.3 Alerting

Create alerts for suspicious patterns, including:

- Repeated failed authentication.
- Unexpected bulk secret reads.
- Access from unapproved workloads.
- Privilege escalation or policy modification.
- Root or emergency credential usage.
- Unexpected tenant-scope access.
- Rotation failures.
- Audit pipeline failure.
- Unusual administrative activity.

Document who receives alerts and what response is expected. An alert that nobody owns is decorative logging.

---

## 12. Phase 9: Backup, Recovery and High Availability

### 12.1 Recovery requirements

The vault must remain recoverable without depending exclusively on the system it protects.

Document:

- Backup frequency.
- Backup encryption.
- Backup access controls.
- Recovery material storage.
- Retention policy.
- Recovery point objective.
- Recovery time objective.
- Disaster scenarios.
- Recovery responsibilities.
- Recovery testing schedule.

### 12.2 Independent recovery

The vault's recovery process must not require a functioning nID instance if nID is itself unavailable, unless a separately documented recovery mechanism can authenticate administrators safely.

Use a tightly controlled break-glass process with independent authentication and auditability.

### 12.3 Test restoration

A successful backup job does not prove recoverability.

Perform a controlled restore into an isolated environment and verify that:

- Vault data is recoverable.
- Required key material is available.
- Policies are intact.
- Workload authentication works.
- Audit records remain usable.
- Applications can recover their required secrets.
- Recovery does not expose production secrets to unauthorized environments.

Never test disaster recovery by experimenting on the production vault without an approved procedure.

---

## 13. Phase 10: Migration of Existing Secrets

Migration must be controlled, incremental, and reversible until the cutover is verified.

### 13.1 Migration order

Use this sequence:

**Step 1: Inventory**

Map every existing credential to its owner, consumers, scope, and environment.

**Step 2: Classify**

Identify platform, service, tenant, and user-delegated credentials.

**Step 3: Establish the vault**

Deploy and harden the vault, configure authentication and policies, and verify recovery.

**Step 4: Pilot**

Migrate one low-risk non-production service first.

**Step 5: Validate**

Test retrieval, authorization, rotation, failure handling, logging, and deployment behavior.

**Step 6: Migrate production services**

Migrate one service or well-defined credential group at a time, following dependency order.

**Step 7: Rotate exposed credentials**

Where necessary, replace credentials that were previously exposed or insufficiently protected. Do not merely copy a potentially compromised secret into the vault and declare victory.

**Step 8: Verify**

Run integration and operational tests against the actual deployed services.

**Step 9: Revoke old credentials**

Revoke superseded credentials only after all known consumers are confirmed to use the replacement.

**Step 10: Clean up**

Remove obsolete secret copies from active configuration and safely address historical exposure in repositories, logs, artifacts, and backups.

### 13.2 Do not perform a blind bulk migration

Do not move every `.env` file into one central directory or repository and treat that as the completed solution.

Different variables may have different owners, privileges, lifecycles, and security classifications.

Public configuration such as a public application URL is not a secret simply because it appears in an `.env` file. Classify each value appropriately.

Conversely, a private credential does not become safe merely because its filename is different.

### 13.3 Rollback

For every migration, document:

- Previous credential reference.
- New credential reference.
- Consumer cutover status.
- Validation results.
- Rollback trigger.
- Recovery procedure.
- Old credential revocation status.

Rollback must never require publishing a secret or reintroducing it into Git.

If the old credential is known to be compromised, do not restore it as a normal fallback.

---

## 14. Phase 11: Required Security Tests

Create automated tests for vault access policies and integration behavior.

### 14.1 Authorization tests

Verify that:

- An unauthenticated workload cannot read secrets.
- An authenticated but unauthorized workload is denied.
- ERP cannot read unrelated service credentials.
- nID cannot read arbitrary application secrets.
- Development workloads cannot read production secrets.
- CI jobs cannot access unrelated production credentials.
- Revoked workloads cannot continue accessing protected secrets.
- A tenant cannot read another tenant's integration credentials.
- Client-supplied organization IDs cannot bypass authorization.
- Administrative privileges are separated and audited.

### 14.2 Leakage tests

Verify that secrets do not appear in:

- Application logs.
- Error responses.
- Debug output.
- HTTP responses.
- Front-end bundles.
- Container image layers.
- Build artifacts.
- Test reports.
- Monitoring labels.
- Exception traces.
- Committed documentation.
- Repository history after the approved cleanup procedure.

Use synthetic credentials and canary values to verify redaction.

### 14.3 Rotation and failure tests

Verify that:

- A secret can be rotated through the approved procedure.
- Consumers successfully use the replacement.
- Expired credentials are rejected where expected.
- Revocation takes effect.
- Vault downtime produces the documented behavior.
- Services do not fall back to embedded credentials.
- Recovery restores the expected policies and functionality.
- Tenant-scoped caches do not leak secrets between organizations.
- Duplicate or concurrent operations do not corrupt secret metadata.

### 14.4 Multi-tenant tests

Use at least two independent test organizations with separate integration credentials.

Test authorized and unauthorized operations, membership revocation, delegated access, tenant deletion or suspension, secret rotation, and concurrent requests.

Every test must prove that the system enforces authorization at the appropriate trusted boundary, not merely that the UI hides an action.

---

## 15. Phase 12: Documentation and Operational Ownership

Create and maintain documentation covering:

1. Architecture overview.
2. Technology selection and decision record.
3. Deployment and configuration.
4. Secret naming and classification.
5. Authentication and authorization policies.
6. Developer setup.
7. Service integration.
8. Tenant-specific secret handling.
9. Rotation and revocation.
10. Incident response.
11. Backup and disaster recovery.
12. Monitoring and alerting.
13. Migration status.
14. Known limitations.
15. Upgrade and maintenance procedures.
16. Service ownership and escalation paths.

Assign an accountable owner for the vault, policies, operational maintenance, recovery, and security incidents.

Do not leave the vault as an undocumented system that only one developer understands.

---

## 16. Implementation Roadmap

Follow the phases in order. Do not skip the baseline audit.

| Phase | Deliverable                                         | Completion gate                                               |
| ----- | --------------------------------------------------- | ------------------------------------------------------------- |
| 0     | Repository, secret, dependency and deployment audit | Inventory reviewed and gaps documented                        |
| 1     | Vault technology decision and architecture record   | Security and operational design approved                      |
| 2     | Hardened vault deployment                           | Encryption, bootstrap, network and recovery controls verified |
| 3     | Workload authentication and access policies         | Least-privilege tests pass                                    |
| 4     | Tenant isolation model                              | Cross-tenant negative tests pass                              |
| 5     | Shared integration contract                         | Pilot service consumes secrets securely                       |
| 6     | Rotation and lifecycle mechanisms                   | Rotation and revocation verified                              |
| 7     | CI/CD and developer workflow                        | No production-secret exposure in build workflows              |
| 8     | Audit and monitoring                                | Events, alerts and ownership verified                         |
| 9     | Backup and recovery                                 | Isolated restoration test passes                              |
| 10    | Incremental migration                               | Each migrated service passes its acceptance tests             |
| 11    | Security verification                               | Required automated and operational tests pass                 |
| 12    | Documentation and handover                          | Named ownership and runbooks established                      |

The phases may overlap only when dependencies are understood and the architecture owner approves the overlap. The migration must not bypass a security gate.

---

## 17. Required Developer Execution Rules

All developers and AI coding agents working on this initiative must follow these rules.

### Before making changes

- Read the repository's engineering instructions and existing architecture documentation.
- Inspect the actual deployment and authentication model.
- Identify affected services, packages, pipelines, and consumers.
- Read existing tests and migration conventions.
- Record the intended changes and security impact.
- Identify the rollback procedure.
- Confirm that no required production credential needs to be exposed during implementation.

### While making changes

- Keep changes within the approved scope.
- Do not redesign nID or other services unnecessarily.
- Do not introduce a dependency on an unverified API.
- Do not add credentials to fixtures, test snapshots, or documentation.
- Do not silently change existing environment-variable contracts.
- Do not break unrelated services.
- Do not weaken existing authentication to make integration easier.
- Add tests for security boundaries and failure behavior.
- Update documentation with each material architectural change.
- Prefer incremental, reviewable changes over one large ecosystem-wide migration.

### Before committing

- Run relevant tests, linting, type checks, and security scans.
- Inspect the staged diff for credentials and sensitive data.
- Check that configuration templates contain placeholders, not actual values.
- Verify that the change does not expose secrets in logs or artifacts.
- Document any test that could not be run.
- Confirm that deployment and rollback instructions remain valid.

### Before declaring completion

Report:

- Repositories changed.
- Branch names and commit SHAs.
- Files and infrastructure resources changed.
- Tests executed and their actual results.
- Security properties verified.
- Migration status.
- Known gaps and remaining risks.
- Rollback readiness.
- Whether the change is committed, deployed, and independently verified.

Never claim that a secret was rotated, an access policy was enforced, a backup was restored, or a production service was verified unless evidence supports that statement.

---

## 18. Definition of Done

The central secrets vault is not complete merely because it is running or because the team can retrieve a password from it.

The initiative is complete only when all applicable acceptance criteria are satisfied:

- [ ] Vault technology and architecture are formally approved.
- [ ] All in-scope repositories and secret consumers have been inventoried.
- [ ] Production secret values are absent from active Git configuration.
- [ ] Historical exposure findings have documented remediation decisions.
- [ ] Vault authentication and authorization are enforced.
- [ ] Every workload has narrowly scoped access.
- [ ] Production and non-production environments are appropriately separated.
- [ ] Tenant-specific secrets are isolated and tested.
- [ ] Secret access is auditable without logging secret values.
- [ ] Rotation and revocation procedures are operational.
- [ ] CI/CD does not expose production secrets to untrusted jobs.
- [ ] Applications handle vault failures safely.
- [ ] Backups and recovery procedures have been tested.
- [ ] Migration and rollback procedures are documented.
- [ ] Security tests and integration tests pass.
- [ ] Operational ownership and incident response are assigned.
- [ ] Remaining risks and unimplemented controls are explicitly documented.

Any unmet security-critical criterion must block the corresponding production rollout or be covered by an explicitly approved, time-bounded risk exception.

---

## 19. Final Architecture Principle

NEWAX must centralize the management of its secrets without centralizing unnecessary power in individual applications.

nID establishes identity and organization context according to its verified contracts. The vault protects credentials and enforces secret-access policy. Each service remains responsible for its domain and receives only the secrets it needs. Tenant boundaries must remain enforced across every applicable request, job, integration, and storage operation.

The result must be infrastructure that NEWAX can operate, audit, recover, and evolve with confidence.

**One governed secrets vault. Explicit ownership. Least-privilege access. Verified tenant isolation. Controlled rotation. Recoverable operations. No secrets in Git.**

That is the required standard for the NEWAX ecosystem.
