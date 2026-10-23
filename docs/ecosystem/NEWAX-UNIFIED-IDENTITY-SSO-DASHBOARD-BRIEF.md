# NEWAX Unified Identity, SSO, and Shared Dashboard

## Master Developer Implementation Brief

**Organization:** NEWAX
**Category:** The Business Infrastructure Company
**Priority:** Business-critical infrastructure
**Implementation approach:** Plan, document, implement, test, review, and deploy in controlled stages.

---

## 1. Objective

Implement one genuine, secure identity system and one shared dashboard framework for the NEWAX ecosystem.

The required user experience is:

1. A user opens any NEWAX service.
2. They click **Sign in with nID**.
3. They authenticate through the central nID identity system using their username and password.
4. nID validates the account and the requested authentication flow.
5. The user returns to the exact service and permitted destination they originally requested.
6. The service displays the shared NEWAX Core dashboard shell.
7. The service loads its own authorized data, navigation, widgets, and dashboard arrangement.
8. The same user can access other services only when their organization membership and permissions authorize access.

The user should not need a separate account or password for every NEWAX service.

**Core principle:** One identity system. One shared dashboard framework. Multiple independently governed business services.

Do not create a separate authentication system or duplicate dashboard application for each repository.

## 2. Repository responsibilities

Inspect the actual repository structure and current implementation before changing code. The following responsibilities are mandatory; adapt file paths to the real codebase.

### Repository A: `nadeemmurtaza/nID`

**Responsibility:** Central identity, credentials, sessions, authentication, account recovery, and trusted service sign-in.

Implement:

- Genuine username-and-password authentication.
- Secure account provisioning.
- Password change and recovery.
- Session creation, expiry, and revocation.
- Registered application/client management.
- Secure SSO and callback validation.
- Organization membership and identity claims.
- Security audit events and authentication protections.

nID is the identity authority. It is not the shared dashboard application or a general-purpose secrets vault.

### Repository B: `nadeemmurtaza/core-newax`

**Responsibility:** Shared application shell, dashboard framework, service integration contracts, navigation, layout management, and permission-aware presentation.

Implement:

- Shared authenticated application shell.
- Dashboard framework and widget registry.
- Service navigation and module registration.
- User and organization dashboard preferences.
- Shared loading, error, empty, and access-denied states.
- Consistent NEWAX design-system integration.
- Versioned contracts for services to contribute their own dashboard features.

Core must not duplicate business rules or take ownership of every service's operational data.

### Repository C: `nadeemmurtaza/Communicator`

**Responsibility:** First reference service using the shared nID sign-in flow and Core dashboard framework.

Implement:

- nID sign-in entry point.
- Secure SSO callback handling.
- Session establishment and logout.
- Shared Core shell integration.
- Communicator-specific navigation and dashboard widgets.
- Authorized access to Communicator's own backend data.
- Removal of production-capable mock authentication.

The existing `AuthContext.tsx` and `src/communicator/api/routes/nid_auth.py` are important inspection points. Review their current implementation rather than assuming existing behavior is production-safe.

### Every other NEWAX service repository

Apply the same integration contract to every service, including current and future applications.

Each service must:

- Register itself as an authorized nID relying party.
- Use the common sign-in entry point.
- Return users only to registered, validated destinations.
- Use the shared Core shell.
- Contribute its own navigation and dashboard widgets through governed interfaces.
- Retrieve operational data from its own authorized backend.
- Enforce its own permissions and tenant boundaries.
- Remove duplicate login screens and independently implemented dashboard shells where the shared architecture replaces them.
- Retain service-specific business pages and workflows.

Before implementation, create a repository inventory identifying every active application, frontend, backend, API, authentication flow, and dashboard. Do not silently omit a repository because its integration is inconvenient.

---

## 3. nID: required pages and authentication flows

Create or adapt the following user-facing pages in the nID login application.

### Public authentication pages

| Page                     | Required behavior                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                 | Username and password sign-in, validation, generic failure messages, loading states, and accessible controls.                                 |
| `/login/recovery`        | Start account recovery without revealing whether an account exists.                                                                           |
| `/login/recovery/verify` | Verify the configured recovery method and securely validate the recovery attempt.                                                             |
| `/login/recovery/reset`  | Set a new password after successful recovery verification.                                                                                    |
| `/login/verify`          | Handle an additional verification step when account policy requires it.                                                                       |
| `/login/continue`        | Continue a pending registered-service sign-in after authentication, showing the requesting application and required consent where applicable. |
| `/login/error`           | Display safe, understandable authentication errors without exposing secrets, tokens, internal exceptions, or account details.                 |

These are required logical routes. Reuse existing screens when appropriate instead of creating duplicate pages with different URLs.

### Authenticated account pages

| Page                     | Required behavior                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `/account`               | Show basic account information and security status.                                        |
| `/account/security`      | Change password, review security settings, and manage supported verification methods.      |
| `/account/sessions`      | Review active sessions and revoke selected or all other sessions.                          |
| `/account/recovery`      | Manage verified recovery options where supported.                                          |
| `/account/applications`  | Show registered services the user is authorized to access.                                 |
| `/account/access-denied` | Explain when authentication succeeded but access to a requested service is not authorized. |

Do not expose another organization's users, account details, or application assignments through these pages.

### Operator-only provisioning interface

Provide a protected CLI or operator workflow for creating the first genuine user. A public registration page is not required merely to bootstrap NEWAX's administrator.

Requirements:

- Accept a username and initial password through a secure interactive prompt or a secret-manager reference.
- Never put the password in source code, a committed seed, a URL, command-line arguments, or logs.
- Hash passwords using a maintained password-hashing implementation such as Argon2id, with deployment-appropriate parameters.
- Normalize usernames consistently and enforce uniqueness.
- Refuse to silently overwrite an existing account or reset an existing password.
- Require a password change on first sign-in.
- Assign organization membership and permissions explicitly.
- Record an auditable provisioning event without recording the secret.
- Disable bootstrap mode after provisioning.

The actual username is selected by the authorized operator during deployment. The password is generated or entered privately. Do not invent or publish a fixed default credential.

### nID backend requirements

Implement and test:

- Password enrollment, login, change, reset, and revocation.
- Password policy and breached-password checks.
- Rate limiting and protections against brute-force attacks.
- Generic authentication failure responses.
- Account status, lockout, and disabled-account handling.
- Session expiry and revocation.
- Audit events for authentication and security-sensitive changes.
- Secure handling of phone/OTP as an explicitly configured additional or recovery method.
- Registered service clients and exact redirect URI validation.
- Authorization-code flow with PKCE, unpredictable state, nonce where applicable, short-lived single-use codes, issuer and audience validation, and replay prevention.
- A standards-compliant OIDC implementation or a vetted implementation of the required protocol behavior.

**Do not label the current custom nID redirect flow production-ready until its protocol and security gaps have been addressed.**

---

## 4. Core: required shared dashboard pages

Implement the following logical pages within the existing Core web application.

### Shared authenticated shell

**Route pattern:** `/app`

The shared shell must provide:

- Consistent global navigation and account controls.
- Current organization and service context.
- A responsive content area.
- Permission-aware navigation.
- Standard loading, error, empty, and access-denied states.
- Consistent design tokens and components.
- A predictable location for service-specific navigation and dashboard content.

Avoid turning the shell into an overloaded page full of unrelated widgets.

### Dashboard pages

| Page                        | Required behavior                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/app`                      | Default authenticated landing page with the user's permitted overview.                                   |
| `/app/dashboard`            | Render the active service's configured dashboard.                                                        |
| `/app/dashboard/customize`  | Let authorized users rearrange supported widgets and save their layout.                                  |
| `/app/services`             | Show services available to the current user and organization.                                            |
| `/app/access-denied`        | Explain why a requested service or capability is unavailable.                                            |
| `/app/settings/profile`     | Manage permitted user-facing profile preferences.                                                        |
| `/app/settings/preferences` | Manage dashboard layout, density, and other supported preferences.                                       |
| `/app/settings/security`    | Link to nID's canonical account-security interface rather than creating duplicate credential management. |
| `/app/settings/sessions`    | Provide a trusted route to session management through nID or the approved shared session interface.      |

Use the existing application router and conventions if equivalent routes already exist.

### Service-specific pages

Core provides the shared shell, not the complete business application.

A service may expose routes such as:

- `/app/communicator/...`
- `/app/erp/...`
- `/app/inventory/...`
- `/app/operations/...`

Use the actual registered service identifiers and current route conventions. These are examples, not permission to create arbitrary new services.

Each service owns its business pages, workflows, and backend data. Core owns the reusable presentation framework and integration contract.

### Dashboard customization

Support:

- A default layout supplied by the service.
- User-specific saved layouts.
- Organization-level defaults where authorized.
- Supported widget rearrangement and resizing.
- Layout schema versioning and migration.
- Responsive behavior.
- Validation of stored widget configuration.
- Recovery to a safe default layout when a saved configuration is invalid.
- Accessible keyboard operation.
- Useful empty states when a service has no available widgets.

The browser must not be able to register arbitrary executable code as a widget or bypass authorization by modifying a layout.

---

## 5. Core dashboard contracts

Define documented, versioned interfaces for:

1. Service registration.
2. Service navigation.
3. Dashboard widget metadata.
4. Widget data adapters.
5. Required permissions.
6. Layout serialization and validation.
7. Service availability and lifecycle.
8. Error and loading states.
9. Organization and user preference scope.
10. Contract version compatibility.

Every widget registration must define its identity, display metadata, supported configuration, required permissions, and approved data source.

A service should contribute a widget through the approved contract, not by copying the entire Core dashboard or directly querying another service's database.

Backend authorization is mandatory. Hiding a button or widget is not a security boundary.

---

## 6. Communicator: required pages and changes

### Pages and routes

| Page or route                 | Required behavior                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                      | Show a clear **Sign in with nID** action. Avoid collecting a separate Communicator password.                                                                     |
| `/auth/nid/callback`          | Complete the registered SSO callback through the backend, validate state and the authorization response, establish the application session, and redirect safely. |
| `/app/communicator`           | Render Communicator through the shared Core shell.                                                                                                               |
| `/app/communicator/dashboard` | Display Communicator-specific authorized widgets and data.                                                                                                       |
| `/app/communicator/settings`  | Expose only Communicator-specific preferences.                                                                                                                   |
| `/logout`                     | End the local application session and invoke the approved central logout behavior where configured.                                                              |

These are logical routes. Preserve the repository's framework conventions and avoid duplicating equivalent routes.

### Authentication requirements

- Remove the development mock-login shortcut from every production-capable path.
- Mock authentication may be used only in isolated tests or explicitly isolated local development.
- Production startup must fail closed if mock authentication is enabled or required identity configuration is missing.
- Do not treat a client-supplied account ID, email, organization ID, or local-storage value as proof of identity.
- Prefer secure, HttpOnly, SameSite cookies for browser sessions, with appropriate CSRF protections.
- Do not store long-lived bearer tokens or refresh tokens in browser localStorage.
- Validate the callback and establish the session through the trusted backend.
- Preserve the original destination only as a validated in-service path associated with the registered sign-in transaction.

### Communicator dashboard widgets

Inventory existing capabilities first. Register relevant widgets through Core, such as:

- Recent conversations.
- Unread conversation count.
- Assigned conversations.
- Recent activity.
- Relevant operational alerts.

These are candidate widgets, not permission to invent APIs or display fabricated data. Only implement widgets backed by existing or explicitly planned, authorized backend endpoints.

---

## 7. SSO behavior across every service

The required flow is:

1. The service starts a sign-in transaction with nID.
2. nID validates the registered client and exact callback URI.
3. The service and nID protect the transaction with state and PKCE.
4. The user signs in through nID.
5. nID returns a short-lived authorization code to the registered callback.
6. The service backend exchanges the code securely and validates the resulting identity.
7. The service establishes its own secure session.
8. The user returns to the validated original service destination.
9. Core loads the shared shell and the service's authorized dashboard.
10. The service backend independently enforces membership and permissions on every protected operation.

Security requirements:

- No arbitrary redirect URLs.
- No authentication tokens in redirect URLs beyond the short-lived protocol code required by the flow.
- No reusable authorization codes.
- No cross-client token acceptance.
- No bypass through mock authentication in production.
- No assumption that signing into nID grants access to every service.
- Logout behavior must be clearly defined for the local session and central identity session.
- Expired or revoked sessions must be rejected and handled cleanly.

Do not invent a production SSO protocol from scratch when a maintained, standards-compliant implementation is suitable.

---

## 8. Every other service: integration checklist

For each additional NEWAX repository, create a service integration plan covering:

- Current login and session architecture.
- Registered nID client configuration.
- Approved callback and logout URLs.
- Core shell integration.
- Service-specific navigation.
- Dashboard widgets and their data endpoints.
- User, organization, and role mapping.
- Backend permission enforcement.
- Tenant isolation.
- Session expiration and revocation.
- Error and recovery behavior.
- Tests and deployment configuration.

Do not blindly replace business pages with a generic dashboard. The purpose of Core is to eliminate duplicated infrastructure while preserving each service's legitimate operational functionality.

---

## 9. Security and tenant isolation

Treat these requirements as release blockers:

- No plaintext passwords or committed credentials.
- No default administrator password.
- No sensitive tokens in logs, analytics, URLs, or localStorage.
- No open redirects.
- No production mock authentication.
- No cross-tenant data exposure.
- No trusting browser-provided roles or tenant IDs.
- No unprotected administrative provisioning endpoint.
- No dashboard widget bypassing backend permissions.
- No silent privilege escalation during bootstrap.
- No leaking account existence through recovery responses.
- No unbounded authentication attempts.
- No deployment with missing mandatory identity configuration.

Use the existing NEWAX secrets-management strategy for client secrets, signing keys, and deployment credentials. nID must not become an improvised storage location for every application's raw environment file.

---

## 10. Documentation required in each repository

Before implementation, write or update the relevant repository documentation.

### nID

- Authentication architecture.
- Account and credential data model.
- Password and recovery policy.
- Secure bootstrap provisioning runbook.
- Service client registration and callback rules.
- SSO/OIDC and PKCE protocol documentation.
- Session and logout behavior.
- Threat model and security test plan.
- Migration and rollback instructions.

### Core

- Shared shell architecture.
- Dashboard widget and service contracts.
- Permission and authorization model.
- Layout persistence and migration.
- Design-system integration.
- Service onboarding guide.
- Error-state and accessibility standards.
- Contract compatibility policy.

### Communicator

- nID integration architecture.
- Callback and session flow.
- Core shell integration.
- Widget registration and data ownership.
- Production configuration.
- Mock-auth removal and verification.
- Integration test plan.

### Every other service

- Service registration.
- nID integration.
- Core shell and widget contract.
- Backend permission enforcement.
- Environment and secret configuration.
- Deployment, rollback, and verification.

Keep documentation synchronized with actual behavior. A document describing future functionality must clearly label it as planned, not implemented.

---

## 11. Required implementation workflow

Follow the NEWAX development discipline. No shortcuts.

### Phase 1: Repository discovery

- Inventory all relevant repositories and default branches.
- Inspect authentication, user models, database schemas, migrations, existing dashboards, routes, and tests.
- Identify duplicated implementations and incompatible assumptions.
- Produce a dependency map and implementation plan.
- Record existing security gaps and migration risks.

### Phase 2: Architecture and contracts

- Finalize nID identity and session contracts.
- Define the shared Core dashboard interfaces.
- Specify service registration and authorization.
- Document the bootstrap and deployment workflow.
- Review the plan before implementing cross-repository changes.

### Phase 3: nID implementation

- Implement password credentials and genuine account provisioning.
- Add migrations and backward-compatibility handling.
- Harden SSO and production configuration.
- Add security and integration tests.

### Phase 4: Core implementation

- Implement the shared shell and dashboard contracts.
- Add layout persistence and service registration.
- Verify permissions and tenant-scoped behavior.

### Phase 5: Communicator reference integration

- Connect nID.
- Remove production mock authentication.
- Integrate the Core shell.
- Implement the first real service widgets.
- Test full sign-in, return path, access denial, expiry, and logout.

### Phase 6: Remaining services

- Integrate one service at a time.
- Reuse approved contracts rather than copying code.
- Test each service's own authorization and data boundaries.
- Document every migration and deployment change.

### Phase 7: Release verification

Run the repository's actual build, lint, typecheck, unit, integration, migration, and security checks. Record the results and unresolved failures.

Do not claim success because code was committed or a page rendered locally.

---

## 12. Acceptance criteria

The work is complete only when all of the following are demonstrated:

1. A real nID account is provisioned securely and can sign in with its username and password.
2. The initial password is never committed, logged, or included in a PR.
3. Account recovery and password change work under the configured security policy.
4. Registered NEWAX services use the central identity flow.
5. Successful sign-in returns the user to the correct, validated service destination.
6. Production mock authentication is disabled and verified.
7. Core supplies one reusable dashboard shell.
8. Each service loads its own authorized data and layout through documented interfaces.
9. Unauthorized users cannot access another service's data by editing URLs, request bodies, browser storage, or dashboard configuration.
10. Cross-tenant access tests pass.
11. Session expiry, revocation, callback replay, invalid state, invalid PKCE, and unsafe redirect tests pass.
12. Responsive layouts, accessibility, loading states, empty states, and failures are tested.
13. Documentation, environment configuration, migrations, rollback instructions, and operator provisioning steps are complete.
14. CI checks and security review pass before production release.

## Final instruction to the developer

Do not treat this as a collection of unrelated login pages and dashboards. Implement a governed identity and application infrastructure shared across NEWAX.

nID establishes identity. Core provides the shared application shell and dashboard framework. Each service owns its operational data and business rules. Permissions are enforced server-side throughout the system.

The intended outcome is simple for the user, explicit for the developer, secure by design, and maintainable across every NEWAX repository.
