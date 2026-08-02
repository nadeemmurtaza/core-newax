# NEWAX Core

## The private foundation for NEWAX business infrastructure

NEWAX Core is the internal engineering foundation used to build the systems modern organizations depend on.

NEWAX is **The Business Infrastructure Company**. This repository supports that position by establishing a reusable, governed foundation for Enterprise Software, Intelligent Automation, and Connected Infrastructure.

> Build infrastructure once, own it, improve it deliberately, and reuse it safely.

## Current Status

NEWAX Core is now in **executable platform-foundation mode**.

The repository contains:

- A working TypeScript monorepo
- A NestJS API application
- A Next.js web application
- An internal People Intake data-entry and verification workspace
- PostgreSQL and Prisma database infrastructure
- Strict environment validation
- Automated tests and production builds
- GitHub Actions continuous integration
- Architecture Decision Records
- Engineering and module standards
- A governed Module Registry
- Reusable module and deployment templates

The repository does **not yet contain approved production business-module implementations**. Registry entries remain `planned` until implementation, testing, security review, and formal activation are complete.

## Technology Baseline

ADR 0011 establishes the accepted implementation stack:

- Node.js `24.18.0`
- pnpm `11.11.0`
- TypeScript `6.0.3`
- NestJS `11` for the API
- Next.js `16` with the App Router for the web application
- PostgreSQL `18`
- Prisma `7`
- REST and OpenAPI for public API contracts
- Vitest for unit and integration testing
- Playwright for browser testing
- GitHub Actions for continuous integration
- Docker-compatible deployment foundations
- S3-compatible object storage when file infrastructure is introduced

The architecture remains a **modular monolith first**. Microservices, Kubernetes, Redis, message brokers, GraphQL, Nx, and Turborepo are not mandatory starting dependencies.

Read:

- [ADR 0011: Define Technology Stack and Implementation Baseline](docs/decisions/0011-define-technology-stack-and-implementation-baseline.md)
- [Architecture Decision Records](docs/decisions/README.md)

## Repository Applications

### API

`apps/api` is the deployable NestJS application.

It currently provides:

- Environment validation
- PostgreSQL connection configuration
- Prisma client generation
- Database lifecycle management
- Health endpoints
- Test and production build commands

### Web

`apps/web` is the deployable Next.js application.

It currently provides:

- App Router structure
- Environment validation
- Production configuration
- Search-indexing controls
- Unit tests
- Production build support

## Repository Structure

```text
apps/
  api/                    NestJS API application
  web/                    Next.js web application

packages/                 Reusable platform and business modules
  organizations/
  people/
  users/
  roles/
  permissions/
  audit/
  ...

docs/
  architecture/           System architecture
  decisions/              Architecture Decision Records
  standards/              Engineering and governance standards

registry/
  module-registry.json    Planned and approved module metadata

templates/                Reusable engineering and governance templates

tooling/                  Shared repository tooling
```

Applications compose approved modules. Business logic should not accumulate inside `apps/api` or `apps/web` merely because those directories are conveniently nearby.

## Core Architecture Principles

### Modular monolith first

Begin with one deployable system while preserving strong internal module boundaries. Extract services only when scaling, security, ownership, or deployment evidence justifies the additional operational cost.

### Organization-scoped multi-tenancy

Tenant-aware modules must enforce organization boundaries across APIs, services, database queries, reports, exports, files, dashboards, events, and administrative access.

### Permission-based authorization

Business actions are authorized through explicit permissions such as:

```text
students.view
payments.approve
reports.export
```

Roles group permissions for administrative convenience. Business logic must not depend on hardcoded role names.

### Central identity and organization foundation

The architecture separates:

- Person
- User account
- Organization
- Membership
- Role
- Permission
- Contact
- Audit record

Business domains reference these shared records rather than inventing parallel identity systems.

### Controlled customization

Client-specific behavior should use this order of preference:

1. Configuration
2. Approved events and listeners
3. Public module APIs or services
4. Adapters
5. Explicit client extensions

Client customization must remain visible and separate from reusable core modules.

## Module Lifecycle

Modules follow this lifecycle:

```text
planned -> draft -> active -> deprecated -> replaced or archived
```

Only `active` modules may be treated as approved for controlled reuse.

Activation requires:

- Defined scope and ownership
- Complete documentation
- Declared dependencies
- Permission review
- Tenant-isolation review where applicable
- Database ownership review
- API and event review
- Required tests
- Security review
- Version and changelog records
- Product and Engineering approval
- Updated Module Registry metadata

Read:

- [Module Standard](docs/standards/module-standard.md)
- [Module Approval Checklist](docs/standards/module-approval-checklist.md)
- [Module Registry](registry/module-registry.json)

## Local Setup

Requirements:

```text
Node.js 24.18.0
pnpm 11.11.0
PostgreSQL 18
```

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Create local API environment configuration:

```bash
cp apps/api/.env.example apps/api/.env.local
```

Generate the Prisma client:

```bash
pnpm --filter @newax/api db:generate
```

Run applications in development:

```bash
pnpm dev
```

## Verification Commands

Run the repository checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The API also provides database-specific commands:

```bash
pnpm --filter @newax/api db:validate
pnpm --filter @newax/api db:migrate
pnpm --filter @newax/api db:migrate:deploy
pnpm --filter @newax/api db:studio
```

## Contribution Rules

- Use feature-based commits.
- Keep unrelated changes separate.
- Review applicable ADRs and standards before implementation.
- Update tests and documentation with behavior changes.
- Declare module dependencies and database ownership.
- Preserve tenant and permission boundaries.
- Keep client-specific behavior outside reusable core modules.
- Do not commit secrets, generated Prisma clients, or real client data.

## Current Gaps

Before the first production business module can be activated, the repository still requires:

- A canonical reusable module package scaffold
- Stable green CI across formatting, linting, type-checking, tests, and builds
- Authentication implementation
- Event implementation strategy in executable code
- File-storage implementation
- Observability implementation
- Backup and recovery implementation plan
- Automated Module Registry validation
- Complete documentation for the first approved module

The first planned business capability is the **Organization Registry**. Its implementation remains paused until the repository foundation passes verification cleanly.

## Long-Term Objective

NEWAX Core should become the dependable internal foundation from which NEWAX designs, builds, connects, deploys, and supports business-critical systems.

It should help NEWAX:

- Simplify operational complexity
- Connect systems
- Eliminate manual work
- Improve visibility
- Strengthen operations
- Increase long-term control
- Build with confidence

The repository succeeds when NEWAX can build different client systems without rebuilding the same foundations, compromising ownership, or creating infrastructure that only its original author understands.

## Planned Data Ingestion and Normalization Engine

NEWAX Core is planned to provide one governed ingestion engine for data arriving from Harvester, Communicator, website forms, approved imports, partner APIs, enterprise modules, Connected Infrastructure, and future NEWAX systems.

Source systems will send versioned source-native payloads through a standard integration envelope. Core will own durable intake, raw-data preservation, source schemas, adapters, normalization, candidate entities, identity resolution, provenance, field ownership, merge policy, and canonical Registry writes.

The architecture deliberately separates:

```text
Raw observation
→ Entity candidate
→ Canonical entity
→ Business roles and classifications
→ Lead, customer, supplier, partner, competitor, or other relationship
```

An organization or person may exist in the Registry without being a lead. Lead qualification is a separate commercial interpretation and must not act as an admission gate for entity existence.

Harvester may publish two independent automatic streams when its optional Core integration is enabled:

1. Every accepted raw observation after durable local storage.
2. Every new or materially changed canonical entity after Harvester resolution and validation.

Both streams use durable event identity, payload hashing, retries, provenance, and reconciliation. Core performs final canonical formatting rather than forcing every source to duplicate Registry-specific transformation logic.

Read the complete planned architecture:

- [Data Ingestion and Normalization Engine](docs/architecture/data-ingestion-and-normalization-engine.md)

The open source-specific Lead Harvester integration remains pending work. It should become the first adapter behind the common engine, not the permanent architecture for every future source.

## Standalone Product Ecosystem Boundary

Harvester and Communicator are standalone, resellable applications. Each application owns its database, authentication, tenant isolation, credentials, source schemas, mappings, normalization, synchronization, audit, backup, restore, and product-specific business model.

NEWAX Core is an optional shared infrastructure layer for identity, relationships, provenance, field ownership, governance, source facets, integration routing, and controlled context. It must not be a hidden runtime dependency for either product.

```text
Harvester only
Sources → Harvester → leads, dossiers, exports, APIs, or customer systems

Communicator only
Customer data → Communicator → groups, audiences, campaigns, conversations, and replies

Harvester + Communicator
Harvester publishing rule → direct adapter → Communicator mapping and normalization

Full NEWAX deployment
Harvester and Communicator → optional NEWAX Core identity and governance
```

The products never share private tables or database credentials. They communicate through versioned APIs, signed webhooks, durable events, commands, approved database connectors, files, queues, or object storage.

The same source record may be formatted differently by each application:

```text
Harvester
Observation, evidence, resolved lead entity, qualification, score, and dossier

Communicator
Communication profile, contact channel, group, audience, conversation, and engagement

NEWAX Core
Existence, canonical identity, relationships, provenance, and governed source facets
```

Core may store bounded source-owned facets and permanent external references, but it should not duplicate every Harvester dossier or Communicator transcript. Core downtime must create a recoverable integration backlog, not a Harvester or Communicator outage.

Read:

- [Standalone Product Ecosystem and Optional Core Integration](docs/architecture/standalone-product-ecosystem.md)
- [Standalone Product Ecosystem Roadmap](docs/ROADMAP-STANDALONE-PRODUCT-ECOSYSTEM.md)

### Locked rule

> NEWAX Core strengthens connected products without taking away their independent operation, data ownership, formatting autonomy, or resale capability.
