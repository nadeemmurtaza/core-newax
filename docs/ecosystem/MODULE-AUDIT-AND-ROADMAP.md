# NEWAX Ecosystem: Module Audit and Decoupling Roadmap

## Purpose

NEWAX is nine repos meant to operate as one ecosystem under one login:
`nID`, `core-newax`, `erp-1` (Yaseen), `newcom` (`esp`/nmail +
`collab-service` + `web` + `campaign-service`), `Communicator`, and
`harvester`, plus `AegisDesk` as a separate track. This document is the
grounded audit of where modules currently sit vs. where they belong, the
identity-ownership decision that resolves the biggest conflict, and the
phased plan to get from today's state to the target state.

Every claim below comes from direct inspection of each repo's actual file
tree, Prisma schema, and (for `core-newax`) its own ADRs and architecture
docs — not from READMEs, which can describe aspiration rather than current
state.

## The central conflict: two identity foundations

`core-newax` and `nID` were independently built with the same foundation
layer — identity, organizations, users, roles, permissions.

- `core-newax` has ADR 0010/0017/0020/0026 (authentication service, OAuth)
  and `packages/auth`, `users`, `organizations`, `memberships`, `roles`,
  `permissions`, `tenants`, `access-control` already scaffolded, per
  `docs/architecture/core-architecture.md`'s Layer 1 (Foundation) including
  Authentication.
- `nID` has a working, proven OAuth identity system: `Account`,
  `AccountSession`, `AccountOtpCode`, `OAuthClient`, `OAuthLoginRequest`,
  `TenantStaffMembership`, `TenantApiKey` in its Prisma schema, and live
  `modules/oauth`, `modules/sessions`, `modules/accounts`, `core/auth` in
  its API. `newcom/esp` (internally `nmail`) already consumes it —
  `esp/nid_auth.go` implements the full "Login with nID" authorization-code
  exchange, mapping one nID Account to one local `users` row via
  `users.nid_account_id`. This is a reference implementation, not a
  hypothetical.

**Decision: nID wins.** nID is the single identity provider — login, 2FA,
OAuth sessions, and the secrets vault (every service's scoped, encrypted
API keys and env-level secrets, fetched at boot, never committed to a
repo — this reuses nID's existing `TenantApiKey` model). `core-newax`'s
competing `packages/auth`, `users`, `organizations`, `memberships`, `roles`,
`permissions`, `tenants` are deprecated or reduced to a thin client library
(`@newax/nid-client`) wrapping nID's OAuth and session validation.
`core-newax` does not run a parallel identity system.

## core-newax's charter

Two tests govern what belongs in `core-newax`'s database, both must be
true, not just one:

1. **Shared or public, not private.** Data or a module goes in `core-newax`
   only if it's genuinely shared across domains, or public (not scoped to
   one organization, tenant, or individual). This extends the existing rule
   in `docs/architecture/central-registry-architecture.md` section 2 ("not
   a dumping ground for every shared-looking table") from identity-only to
   shared/public data generally.
2. **Build once, reuse everywhere.** If two or more domains would otherwise
   each build the same capability, it's built once here and every domain
   calls it — core-newax's own stated mission (`README.md`), extended to
   cover shared data as well as shared code.

Everything else — even things that feel foundational — stays in the domain
that owns it.

## Per-project purpose, ownership, and limits

| Project | Purpose | Owns | Must never own | Limitation |
|---|---|---|---|---|
| **nID** | Single identity: login, 2FA, OAuth sessions, secrets vault | Account, Session, OAuthClient, 2FA, per-service scoped secrets | Business data of any kind | Stays client-neutral |
| **core-newax** | Build-once-reuse-everywhere foundation: Module Gateway, event bus, shared/public data, cross-domain read-model for BI | Module registry, gateway, event bus, shared design tokens/libs, audit-log aggregation | Competing auth/user/org system; any domain's private business data | Never the system of record for identity or private domain data; writes flow in via events, never direct table access |
| **erp-1 (Yaseen)** | Commerce/ERP: catalog, orders, fulfillment, inventory, finance, HR | `sales/*`, `supply-chain/*`, `money/*`, `people/hr,payroll,attendance`, `merchandising/catalog,collections,content` | CRM/support/conversations, marketing campaigns, identity verification, its own user model, AI/RAG | Financial truth lives here; nothing else posts to the ledger directly |
| **Communicator** | Omnichannel outreach + AI reply: conversations, drafts, broadcasts | Conversations, messages, drafts, automation rules, knowledge base, broadcasts | RBAC/SSO, billing, generic ticketing/SLA, generic webhooks engine, its own email-sending infra | Becomes an nID OAuth client and a Module Gateway publisher/subscriber |
| **newcom/esp (nmail)** | The one email engine | All outbound email transport for every other project | Campaign strategy/segmentation (the calling domain's job) | Every project calls nmail; none run their own SMTP integration |
| **newcom/collab-service** | Real-time collaborative documents (Yjs CRDT) | Internal docs/notes collaboration | Customer-facing messaging | Narrow scope, not a chat/CRM product |
| **newcom/web** | The unified workspace shell | Login via nID, module launcher from nID's org-membership data | Business logic of any domain | Pure shell + navigation |
| **harvester** | Lead sourcing/qualification | Lead discovery, qualification scoring | Outreach/messaging | Already correctly decoupled via REST to Communicator — the model for every other integration |
| **AegisDesk** | Offline-first Android device agent | On-device automation | Any networked ecosystem integration, unless its own design changes | Separate track; "no Internet permission" is a core constraint today |

## Confirmed misplacements (by repo)

**erp-1** (`apps/api/src/modules/*`):
- `customers/crm,support,notify,onsitemessages,notification-preferences` —
  CRM/support/messaging territory, belongs to Communicator.
- `merchandising/marketing` — campaign logic, duplicated 3 ways (also in
  `newcom/campaign-service` and Communicator's broadcasts).
- `system/identity-verification` — belongs to nID.
- `system/users` — a third independent user model (after core-newax and
  nID); belongs to nID.
- `system/rag` — AI/knowledge-base logic, overlaps Communicator's reply
  engine and knowledge base.

**newcom**: `esp` (Go), `collab-service` (Node), `web` (Vite, mostly
unfilled), and `campaign-service` (Java) are four unrelated services
bundled in one repo — see the splitting criteria below.

**Communicator**: grew RBAC, SSO/SAML, Stripe billing, a full ticketing
system, SLA tracking, audit logs, and a generic outgoing-webhooks engine
outside this ecosystem's boundaries. Each has an existing or planned owner:
RBAC/SSO → nID, billing → erp-1 (`modules/money`), tickets/SLA → erp-1
support (or stays Communicator-scoped if narrowed to conversation-level),
audit logs → core-newax's `packages/audit`, webhooks engine → the Module
Gateway below.

## The Module Gateway

Built in `core-newax`, **Layer 2: Platform Services**, as the concrete
implementation of ADR 0005 (event-driven module communication, currently
direction-only) and ADR 0009 (module registry). Two parts:

1. **Synchronous path** — a thin API gateway every project's API sits
   behind. Direct service-to-service calls between repos are disallowed by
   policy; everything routes through this gateway, which logs every
   cross-module call against the module registry.
2. **Asynchronous path** — an actual event bus (what ADR 0005 stopped short
   of building). Each project publishes domain events
   (`lead.captured`, `deal.won`, `invoice.paid`, `message.received`, etc.);
   `core-newax`'s read-model aggregator and any interested project
   subscribe, instead of reading each other's databases.

`registry/module-registry.json` (already drafted, `registry_status: draft`)
becomes the gateway's live routing/validation config: which modules exist,
their `exposed_events`/`consumed_events`, `dependencies`, and
`database_ownership`. Add a `shared_capability` flag for cases like the
campaign-engine triplicate above, so the registry also forces a
build-once decision, not just event routing.

## When to split a repo's bundled services

Default is **modular monolith first** (ADR 0001) — split only on a concrete
trigger, not on sight:

**Split when:** different languages/runtimes with no shared deploy
lifecycle; genuinely unrelated products sharing a repo by accident;
different scaling profiles; different team ownership.

**Don't split when:** the services share a data model and deploy together
naturally — splitting then just adds the distributed-transaction cost ADR
0001 warns against, for no benefit. "Feels cleaner" is not a trigger.

Applied here:
- **newcom → split.** `esp` (Go) and `collab-service` (Node) are unrelated
  products, different languages, no shared deploy lifecycle — the clean
  trigger case. `esp` → its own repo (keep the `nmail` name). `collab-
  service` → its own repo. `web` → its own repo, or folds into the
  workspace-shell phase below. `campaign-service` → resolves into whichever
  repo wins the campaign-engine triplicate, not a fifth bundled service.
- **Communicator → don't split, post-cleanup.** Conversations, messages,
  drafts, automation, knowledge base, and broadcasts share one data model
  and deploy lifecycle once the RBAC/SSO/Stripe/tickets scope above is
  removed.
- **erp-1 → don't split further than the moves above.** `apps/api/web/pos/
  mobile` are already the right boundary (API vs. client surfaces).

## Phased roadmap

**Phase 0 — Foundation lock-in**
- `core-newax`: deprecate `packages/auth,users,organizations,memberships,
  roles,permissions,tenants` → thin `@newax/nid-client`.
- `nID`: document the "Login with nID" flow nmail already proved as the
  standard integration pattern.
- `nID`: add the Secrets Vault module, migrate nmail's own secrets into it
  first as the proof case.

**Phase 1 — Module Gateway MVP**
- Build the gateway + event bus in `core-newax`.
- Promote `module-registry.json` from draft to live config.
- Register nmail (already decoupled, already an nID client) as the first
  module — lowest risk, proves the pattern end-to-end.

**Phase 2 — Communicator cleanup**
- Remove the bolted-on RBAC/SSO/Stripe/webhooks/SLA scope; adopt
  Login-with-nID; register events with the gateway.
- Route outbound email through nmail instead of its own channel.

**Phase 3 — erp-1 de-conflict**
- Move `customers/crm,support,notify,onsitemessages` → Communicator/CRM.
- Resolve the `merchandising/marketing` triplicate (likely Communicator,
  since its broadcast engine is already built and tested).
- Remove `system/identity-verification` and `system/users` → nID.
- Resolve `system/rag` vs. Communicator's knowledge base (likely
  Communicator).
- Adopt Login-with-nID.

**Phase 4 — Shell & collaboration**
- `newcom/web` becomes the real workspace shell: nID login, module
  launcher from org-membership data and the gateway's registry.
- `newcom/collab-service` wires into the shell.

**Phase 5 — Aggregation**
- `core-newax`'s read-model aggregator consumes the event bus for
  cross-project BI — read-only, no live cross-service DB access, ever.

**Separate, unscheduled**
- `AegisDesk`: revisit only after an explicit product-direction decision on
  its "no Internet permission" constraint.
