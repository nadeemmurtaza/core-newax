# NEWAX Central Secrets Vault Protocol

**Document type:** Mandatory engineering specification  
**Organization:** NEWAX (SMC-PRIVATE) LIMITED  
**Status:** Proposed architecture. This document does not claim that the vault or any described control is already implemented.  
**Applies to:** All NEWAX repositories, services, environments, tenants, deployments, integrations, and CI/CD workflows.

## 1. Executive directive

NEWAX must establish a centralized, secure, auditable secrets-management system for its Business Infrastructure ecosystem.

The vault is the governed system for storing, accessing, rotating, revoking, and auditing sensitive credentials. It must not become a shared folder of passwords or a mechanism that gives every application unrestricted access to all secrets.

**Core principle: Centralize secret governance, not unrestricted secret access.**

The vault is separate from nID. nID remains the intended identity and organization authority, subject to verification of its current implementation. The vault is a separate security service with its own authentication, authorization, encryption, audit, backup, and recovery controls.

### Non-negotiable rules

1. Actual secrets must never be committed to Git.
2. Private repositories are not secret stores.
3. No application or workload may receive unrestricted vault access.
4. No tenant may access another tenant's secrets without an explicit, authorized, scoped, and audited relationship.
5. Do not print secret values in logs, exceptions, API responses, CI output, issue descriptions, or documentation.
6. Do not revoke existing credentials until dependent systems have migrated and replacements have been verified, except when an incident response requires immediate revocation.
7. Do not weaken authentication or authorization to make migration easier.
8. Do not claim a control is implemented without evidence from code, tests, configuration, and runtime behavior.
9. Production migration requires a rollback plan and a verified recovery path.
10. The vault must have a recovery procedure that does not depend exclusively on the identity system it protects.

## 2. Architectural boundaries

| Component | Responsibility |
|---|---|
| nID | User identity, organization identity, memberships, roles, and permission authority according to verified contracts |
| Central secrets vault | Secret storage, access policies, credential issuance, rotation, revocation, and secret-access auditing |
| Core | Shared platform capabilities explicitly assigned to Core |
| ERP | Its assigned business operations and domain data |
| Harvester | Its verified intelligence and research domain |
| Communicator | Its verified conversation and messaging domain |
| NMail | Its verified email transport and delivery domain |
| Other services | Their explicitly assigned business responsibilities and authorized credentials |
| Deployment infrastructure | Workload execution, secret delivery, network controls, service authentication, and runtime configuration |

Verify the actual responsibilities, repositories, schemas, and deployments before implementing changes.

### Repository placement

Evaluate a dedicated infrastructure repository, provisionally named newax-secrets-infrastructure, for infrastructure-as-code, policy definitions, deployment manifests, sanitized templates, tests, and runbooks.

The repository must never contain actual production .env files, vault root tokens, unencrypted recovery material, private signing keys, customer credentials, database passwords, or exported vault contents.

This protocol belongs in core-newax as an architecture reference. That does not make core-newax the storage location for the secrets themselves.

## 3. Phase 0: baseline discovery and audit

Do not begin a production migration until the current state is understood.

### Repositories and systems in scope

Start with the six previously identified core repositories:

- nID
- core-newax
- erp-1
- Communicator
- harvester
- newcom, including the email service and other currently bundled services

Also inspect related deployment repositories, shared packages, campaign services, collaboration services, workspace applications, CI/CD workflows, hosting configuration, and infrastructure definitions where they exist. Verify whether the initial list is exhaustive.

### Secret inventory

For each repository and deployed service, document:

- Environment variable names and purposes.
- Where values are currently stored, without copying the values.
- Which services, jobs, and pipelines consume each variable.
- Classification: credential, public configuration, or ordinary application data.
- Environment: development, test, staging, or production.
- Credential owner and issuing provider.
- Privileges, scope, and tenant applicability.
- Rotation and expiration support.
- Shared consumers and downstream dependencies.
- Presence in current Git trees, historical Git commits, logs, CI output, artifacts, or backups.
- Failure modes if the credential is missing, expired, or rotated.
- Required migration and rollback steps.

Never include actual secret values in the inventory. Use references, classifications, and redacted evidence. Do not place unredacted secrets in terminal output, reports, pull requests, or chat.

### Safe scanning

Use approved secret-scanning tools against working trees, relevant Git history, deployment files, CI/CD configuration, and available logs. Test scanners with synthetic credentials and configure redacted output before scanning real repositories.

A credential discovered in Git history or logs must be treated as potentially compromised. Removing it from the latest commit does not invalidate the credential or erase historical copies. Assess its scope and rotate or revoke it through a controlled incident procedure.

### Phase 0 deliverables

1. Repository and service inventory.
2. Secret classification inventory containing no secret values.
3. Credential ownership and consumer map.
4. Rotation-impact and dependency map.
5. Current authentication and authorization flow.
6. Current deployment and CI/CD secret-delivery flow.
7. Exposure findings and remediation recommendations.
8. Proposed vault deployment architecture.
9. Recovery and rollback plan.
10. Architecture decision record.

Label findings as **Verified**, **Inferred**, **Proposed**, or **Unresolved**. Phase 0 is complete only when the team understands where credentials live, which workloads consume them, and how they can be migrated safely.

## 4. Phase 1: select and design the vault

Evaluate OpenBao and HashiCorp Vault as initial candidates. Select based on verified requirements, licensing, operational support, integrations, deployment constraints, and long-term maintenance capacity. Do not select solely on familiarity or the fact that a tool is open source.

Evaluate:

- Encryption and key-management model.
- Authentication methods and workload identity support.
- Fine-grained authorization policies.
- Dynamic credential issuance.
- Rotation and revocation.
- Audit capabilities.
- High availability and disaster recovery.
- Integration with Docker, CI/CD, and the actual hosting platform.
- Backup, restore, upgrade, and maintenance procedures.
- Operational complexity and support requirements.

### Logical organization

Define environment- and service-scoped namespaces or equivalent policies. Example logical groups:

- Platform secrets by environment.
- nID secrets by environment.
- Core secrets by environment.
- ERP secrets by environment.
- Communicator secrets by environment.
- Harvester secrets by environment.
- NMail secrets by environment.
- Provider integration secrets by environment.
- Tenant-specific integration secrets by organization and integration.

Adapt names to the chosen vault. Paths alone are not authorization. Enforce access using the vault's real policy engine.

Separate development, test, staging, and production secrets through policy and, where justified by the threat model, separate instances or stronger security boundaries. Never copy production credentials into development or testing.

### Secret metadata

Maintain, where applicable:

- Stable secret reference.
- Owning service or team.
- Environment and classification.
- Credential type and issuing provider.
- Authorized workload identities.
- Tenant scope.
- Creation, expiration, and last-rotation metadata.
- Rotation policy and responsible owner.
- Dependencies, revocation procedure, and operational criticality.

Metadata must not contain secret values.

## 5. Phase 2: vault security and key management

### Encryption and transport

Encrypt secret material in transit and at rest. Use maintained cryptographic implementations and approved protocols. Never invent custom cryptography.

Document transport encryption, certificate validation, storage encryption, encryption-key ownership, key rotation, recovery, and separation of duties. Evaluate external key-management or hardware-backed protection when supported and justified.

### Bootstrap and recovery credentials

Do not store a permanent root token in the repository or deployment manifest that starts the vault.

Define a controlled initialization process with restricted access, secure credential generation and distribution, separation of duties for critical recovery material, storage outside the vault's normal failure domain, audited emergency access, and retirement of bootstrap credentials where supported.

Follow the selected vault's documented security model. Do not assume that any single recovery-key technique is automatically sufficient.

### Network security

- Do not expose vault management interfaces publicly without an explicitly approved architecture.
- Restrict access to approved workloads and administrative entry points.
- Require authenticated, encrypted connections and certificate validation.
- Restrict management ports and unnecessary outbound connectivity.
- Protect authentication endpoints and monitor unusual attempts.
- Document firewall rules, network dependencies, and allowed entry points.
- Never treat network location alone as authorization.

### Administrative access

Separate permissions for vault administrators, auditors, platform operators, application workloads, developers, incident responders, and emergency recovery.

Permission to deploy an application must not automatically grant permission to read every production secret. Administrative access must be attributable, scoped, and audited.

## 6. Phase 3: workload authentication and least privilege

Every service must authenticate to the vault using a supported workload-authentication mechanism. Prefer workload identity or short-lived credentials where the environment supports them. Where not supported, use a documented, tightly controlled alternative.

Do not distribute one permanent ecosystem-wide vault token to every application.

Create explicit read, write, rotation, and administrative permissions. For example, ERP may read its own database credentials and approved integrations; NMail may read its own delivery credentials; and a CI/CD workflow may receive only the secrets needed for an approved deployment. Confirm actual dependencies during the audit before finalizing policies.

nID must not gain unrestricted secret access merely because it is the identity authority. A general-purpose nID endpoint must not return arbitrary secrets based on a caller-supplied path or key name.

Where practical, workloads should authenticate directly to the vault. If a broker service is necessary, document why and give it narrowly scoped permissions.

Define and test revocation for compromised workloads, departing staff, leaked tokens, disconnected integrations, decommissioned services, and expired certificates.

## 7. Phase 4: multi-tenant secret isolation

Classify credentials as:

- **Platform secrets:** Used by shared infrastructure.
- **Service secrets:** Used by a specific workload.
- **Tenant integration secrets:** Used on behalf of a specific customer organization.
- **User-delegated credentials:** Granted through an explicitly authorized integration flow.

Record ownership and permitted purpose. Do not assume customer-supplied credentials may be reused for unrelated purposes.

### Tenant authorization

A tenant identifier is not proof of authorization. For tenant-scoped operations:

1. Authenticate the user or workload.
2. Resolve organization context through trusted server-side contracts.
3. Verify membership or another explicit access relationship.
4. Verify permission for the requested action.
5. Verify that the secret belongs to the authorized scope.
6. Enforce the vault policy.
7. Record appropriate audit metadata without recording the secret value.

Never rely solely on a client-supplied organization ID, tenant ID, request header, URL parameter, or role claim.

Do not grant a general-purpose application permission to read all tenant secrets merely because it serves multiple organizations. Use explicit tenant scope and controlled operations. Avoid exposing raw credentials to frontend clients.

### Tenant lifecycle and delegated access

Define creation, update, rotation, integration disconnection, organization suspension, organization deletion, and retention behavior. Revoking an integration must prevent new unauthorized use and invoke external-provider revocation where supported and authorized.

Agency-to-client relationships must be explicit, scoped, revocable, and auditable. Agency membership or a commercial relationship does not automatically grant access to all client credentials.

## 8. Phase 5: application integration

Create a stable, documented secret-consumption approach across services. It must define authentication, reference conventions, access checks, startup behavior, refresh and rotation, timeouts, retries, redaction, local development, testing, and operational diagnostics.

A shared library may be useful if it does not create unnecessary coupling. Where runtimes differ, a stable integration contract may be better than one universal library.

### Environment variables and runtime delivery

Environment variables may remain a compatible delivery mechanism for applications that require them, but they must not be the authoritative long-term secret store.

Preferred flow:

**Vault → authenticated deployment or workload mechanism → application runtime**

Where appropriate, workloads may retrieve secrets directly. Otherwise use a protected deployment mechanism or restricted in-memory/file delivery.

Avoid secret values in command-line arguments, build arguments, container image layers, frontend bundles, broadly readable temporary files, and diagnostic endpoints. If a file is required, restrict permissions and lifetime, prevent inclusion in images or backups, and clean it up safely.

### Startup and vault failure

For every service, define required credentials, readiness behavior, permitted continuation during vault outages, refresh behavior, recovery, and cache invalidation.

Never fall back silently to hard-coded credentials or weaker authentication. Do not report a service as fully operational when required credentials are unavailable and core functionality cannot work.

### Caching

Cache only when justified. Define maximum lifetime, refresh behavior, rotation awareness, memory handling, tenant isolation, invalidation, and failure behavior. Tenant-specific secrets must never leak through shared mutable state or cache-key collisions.

## 9. Phase 6: rotation and credential lifecycle

Prefer dynamic or short-lived credentials where the provider and infrastructure support them. Do not claim dynamic rotation for systems that do not support it.

Every secret category needs a documented rotation policy: trigger, procedure, owner, validation, consumer refresh, rollback, and old-credential revocation.

Rotate immediately when compromise is suspected or confirmed.

For staged rotation where supported:

1. Issue the replacement credential.
2. Store it securely.
3. Grant the required workload access.
4. Update or refresh consumers.
5. Verify actual operations with the new credential.
6. Monitor failures and unexpected access.
7. Revoke the old credential after verification.

If only one credential may be active, document expected disruption and obtain approval before change. A successful deployment command is not proof that the service works with the replacement.

## 10. Phase 7: CI/CD and developer workflows

Pipelines must not print secret values or expose them through logs, artifacts, caches, test reports, or build output.

Use narrowly scoped and short-lived deployment credentials where practical. Separate pull-request validation, development, staging, production, and emergency recovery.

Untrusted pull-request code must not receive production secrets. A pipeline must not have broad secret-read access merely because it builds several repositories.

Provide safe local development with .env.example files containing variable names and non-secret placeholders, documented setup steps, approved non-production credentials, and test doubles or local services where suitable. Do not require developers to copy production .env files.

Add appropriate pre-commit detection, pull-request scanning, CI checks, history scanning, redacted findings, and incident procedures. If a credential is committed, rotate it as appropriate even if the commit is later rewritten.

## 11. Phase 8: audit and monitoring

Record metadata for authentication attempts, secret reads and writes, creation and deletion, policy changes, credential issuance and revocation, rotation, administrative actions, recovery operations, and denied access.

Logs should identify the principal, action, secret reference, time, result, and relevant context without revealing secret values.

Protect audit records from unauthorized modification or deletion. Where practical, forward logs to a separately protected monitoring system so a compromised vault cannot silently control the only record of its activity.

Create owned alerts for repeated authentication failures, unexpected bulk reads, unapproved workload access, privilege escalation, policy changes, emergency credential use, tenant-scope violations, rotation failures, audit pipeline failures, and unusual administrative activity.

## 12. Phase 9: backup, recovery, and availability

Document backup frequency, encryption, access controls, recovery material, retention, recovery point objective, recovery time objective, disaster scenarios, ownership, and testing schedule.

Recovery must not depend exclusively on nID being available. Establish a controlled break-glass procedure with independent authentication and auditability.

A successful backup job does not prove recoverability. Restore into an isolated environment and verify data, key material, policies, workload authentication, audit records, and dependent-service recovery. Do not experiment on the production vault without an approved procedure.

## 13. Phase 10: incremental migration

Do not perform a blind bulk migration of every .env file.

1. Inventory credentials and consumers.
2. Classify platform, service, tenant, and user-delegated secrets.
3. Deploy and harden the vault; verify policies and recovery.
4. Migrate one low-risk non-production service.
5. Test retrieval, authorization, rotation, failure behavior, and logging.
6. Migrate production services incrementally in dependency-aware order.
7. Replace credentials that were exposed or inadequately protected as required.
8. Verify real operations in each migrated service.
9. Revoke old credentials only after all known consumers use the replacement.
10. Remove obsolete copies and address historical exposure in repositories, logs, artifacts, and backups.

Public configuration values in .env files are not automatically secrets. Classify every variable. Conversely, changing a credential's filename does not make it safe.

For each migration, document old and new references, consumer cutover, validation, rollback trigger, recovery procedure, and revocation status. Rollback must not require publishing a secret or reintroducing it into Git. Never restore a credential known to be compromised as a normal fallback.

## 14. Phase 11: mandatory security testing

### Authorization tests

Verify that:

- Unauthenticated workloads cannot read secrets.
- Authenticated but unauthorized workloads are denied.
- Services cannot read unrelated service credentials.
- nID cannot read arbitrary application secrets.
- Development workloads cannot read production secrets.
- CI jobs cannot access unrelated production credentials.
- Revoked workloads lose access.
- One tenant cannot read another tenant's integration credentials.
- Client-supplied organization IDs cannot bypass authorization.
- Administrative privileges are separated and audited.

### Leakage tests

Verify that secrets do not appear in logs, errors, HTTP responses, frontend bundles, image layers, build artifacts, test reports, monitoring labels, exception traces, committed documentation, or historical repository content after the approved cleanup process.

Use synthetic credentials and canary values to test redaction.

### Rotation, recovery, and isolation tests

Verify rotation, consumer refresh, expiration, revocation, documented vault-outage behavior, absence of embedded fallbacks, restoration of policies and functionality, cache isolation, and concurrent-operation safety.

Use at least two independent test organizations with distinct credentials. Test unauthorized CRUD and enumeration, membership revocation, delegated-access revocation, tenant suspension, rotation, and concurrent requests.

A happy-path test alone is not evidence of tenant isolation.

## 15. Phase 12: documentation and ownership

Maintain documentation for:

1. Architecture and technology decision.
2. Deployment and configuration.
3. Secret naming and classification.
4. Authentication and authorization policies.
5. Developer setup and service integration.
6. Tenant-specific secret handling.
7. Rotation and revocation.
8. Incident response.
9. Backup and disaster recovery.
10. Monitoring and alerting.
11. Migration status.
12. Known limitations.
13. Upgrades and maintenance.
14. Service ownership and escalation.

Assign an accountable owner for vault operations, policies, recovery, maintenance, and security incidents. Do not leave the vault as a system only one developer understands.

## 16. Implementation roadmap and gates

| Phase | Deliverable | Completion gate |
|---|---|---|
| 0 | Repository, secret, dependency, and deployment audit | Inventory reviewed; gaps documented |
| 1 | Vault selection and architecture decision | Security and operations design approved |
| 2 | Hardened vault deployment | Encryption, bootstrap, network, and recovery verified |
| 3 | Workload authentication and policies | Least-privilege tests pass |
| 4 | Tenant isolation model | Cross-tenant negative tests pass |
| 5 | Integration contract and pilot | Pilot service consumes secrets securely |
| 6 | Rotation and lifecycle | Rotation and revocation verified |
| 7 | CI/CD and developer workflow | No production-secret exposure in build workflows |
| 8 | Audit and monitoring | Events, alerts, and ownership verified |
| 9 | Backup and recovery | Isolated restore test passes |
| 10 | Incremental migration | Each service passes acceptance tests |
| 11 | Security verification | Required automated and operational tests pass |
| 12 | Documentation and handover | Ownership and runbooks established |

Do not skip a security gate. Overlapping phases require understood dependencies and approval from the architecture owner.

## 17. Developer execution protocol

### Before changes

- Read repository instructions and existing architecture documents.
- Inspect actual deployment, authentication, and secret-delivery behavior.
- Identify affected services, packages, pipelines, and consumers.
- Review tests and migration conventions.
- Record intended changes, security impact, and rollback.
- Ensure implementation does not require exposing production secret values.

### During changes

- Keep changes within approved scope.
- Do not redesign nID or unrelated services unnecessarily.
- Do not introduce dependencies on unverified APIs.
- Do not add credentials to fixtures, snapshots, tests, or docs.
- Do not silently change environment-variable contracts.
- Do not weaken authentication or authorization.
- Add tests for boundaries and failure behavior.
- Update documentation with material changes.
- Prefer incremental, reviewable changes.

### Before committing

- Run relevant tests, linting, type checks, and security scans.
- Inspect the staged diff for credentials and sensitive data.
- Confirm templates contain placeholders only.
- Check logs and artifacts for secret exposure.
- Document tests that could not be run.
- Verify deployment and rollback instructions.

### Completion reporting

Report repositories changed, branches and commit SHAs, files and infrastructure resources changed, actual test results, verified security properties, migration status, remaining risks, rollback readiness, and whether changes are committed, deployed, and independently verified.

Never claim that a secret was rotated, a policy enforced, a backup restored, or production behavior verified without evidence.

## 18. Definition of done

The vault initiative is not complete merely because a vault process is running or a password can be retrieved.

- [ ] Vault technology and architecture are approved.
- [ ] In-scope repositories and secret consumers are inventoried.
- [ ] Production secret values are absent from active Git configuration.
- [ ] Historical exposure findings have documented remediation decisions.
- [ ] Authentication and authorization are enforced.
- [ ] Workload access follows least privilege.
- [ ] Environments are appropriately separated.
- [ ] Tenant-specific secrets are isolated and tested.
- [ ] Access is auditable without logging secret values.
- [ ] Rotation and revocation are operational.
- [ ] CI/CD protects production secrets from untrusted jobs.
- [ ] Applications handle vault failures safely.
- [ ] Backup and recovery have been tested.
- [ ] Migration and rollback procedures are documented.
- [ ] Required security and integration tests pass.
- [ ] Operational ownership and incident response are assigned.
- [ ] Remaining risks and unimplemented controls are explicit.

Any unmet security-critical criterion blocks the corresponding production rollout unless a time-bounded risk exception is explicitly approved.

## 19. Permanent architecture principle

NEWAX centralizes secret management without centralizing unnecessary power in individual applications.

nID establishes identity and organization context according to verified contracts. The vault protects credentials and enforces secret-access policies. Each service receives only the secrets it needs. Tenant boundaries remain enforced across every applicable request, job, integration, and storage operation.

**One governed secrets vault. Explicit ownership. Least-privilege access. Verified tenant isolation. Controlled rotation. Recoverable operations. No secrets in Git.**

This document is the governing engineering specification, not evidence that the described system is already deployed.
