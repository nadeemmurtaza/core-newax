# ADR 0042: Adopt Contract-First SDK Generation

## Purpose

Define how project domains obtain client code for the Core API and the Core event stream, so that
supporting a growing number of projects in several languages does not require a hand-written
client per project.

## 1. Decision Title

ADR 0042: Adopt Contract-First SDK Generation

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0039 makes the Core API and the Core event stream the only ways a project obtains Central
Registry data. Every project therefore needs client code for both.

NEWAX project domains are not written in one language. Existing projects use Python with
SQLAlchemy, TypeScript with Prisma, and Kotlin with Swift for mobile clients. ADR 0011 defines
TypeScript as the NEWAX implementation baseline for core itself, which does not make the
consumers TypeScript.

ADR 0041 fixes the integration surface per class, which makes client code largely uniform within
a class. `docs/standards/api-design-standard.md` already governs API shape, and one project
repository already keeps a dedicated contracts package, so the pattern is familiar.

## 5. Problem

A TypeScript-only client library cannot serve the majority of existing NEWAX projects. Writing one
client per language by hand produces a different problem: several implementations of the same
contract that drift, because nothing forces them to agree.

Drift here is expensive in a specific way. If the Python client and the TypeScript client disagree
about the event envelope, the disagreement appears as data corruption in a mirror, not as a
compile error.

There is also no artefact today that states the contract. The API shape lives in controller code,
and the event envelope lives in one project's producer. A project integrating today reads source
code in another repository to learn what to send.

## 6. Decision

**The contract is the source of truth, and it is language-neutral.**

Core publishes a versioned contract definition covering the synchronous API and the asynchronous
event stream, including the envelope, its signature scheme, and the payload schema of every
published event. The contract is an artefact in its own right, not a description of code.

**Client libraries are generated from the contract, not written by hand.**

Core generates and publishes a client library per supported language. Supported languages are
those the project registry actually requires, currently TypeScript, Python, and the mobile client
languages. A language is added by adding a generator, not by writing a client per project.

**A generated client is not modified downstream.**

A project consumes the published client. It does not fork, patch, or hand-edit it. A missing
capability is added to the contract, which regenerates every client, rather than patched into one.

**Contract changes follow the compatibility rules in the contract standard.**

Additive changes are backward compatible and do not require consumer action. Breaking changes
require a version increment and a deprecation window during which both versions are served. Those
rules live in `docs/standards/core-data-contract-standard.md`.

**The contract is verified against the running implementation.**

A contract that drifts from the service it describes is worse than no contract, because consumers
trust it. Core verifies the implementation against the contract in continuous integration.

## 7. Reasoning

Generation is chosen over hand-writing because the failure mode of hand-written clients is silent
divergence, and silent divergence in an event envelope surfaces as corrupted mirror data rather
than as an error at the point of the mistake.

The contract being language-neutral follows directly from the projects being polyglot. Anything
else forces some projects to reverse-engineer the contract from another language's client, which
is how the current situation arose.

Prohibiting downstream modification is what preserves the single source of truth. A patched client
is a fork that looks like a dependency, and it fails at the next regeneration.

Verifying the contract against the implementation is the part most often skipped and most
important. Without it the contract becomes documentation, and documentation drifts.

Making the contract an artefact also makes the API reviewable as a contract. A change that breaks
consumers becomes visible in a diff rather than discovered by a consumer.

## 8. Alternatives Considered

**A hand-written TypeScript client only.** Cheapest immediately, and consistent with the ADR 0011
baseline. Rejected because it serves a minority of existing projects and forces every other
project to write its own client against no specification.

**Hand-written clients per language.** Gives idiomatic clients. Rejected because several
implementations of one contract drift, and drift in the envelope corrupts data rather than failing
loudly.

**No client libraries; each project calls the API directly.** Rejected because every project then
reimplements authentication, retry, signing, envelope handling, and consumer semantics, which is
both wasteful and the most error-prone part of the integration.

**Code-first generation, deriving the contract from core implementation.** Common and convenient.
Rejected because it inverts the relationship: the contract becomes whatever core currently does,
so an accidental change to core silently becomes a contract change, and there is nothing to verify
the implementation against.

## 9. Consequences

Positive:

- Every supported language gets a client that cannot disagree with the contract.
- Adding a language costs one generator, not one client per project.
- The contract is reviewable, and breaking changes are visible in a diff.
- Authentication, retry, signing, and consumer semantics are implemented once.
- A new project integrates against a specification rather than against another project's source.

Cost:

- A generation and publishing pipeline must be built and operated.
- Generated clients are less idiomatic than hand-written ones.
- Contract changes require deliberate compatibility handling.
- Contract verification adds a continuous integration obligation to core.
- Existing project code written against the current informal contract must converge.

## 10. Impact On NEWAX Core

Core owns the contract, the generators, the published clients, and the verification that the
implementation matches.

The Core API becomes an external contract rather than an internal interface. It remains subject to
`docs/standards/api-design-standard.md`, with the added obligation that changes are compatible or
versioned.

## 11. Impact On Client Systems

Client deployments gain a version relationship between each project and the contract version it
was generated against. Upgrades become tractable because compatibility rules are explicit rather
than discovered.

## 12. Security Considerations

Centralising authentication, signature construction, and signature verification in generated
clients removes the most security-sensitive code from per-project reimplementation, where it is
most likely to be got wrong.

Generated clients are a supply-chain surface. They must be published from a verified pipeline, and
projects must consume pinned versions rather than floating ones.

The contract must not contain credentials, endpoints for specific environments, or secrets. It
describes shape and semantics only; connection details are resolved as ADR 0038 defines.

## 13. Scalability Considerations

This is what keeps client cost flat as projects grow. Client effort scales with language count,
which is small and grows slowly, rather than with project count, which is not.

Generation happens at build time and adds nothing at runtime.

## 14. Maintenance Considerations

The generation pipeline is infrastructure and needs an owner. An unmaintained generator becomes a
blocker for every project at once, which is the concentrated risk this decision accepts in
exchange for removing the distributed risk of divergent clients.

Contract verification must run continuously. Its absence is not visible until a consumer breaks.

Deprecation windows must be long enough for every project to upgrade, which means the window is
set by the slowest project, not by core's convenience.

## 15. Related Documents

- [Core Integration Platform](../architecture/core-integration-platform.md)
- [Core Distribution Architecture](../architecture/core-distribution-architecture.md)
- [Core Data Contract Standard](../standards/core-data-contract-standard.md)
- [API Design Standard](../standards/api-design-standard.md)
- [Package Standard](../standards/package-standard.md)
- [ADR 0006: Use Controlled Updates and Versioning](0006-use-controlled-updates-and-versioning.md)
- [ADR 0011: Define Technology Stack and Implementation Baseline](0011-define-technology-stack-and-implementation-baseline.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0041: Define Project Integration Classes and Conformance Levels](0041-define-project-integration-classes-and-conformance-levels.md)

## 16. Approved By

NEWAX Engineering and Architecture.
