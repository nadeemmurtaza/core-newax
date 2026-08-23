# ADR 0045: Establish Growth Domain

## Purpose

Establish the Core domain that owns campaigns, audiences, leads, opportunities, touchpoints,
attribution, and consent, and define its boundary with project domains.

## 1. Decision Title

ADR 0045: Establish Growth Domain

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

Three NEWAX project domains have independently built overlapping versions of the same concepts.
One holds contacts, leads, segments, tags, and interactions. One holds contacts, leads, sequences,
and consent. One holds person candidates, compliance records, and complaint records.

Each was built because the project needed it and no shared definition existed. The result is three
definitions of a lead and, more seriously, three records of whether a person may be contacted.

ADR 0039 establishes that core owns shared concepts and projects own domain-specific ones. Growth
concepts are shared by construction: a person's relationship with NEWAX spans projects.

## 5. Problem

**Consent split across databases is a compliance exposure.** Whether NEWAX may contact a person
currently depends on which project is asking. A withdrawal recorded in one project is invisible to
the others, so a person who opted out continues to receive contact from a different system. This
is not an inconsistency to reconcile later; it is a failure at the moment it occurs.

**Attribution is impossible from inside a project.** A person may arrive through a website, receive
a message from one project, and convert in another. No project observes the whole journey, so no
project can attribute it. Only core can.

**Definitions diverge further with every release.** Each project continues developing its copy.
The cost of convergence grows while nothing forces agreement.

**Every new project adds another copy.** Without a core definition, a new project needing a lead
concept builds a fourth.

## 6. Decision

NEWAX establishes a Growth domain in the Core NEWAX Database.

The domain owns:

- **Campaigns.** Definition, status, and their relationship to tenants and organizations.
- **Audiences and segments.** Definitions and membership.
- **Leads and opportunities.** Including pipeline stage and progression.
- **Touchpoints.** The person-level record of interactions across every project and surface.
- **Attribution.** Models and their derived output.
- **Consent.** Per person, per purpose, per channel, with provenance.
- **Suppression.** Derived from consent withdrawal, complaints, and compliance events.

The domain does not own what happened inside a project. An order, an enrolment, a message
delivery, and a reply are project-owned facts. A project reports them as canonical events; core
decides what they mean for a campaign, an attribution model, and a destination.

**Consent is a gate, not a field.**

- Consent is recorded per person, per purpose, and per channel. Consent to be contacted about a
  transaction is not consent to be advertised to.
- Consent records provenance: when, through what mechanism, and under which policy version.
  Consent without provenance is not defensible.
- Withdrawal is immediate and global across every NEWAX project.
- Suppression state propagates to projects as an event so a project holding a mirror knows not to
  act without checking.
- Regional rules gate purposes and destinations independently.

**Consent is authoritative from the moment the domain exists.** Until project-level consent records
converge per the convergence map, the core record is authoritative and project records are
candidates. There is no interim period in which both are authoritative.

**Growth is tenant-scoped.** Campaigns, audiences, leads, touchpoints, and consent belong to a
tenant. Nothing crosses a tenant boundary, per ADR 0027.

**Attribution output is derived and reproducible.** Touchpoints are the record of what happened.
Attribution is computed from them, so changing a model re-derives rather than rewrites history.

## 7. Reasoning

Consent leads this decision because its failure mode is regulatory rather than technical. Every
other Growth concept can tolerate a period of divergence; consent cannot, because contacting
someone who withdrew is a harm at the moment it happens.

The concepts belong in core because they are person-level and the person spans projects. A lead
that exists in one project's database is not a lead NEWAX has; it is a lead that project has, and
the difference becomes visible the first time two projects contact the same person.

Keeping delivery mechanics in projects preserves the ADR 0039 boundary. How a message is sent is
genuinely domain-specific. Whether it may be sent is not.

Separating touchpoints from attribution keeps the record honest. If attribution were stored as the
primary fact, changing a model would rewrite history, and comparing two models on the same data
would be impossible.

Three existing implementations are inputs to the core design rather than candidates for wholesale
adoption. Each was shaped by one project's needs, and adopting one would import those assumptions
into the shared definition.

## 8. Alternatives Considered

**Leave Growth concepts in projects and reconcile through reporting.** No migration required.
Rejected because it does not solve consent, which cannot be reconciled after the fact, and because
divergence continues.

**Adopt one existing project implementation as the core definition.** Fastest path to a schema.
Rejected because each implementation encodes one project's assumptions, and the shared definition
needs to serve projects that do not exist yet.

**Core owns consent only; other Growth concepts stay in projects.** Addresses the compliance
exposure at minimum cost. Rejected because attribution then remains impossible, and leads and
touchpoints continue to diverge. Consent first is the right order, not the right endpoint.

**Adopt an external CRM as the system of record.** Rejected because it makes a third party
authoritative for consent and person identity, and because integrating it would require exactly the
core Growth definitions this ADR establishes.

## 9. Consequences

Positive:

- One consent record, one withdrawal, effective across every NEWAX system.
- Cross-project attribution becomes possible.
- One definition of a lead, a segment, and a touchpoint.
- A new project inherits Growth rather than building a copy.
- Compliance position becomes defensible with provenance and audit.

Cost:

- A substantial new core domain to design, build, and operate.
- Three existing project implementations must converge, which is migration work with real risk.
- Projects gain a dependency on core for consent decisions.
- Touchpoint volume is high and grows with activity.
- Consent checks sit on the outbound path and must be fast and available.

## 10. Impact On NEWAX Core

Growth is a business-domain layer above the Central Registry. It depends on People, Organizations,
Contacts, and Tenants. Nothing in the foundation layer depends on it.

Growth is the largest consumer of master data governance under ADR 0044, because attribution and
consent both require that a person resolves to one record.

## 11. Impact On Client Systems

A client gains one view of a person's relationship with them across every NEWAX project, and one
place where consent is recorded and honoured.

Convergence is client-visible during migration, because consent and lead records move. It must be
sequenced per the convergence map rather than performed in one step.

## 12. Security Considerations

Consent and suppression records are compliance evidence. They must be auditable, tamper-evident,
and retained per policy. An unaudited change to a consent record destroys its evidentiary value.

Touchpoints are behavioural data about identified people and are sensitive. Access is
permission-gated, and mirroring touchpoints into a project database requires review rather than
self-selection, per the project integration standard.

Consent checks must fail closed. If consent state cannot be determined, the outbound action does
not proceed.

Tenant scoping is a security boundary. An audience or touchpoint must never cross tenants, per
ADR 0027.

## 13. Scalability Considerations

Touchpoints are the highest-volume entity in this domain and grow with activity rather than with
customer count. They require a retention position and are a candidate for partitioning.

Consent checks are on the outbound path, read-heavy, and latency-sensitive. They require caching
with bounded staleness, and withdrawal must invalidate quickly enough that suppression is effective
rather than eventual.

Attribution is computed rather than served live, so it can be batched. Segment membership
evaluation grows with audience count multiplied by person count and must be incremental.

## 14. Maintenance Considerations

Consent policy changes with regulation, so purposes, channels, and regional rules must be data
rather than code. A policy change that requires a deploy will be late.

Attribution models proliferate. Each needs an owner and a reason to exist, or the domain
accumulates models nobody can explain.

The convergence from three project implementations is the highest-risk maintenance work in this
plan and is sequenced in the convergence map rather than left to each project.

## 15. Related Documents

- [Growth and Measurement Architecture](../architecture/growth-and-measurement-architecture.md)
- [Core Convergence Map](../architecture/core-convergence-map.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [ADR 0027: Separate Tenant Ownership from Organizations](0027-separate-tenant-ownership-from-organizations.md)
- [ADR 0033: Build Audit Governance Foundation](0033-build-audit-governance-foundation.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0044: Establish Master Data Governance](0044-establish-master-data-governance.md)
- [ADR 0046: Establish Measurement and Tag Management Domain](0046-establish-measurement-and-tag-management-domain.md)

## 16. Approved By

NEWAX Engineering, Architecture, and Security.
