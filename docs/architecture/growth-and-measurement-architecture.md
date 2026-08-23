# NEWAX Growth and Measurement Architecture

## Purpose

This document defines the Growth and Measurement domains in the Core NEWAX Database: what they
own, where their boundary with project domains sits, and how NEWAX forwards conversion data to
external measurement and advertising destinations.

This document is for internal NEWAX engineering use. It does not define implementation code,
database migrations, or production modules.

## Core Principle

Core owns the definitions and the person-level truth. Projects own their conversions.

A project reports what happened in its own domain. Core decides what that means for a campaign, an
audience, an attribution model, and a destination. No project talks to an advertising platform
directly.

## 1. Why This Belongs In Core

Three NEWAX project domains have independently built overlapping versions of the same concepts:
contacts, leads, segments, interactions, sequences, consent, and compliance suppression. Each
implementation is reasonable in isolation. Together they are three definitions of a lead and three
records of whether a person consented.

Consent is the clearest case. If consent lives in three project databases, then whether NEWAX may
contact a person depends on which project is asking, and a withdrawal recorded in one is invisible
to the others. That is a compliance failure, not an inconsistency.

Attribution is the second case. A person may encounter NEWAX through a website, receive a message
from one project, and convert in another. No project can attribute that journey because no project
sees all of it. Only the core can.

## 2. The Two Domains

**Growth** owns what NEWAX knows about acquiring and progressing a relationship: campaigns,
audiences and segments, leads, opportunities, pipeline stages, touchpoints, attribution, and
consent.

**Measurement** owns how NEWAX observes and reports that activity to external systems: tag
containers, destinations, event mapping, and server-side forwarding.

They are separate because they change for different reasons. Growth changes when the business
changes how it sells. Measurement changes when an external platform changes its API.

## 3. The Boundary With Projects

| Concern                                                       | Owner   |
| ------------------------------------------------------------- | ------- |
| Campaign definition                                           | Core    |
| Audience and segment definition                               | Core    |
| Lead and opportunity records, pipeline stage                  | Core    |
| Touchpoints and the person-level journey                      | Core    |
| Attribution model and its output                              | Core    |
| Consent record and suppression state                          | Core    |
| Tag container and destination configuration                   | Core    |
| Canonical event definitions                                   | Core    |
| Forwarding to GA4, Meta, and other destinations               | Core    |
| What happened in the project: an order, an enrolment, a reply | Project |
| Project-specific workflow and delivery mechanics              | Project |

The test: if the answer must be the same across every NEWAX system, it is core. If it only means
something inside one domain, it is the project's.

A project emits a canonical event saying a conversion occurred. It does not decide which campaign
gets credit, whether the person consented, or which destination is told.

## 4. Consent Is A Gate, Not A Field

Consent is not an attribute stored alongside a contact. It is a gate every outbound action passes
through.

- Consent is recorded per person, per purpose, and per channel. Consent to be contacted about an
  order is not consent to be advertised to.
- Consent has provenance: when it was given, through what mechanism, and under which policy
  version. Consent with no provenance is not defensible.
- Withdrawal is immediate and global. A person who withdraws consent is suppressed across every
  NEWAX project, which is only possible because the record is central.
- Suppression state propagates to projects as an event, so a project holding a mirror knows not to
  contact someone without asking core first.
- Regional rules gate destinations independently. A destination permitted in one jurisdiction may
  be prohibited in another for the same person.

Existing project-level consent and compliance records converge here. Until they do, the core
record is authoritative and the project records are candidates.

## 5. Measurement and Tag Management

### Containers and destinations

A container represents one measurable surface: a website, an application, one per environment. A
destination represents one external system that receives events, such as a GA4 property or a Meta
pixel with its Conversions API.

Destination credentials are held as secret references and resolved at runtime. Credential values
never appear in the database, in the repository, or in documentation, per
`docs/standards/environment-standard.md`.

### Event mapping

NEWAX defines its own canonical event vocabulary. A mapping translates a canonical NEWAX event
into each destination's required payload shape.

This indirection is what stops an external platform's schema becoming the internal one. When a
destination changes its API, the mapping changes. Projects, which emit canonical events, do not.

### Server-side forwarding

Forwarding happens from Core, not from the browser and not from a project.

Core receives the canonical event, resolves the person, checks consent for that destination and
region, applies the mapping, and calls the destination's server-side API.

Why this matters:

- **One consent gate.** Every destination call passes the same check. A browser tag can be blocked
  or can fire before consent resolves; a server-side call cannot.
- **One identity resolution point.** The same `person_id` is used across every project, so a
  journey spanning several projects resolves to one person.
- **One audit trail.** Every forwarded event is recorded with the consent state that permitted it,
  which is what makes a compliance position defensible after the fact.
- **No credentials in projects.** A project that never holds a destination token cannot leak one.
- **Onboarding stays cheap.** A Class C web property reaches full measurement integration by
  registering a container, not by shipping code.

### What Core does not do

Core does not replace a tag manager for presentation-layer concerns, and it does not decide
marketing strategy. It owns the data path and the consent gate.

## 6. Attribution

Attribution is computed in core because only core sees the whole journey.

- Touchpoints are recorded per person across every project and surface.
- Attribution models are definitions, and more than one may be applied to the same touchpoint set.
- Attribution output is derived and reproducible. It is never the only record of what happened, so
  changing a model re-derives rather than rewrites history.
- Attribution respects tenant boundaries. A touchpoint belongs to a tenant and never contributes
  across tenants.

## 7. Relationship To Analytics Rollup

Growth and Measurement are operational. The analytics rollup store is reporting.

A conversion is a Growth fact and drives forwarding and attribution. Its aggregate contribution to
a funnel is an analytics fact. Keeping these separate stops reporting queries from running against
operational tables and stops reporting requirements from distorting the operational model.

## 8. Convergence

The existing project-level implementations do not disappear when these domains are built. The
order in which they converge, and which tables become mirrors, is defined in
[Core Convergence Map](core-convergence-map.md).

## 9. Related Documents

- [Core Convergence Map](core-convergence-map.md)
- [Platform Data Topology](platform-data-topology.md)
- [Core Integration Platform](core-integration-platform.md)
- [Central Registry Architecture](central-registry-architecture.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [Environment Standard](../standards/environment-standard.md)
- [ADR 0045: Establish Growth Domain](../decisions/0045-establish-growth-domain.md)
- [ADR 0046: Establish Measurement and Tag Management Domain](../decisions/0046-establish-measurement-and-tag-management-domain.md)
- [ADR 0047: Establish Analytics Rollup Store](../decisions/0047-establish-analytics-rollup-store.md)
