# NEWAX Tenants Module

## Status

Draft reusable foundation module. Version `0.1.0`.

## Purpose

Tenant is the customer ownership and data-isolation boundary in NEWAX Core. A Tenant has its own stable UUID and may contain one or more Organizations.

Tenant owns the commercial and deployment relationship. Licensing, deployment, support entitlement, data-region, retention, and other customer-level capabilities must reference `tenant_id` through their own modules rather than being embedded as unrelated columns in Organizations.

Organization represents legal and operating entities inside a Tenant, including companies, branches, departments, schools, hospitals, institutions, and business units.

## Database ownership

- `core_tenants`

## Initial operations

- Create tenant.
- Read tenant by ID.
- List tenants with bounded pagination.

The initial foundation deliberately defers tenant update, suspension, archive, licensing, deployment, and support workflows until their business rules are separately approved.

## Permissions

- `tenants.view`
- `tenants.create`

## Architectural rule

Global people, users, credentials, and reusable contact methods do not belong to one Tenant. Every Organization belongs to exactly one Tenant, and organization hierarchy and organization-to-organization relationships must remain inside that Tenant.
