# ADR 0003: Design for Multi-Tenancy

## Purpose

Document how NEWAX Core should support multiple client organizations over time while keeping the first implementation practical.

This ADR aligns NEWAX Core with its role as a reusable business infrastructure foundation that must support ownership, control, security, scalability, and long-term maintainability.

## 1. Decision Title

ADR 0003: Design for Multi-Tenancy

## 2. Status

Accepted, with the Tenant identity definition superseded by ADR 0027.

## 3. Date

2026-07-09

## 4. Context

NEWAX Core is being established as the private foundation for reusable business infrastructure modules and future client solutions.

NEWAX-powered systems may serve one client at a time at first, but the core architecture should not assume that a system will only ever support one organization.

Future NEWAX deployments may need to support multiple client organizations, business units, branches, or dedicated client environments while reusing the same foundation, platform services, and business modules.

## 5. Problem

If NEWAX Core is designed around a single-organization assumption, future multi-tenant support may require expensive rewrites.

Single-tenant assumptions can leak into:

- Database design.
- Permission checks.
- Configuration models.
- Audit logs.
- Reports.
- Integrations.
- Client customization logic.

NEWAX Core needs a practical tenant-ready direction that supports future growth without forcing every first project to launch as a full SaaS platform.

## 6. Decision

NEWAX Core will be designed to support multi-tenancy.

A Tenant represents the customer ownership and data-isolation boundary. Organizations represent legal and operating entities inside that Tenant. ADR 0027 defines the executable separation.

Examples:

- ABC Institute.
- XYZ Clinic.
- Alpha Law Firm.
- Retail Group Branch A.

Multi-tenancy does not mean every first project must launch as a full SaaS platform. The first products may be deployed for one client at a time. However, core architecture should avoid decisions that make future multi-tenancy difficult.

## 7. Reasoning

NEWAX Core is intended to be reusable across client systems and business domains.

Designing for multi-tenancy early gives NEWAX:

- Better long-term client support.
- Clearer data ownership.
- Safer permission boundaries.
- Better auditability.
- More flexible deployment options.
- Easier future SaaS or enterprise models.
- Reduced rewrite risk when multiple clients or organizations need to share a system.

The goal is tenant-ready architecture, not premature SaaS complexity.

## 8. Alternatives Considered

### Ignore Multi-Tenancy Until Later

This would simplify the earliest implementation, but it risks embedding single-organization assumptions throughout the system.

It was not selected because NEWAX Core is intended to become reusable business infrastructure.

### Full SaaS Multi-Tenancy From Day One

This would require a complete multi-tenant operational model immediately.

It was not selected because it may add unnecessary complexity for first client deployments.

### Database Per Tenant From The Beginning

This can provide strong isolation, but it creates operational overhead early.

It was not selected as the default starting point because NEWAX Core should begin with a practical tenant-ready approach and evolve when client requirements justify more complex isolation.

## 9. What Multi-Tenancy Means For NEWAX

For NEWAX, multi-tenancy means the architecture can support multiple client organizations or business units safely over time.

It means:

- Business records belong to an organization or tenant where appropriate.
- Modules must not assume there is only one organization forever.
- Tenant ownership should be considered in database design, permissions, configuration, audit logs, and reporting.
- One tenant must never access another tenant's records.
- Tenant-specific settings may vary without changing reusable core modules directly.

Multi-tenancy is an architectural direction, not a requirement that every first deployment be shared SaaS.

## 10. Tenant Definition

Use `Tenant` as the customer ownership and data-isolation identity. Every Tenant has its own UUID. Organizations are legal and operating entities inside one Tenant. Licensing, deployment, support entitlement, data-region, retention, and customer-level configuration reference Tenant identity through their owning modules.

ADR 0027 defines and implements this separation.

## 11. Tenant Data Ownership

Tenant-scoped business records should belong to an organization or tenant where appropriate.

Rules:

- Business records should include tenant ownership when they represent client-owned data.
- Shared reference data must clearly document whether it is global or tenant-scoped.
- Reports must respect tenant ownership.
- Audit logs should preserve tenant context when actions affect tenant-owned data.
- Integrations should document whether they are global, tenant-scoped, or client-specific.

Tenant ownership must be clear before reusable modules are approved for production use.

## 12. Tenant Isolation Rules

Tenant data must remain isolated.

Rules:

- One tenant must never access another tenant's records accidentally.
- Every tenant-scoped query must enforce tenant boundaries.
- Tenant boundaries must be enforced in services and APIs, not only in UI code.
- Cross-tenant access must be explicit, reviewed, and auditable.
- Test coverage should include tenant isolation for modules that own tenant-scoped data.
- Tenant isolation failures should be treated as security issues.

Tenant isolation is a core security requirement.

## 13. Tenant-Aware Modules

Modules must be designed so they can become tenant-aware when their data or behavior requires it.

Rules:

- Foundation modules should define organization and user relationships carefully.
- Platform services should preserve tenant context when handling tenant-owned records.
- Business modules should not assume a single global organization.
- Client solutions should compose tenant-aware modules without modifying reusable core modules directly.
- Modules should document whether their records are tenant-scoped, global, or mixed.

A module that handles client-owned data must explain its tenant ownership model.

## 14. Tenant-Aware Permissions

Permissions must be scoped by tenant where required.

Rules:

- A user may have different roles or permissions in different organizations when product requirements justify it.
- Permission checks should include tenant context when the protected action affects tenant-owned data.
- Role assignments should be tenant-aware.
- Permission grants, revocations, and sensitive tenant access changes should be auditable.
- Client-specific roles should map to documented permissions without modifying reusable core module code.

This aligns with ADR 0002: Use Permission-Based Access Control.

## 15. Tenant-Specific Configuration

Configuration may vary per tenant.

Examples of tenant-specific configuration may include:

- Enabled features.
- Branding.
- Notification preferences.
- Integration settings.
- Workflow settings.
- Reporting settings.

Rules:

- Tenant-specific configuration must not require direct modification of reusable core modules.
- Sensitive configuration must be protected.
- Configuration changes that affect security, access, integrations, or reporting should be auditable.
- Default configuration should remain safe and client-neutral.

Tenant configuration is a customization mechanism, not a reason to fork core modules.

## 16. Super Admin Access

Administrative access across tenants must be explicit and auditable.

Rules:

- Super admin capabilities must be clearly defined.
- Super admin access must not bypass audit requirements.
- Cross-tenant administrative access must be intentional, not accidental.
- Security-sensitive tenant changes must be logged.
- Super admin permissions should be granted sparingly and reviewed regularly.

Super admin behavior must be treated as a high-risk security area.

## 17. Database Strategy

NEWAX Core will start with a practical tenant-ready database strategy.

Initial direction:

- Prefer tenant ownership through `organization_id` or `tenant_id` on relevant records where appropriate.
- Do not force complex database-per-tenant architecture at the beginning unless a client requirement demands it.
- Document whether each module's data is tenant-scoped, global, or mixed.
- Keep tenant boundaries enforceable through services, APIs, and tests.
- Avoid schema decisions that make future tenant isolation or dedicated deployments difficult.

This ADR does not create database migrations.

## 18. Security Considerations

Multi-tenancy is a security concern.

Security rules:

- Every tenant-scoped query must enforce tenant boundaries.
- Administrative access must be explicit and auditable.
- Cross-tenant access must never happen accidentally.
- Tenant changes must be logged when security-sensitive.
- Permission checks must include tenant context when required.
- Tenant data leaks must be treated as severe security incidents.
- Client-specific customizations must not weaken tenant isolation.

Security review should be required for changes that affect tenant boundaries.

## 19. Scalability Considerations

Tenant-ready design supports future scale without requiring all scale mechanisms immediately.

Scalability direction:

- Start with a practical shared database approach where appropriate.
- Keep tenant ownership explicit in data models and services.
- Monitor tenant-specific performance and data growth.
- Allow future migration to stronger isolation when required.
- Avoid coupling tenant identity to a single deployment model.

NEWAX Core may later support single database tenant separation, separate database per tenant, hybrid deployment models, or dedicated enterprise deployments.

## 20. Maintenance Considerations

Tenant-aware architecture requires clear documentation and discipline.

Maintenance rules:

- Modules should document tenant ownership expectations.
- Tenant-scoped APIs and services should be tested.
- Reports and exports must respect tenant boundaries.
- Permission and configuration changes should document tenant impact.
- ADRs should be created for major changes in tenancy strategy.
- Client-specific behavior should remain outside reusable core modules unless promoted through architecture review.

Clear tenant ownership reduces future rewrite risk.

## 21. Impact On NEWAX Core

NEWAX Core must treat tenant awareness as an architecture concern.

Impact:

- Foundation modules must support organization-aware identity and permissions over time.
- Platform services must preserve tenant context where appropriate.
- Business modules must not assume one organization forever.
- Module standards should require documentation of tenant ownership.
- Audit and reporting architecture must include tenant context when relevant.
- Client customizations must not modify reusable core modules directly.

This decision strengthens NEWAX Core as reusable business infrastructure.

## 22. Impact On Client Systems

Client systems can begin as single-client deployments while remaining compatible with future multi-tenancy.

Impact:

- A client deployment may represent one tenant at first.
- Future client systems may support multiple organizations or business units.
- Client-specific settings should be configuration-based where possible.
- Client-specific customizations must not modify reusable core modules directly.
- Tenant-specific roles and permissions can evolve without changing core access logic.

This protects client systems from future migration pain.

## 23. Future Evolution Path

NEWAX Core may later support:

- Single database with tenant separation.
- Separate database per tenant.
- Hybrid deployment models.
- Dedicated enterprise deployments.
- Tenant-specific scaling strategies.
- Tenant-aware reporting and analytics layers.
- Stronger tenant isolation controls for regulated clients.

Future changes should be driven by client requirements, operational scale, security needs, compliance requirements, and evidence from real usage.

## 24. Related Documents

- [NEWAX Core Architecture](../architecture/core-architecture.md)
- [NEWAX Module Standard](../standards/module-standard.md)
- [ADR 0001: Use Modular Monolith First](./0001-use-modular-monolith-first.md)
- [ADR 0002: Use Permission-Based Access Control](./0002-use-permission-based-access-control.md)
- [Architecture Decision Record Template](./ADR-TEMPLATE.md)
- [Reusable Module Template](../../templates/module-template/README.md)

## 25. Approved By

Initial architecture direction approved for NEWAX Core foundation planning.

Approvers should be updated as formal Product, Engineering, Architecture, or Security ownership is assigned.
