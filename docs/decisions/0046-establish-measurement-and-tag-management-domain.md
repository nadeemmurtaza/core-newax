# ADR 0046: Establish Measurement and Tag Management Domain

## Purpose

Establish the Core domain that owns measurement containers, destinations, event mapping, and
server-side forwarding to external analytics and advertising platforms.

## 1. Decision Title

ADR 0046: Establish Measurement and Tag Management Domain

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

NEWAX operates web properties and applications that need to report conversions to external
platforms such as Google Analytics 4 and Meta, through their tag and server-side conversion
interfaces.

The conventional approach places a tag manager container and platform tags in the browser, with
each property configured independently and each holding its own destination configuration.

ADR 0045 establishes the Growth domain in core, including consent as a gate on every outbound
action. That decision makes browser-side forwarding untenable: a browser tag fires without
consulting core consent, and there is no way to prove after the fact which consent state permitted
a given call.

## 5. Problem

**Browser-side forwarding cannot enforce a consent gate.** A tag fires on page behaviour. It may
fire before consent resolves, may be blocked so that a permitted event is lost, and cannot consult
a central consent record.

**Identity does not resolve across properties.** Browser identifiers are per-property and per-device,
so a journey spanning a website and an application resolves to several people rather than one.

**Credentials spread.** Each property holding its own destination configuration means each holds
credentials, and a credential in a client-side property is exposed by construction.

**There is no audit trail.** After the fact, NEWAX cannot show which events were forwarded to which
destination under which consent state. A compliance position that cannot be evidenced is not a
position.

**Onboarding cost is per property.** Each new property configures destinations independently, so
measurement cost grows with property count.

## 6. Decision

NEWAX establishes a Measurement and Tag Management domain in the Core NEWAX Database, and
forwarding to external destinations happens from Core.

The domain owns:

- **Containers.** One per measurable surface per environment: a website, an application.
- **Destinations.** One per external system receiving events, such as a GA4 property or a Meta
  pixel with its Conversions API. Destination credentials are held as secret references resolved at
  runtime.
- **Event mapping.** The translation from a canonical NEWAX event to each destination's required
  payload.
- **Forwarding records.** What was forwarded, to which destination, when, and under which consent
  state.

**Forwarding is server-side, from Core.** Core receives the canonical event, resolves the person,
checks consent for that destination and region, applies the mapping, and calls the destination's
server-side interface.

**Projects hold no destination credentials and never call a destination directly.** A project emits
a canonical event. What happens next is core's decision.

**NEWAX defines its own canonical event vocabulary.** Destination payload shapes are a mapping
concern. An external platform's schema never becomes the internal one.

**Consent gates every forward.** A forward with indeterminate consent does not happen. Consent
state at the time of forwarding is recorded with the forwarding record.

**A Class C project reaches measurement integration by registering a container**, not by shipping
integration code.

Presentation-layer tag concerns that do not carry NEWAX data are out of scope. This domain owns
the data path and the consent gate.

## 7. Reasoning

Server-side forwarding follows from ADR 0045 rather than being an independent choice. Once consent
is a central gate, forwarding must happen where the gate is, and the gate cannot be in a browser.

It also produces three things browser-side forwarding cannot. One identity resolution point, so a
journey across properties resolves to one person. One audit trail, so the consent state that
permitted each forward is recorded. One credential boundary, so no property holds a destination
token.

Defining a canonical event vocabulary with a mapping layer is what stops external platforms
dictating the internal model. When a platform changes its API, a mapping changes and projects do
not. Without the mapping, every platform change becomes a change in every emitting project.

The onboarding property is what makes this scale. A new web property becomes measurable by
registering a container, which is a data change. Under browser-side configuration it is an
engineering task repeated per property.

Holding credentials as secret references rather than values follows
`docs/standards/environment-standard.md`, which forbids secrets in the repository, and keeps a
database compromise from becoming an advertising-account compromise.

## 8. Alternatives Considered

**Browser-side tag manager per property, the conventional approach.** Well understood, no core
infrastructure, and marketing teams can configure it without engineering. Rejected because it
cannot enforce the consent gate ADR 0045 establishes, cannot resolve identity across properties,
exposes credentials client-side, and produces no audit trail.

**Hybrid: browser tags for page behaviour, server-side for conversions.** Pragmatic and common.
Rejected as the platform decision because it splits the consent gate across two paths, so the
weaker path determines the actual compliance position. It remains available for presentation-layer
concerns carrying no NEWAX data, which this domain does not own.

**A third-party customer data platform.** Provides this capability without building it. Rejected
because it makes a third party authoritative for consent and identity resolution, and because
integrating it requires the same canonical event vocabulary and container model this ADR defines.

**Each project forwards its own conversions.** Rejected because it spreads credentials, produces
no cross-project identity resolution, and requires every project to implement consent checking
correctly.

## 9. Consequences

Positive:

- One consent gate in front of every destination.
- One identity resolution point across properties and projects.
- A complete audit trail of what was forwarded under which consent state.
- No destination credentials outside core.
- Destination API changes absorbed by mapping rather than by projects.
- A new property becomes measurable by registering a container.

Cost:

- Core operates outbound integrations with external platforms and their failure modes.
- Forwarding is core's availability problem; an outage means lost or delayed conversions.
- Destination API changes must be tracked and mappings maintained.
- Marketing configuration becomes a governed change rather than a self-service one.
- Server-side forwarding loses browser-only signals unless a project sends them explicitly.

## 10. Impact On NEWAX Core

Measurement is a business-domain layer depending on Growth for consent and on the Central Registry
for identity. Nothing in the foundation layer depends on it.

Core takes on outbound integration with third-party platforms, which is an operational
responsibility with an external dependency and an external change cadence.

## 11. Impact On Client Systems

A client gains one place where measurement is configured and one record of what was reported, with
the consent state that permitted it.

Client marketing teams lose direct self-service tag configuration for anything carrying NEWAX data.
That is a deliberate trade: the same property is what makes consent enforceable.

## 12. Security Considerations

Destination credentials are the highest-value secret in this domain. They are held as references,
resolved at runtime, never committed, never logged, and never returned by an API. Compromise of a
destination credential is compromise of an advertising account.

Forwarded payloads contain person-level data leaving NEWAX control. Every field forwarded to an
external platform requires review before it is added to a mapping, because a mapping change is a
disclosure change.

Consent checks fail closed. Indeterminate consent means no forward.

Forwarding records are compliance evidence and must be auditable and tamper-evident.

Regional rules gate destinations independently of purpose consent, because a destination permitted
in one jurisdiction may be prohibited in another for the same person.

## 13. Scalability Considerations

Forwarding volume grows with conversion volume and destination count multiplied together, since
one canonical event may fan out to several destinations.

External destinations impose rate limits and fail intermittently. Forwarding must be queued,
retried with bounded backoff, and dead-lettered, using the same delivery discipline as ADR 0040
rather than a separate mechanism.

Forwarding failures must not block the emitting project. A project's write path never waits on an
external platform.

Forwarding records grow with volume and require a retention position that preserves enough history
for compliance evidence.

## 14. Maintenance Considerations

External platform APIs change on their own schedule. Mappings need an owner and a way to detect
that a destination's expectations have changed, ideally before conversions are silently rejected.

Silent rejection is the characteristic failure here: a destination accepts a call and discards the
event. Monitoring must compare forwarded volume against destination-reported volume rather than
trusting a successful response.

Containers and destinations accumulate as properties come and go. Each needs an owner and a
retirement condition.

## 15. Related Documents

- [Growth and Measurement Architecture](../architecture/growth-and-measurement-architecture.md)
- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Environment Standard](../standards/environment-standard.md)
- [Security Baseline Standard](../standards/security-baseline-standard.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](0041-define-project-integration-classes-and-conformance-levels.md)
- [ADR 0045: Establish Growth Domain](0045-establish-growth-domain.md)
- [ADR 0047: Establish Analytics Rollup Store](0047-establish-analytics-rollup-store.md)

## 16. Approved By

NEWAX Engineering, Architecture, and Security.
