# EL-0037 — Accepted Architecture Direction Without an Implementable Contract

## Category

`architecture-contract-gap`

## Root-cause ID

`ROOT-ARCHITECTURE-DIRECTION-WITHOUT-CONTRACT`

## Root cause

NEWAX accepted an architectural direction and published its interface without building the
mechanism the direction requires, and without defining the boundary that governs its use.

Two decisions did this together:

- ADR 0005 accepted event-driven module communication, and `registry/module-registry.json`
  declares `exposed_events` and `consumed_events` for every registered module. No outbox,
  delivery mechanism, publisher, or consumer exists anywhere in `packages/` or `apps/api/src/`.
  The declared events describe intent, not behaviour.
- ADR 0007 defined a centralized database for one project and stated that the model "must not
  become the default architecture for every future NEWAX project." No later ADR defined what the
  default is.

A declared interface with no implementation, and a stated non-default with no stated default,
both read as guidance to a project team that needs the capability now. Each project domain
therefore built its own version of the missing piece, in isolation, and the versions diverged.

The failure is not that any project chose wrongly. Each choice was locally reasonable. The
failure is that the platform published a shape without publishing a contract, so there was
nothing to converge on.

## Evidence

Observed in source at the time this entry was created:

- No outbox, event bus, publisher, or consumer exists in `packages/` or `apps/api/src/`, while
  every module in `registry/module-registry.json` declares `exposed_events`.
- Two project domains independently implemented outbound delivery, with divergent envelopes,
  field naming, and terminal-failure semantics. One has no terminal dead-letter state and no
  envelope, so its submissions carry no stable identifier across retries and cannot be
  deduplicated by a receiver.
- One project domain ships a signed, versioned envelope whose source documents that it is
  addressed to a core receiver that was never built, and whose outbox deliberately reuses one
  identifier across retries so that idempotent replay on that future receiver would work.
- Three project domains hold their own person, contact, lead, consent, or compliance concepts,
  defined differently in each.

## Unsuccessful method

Accept an architectural direction, declare its interface in a registry, and defer the mechanism
and the boundary indefinitely, expecting project domains to wait rather than to improvise.

## Successful method

Pair an accepted direction with three things before project domains need it:

- The mechanism, or an explicit decision recording that it is not yet built and what depends on
  it.
- The boundary, stated as what the default is rather than only what it is not.
- A contract that a project can build against, published as an artefact rather than existing
  only inside one implementation.

Where a project has already implemented the missing piece, adopt its working shape and version
it deliberately rather than designing a competing one. The shipped envelope in this repository's
ecosystem became the basis of the contract standard rather than being obsoleted by it.

## Prevention control

`registry/project-registry.json` with the integration class and conformance level model
established by ADR 0041, gated by `docs/standards/project-onboarding-checklist.md`.

A project's integration surface is now declared and reviewable before implementation rather than
improvised during it, and a project that fits no declared class is surfaced as a platform gap to
be fixed in the platform rather than worked around locally. `docs/architecture/core-convergence-map.md`
records the disposition of every concept that already diverged, so existing duplicates converge
on a stated order rather than persisting indefinitely.

## Required evidence

- confirmation that a newly accepted architectural direction either ships its mechanism or names
  the decision that defers it;
- confirmation that any declared interface in `registry/module-registry.json` corresponds to
  implemented behaviour, or is recorded as `planned` rather than presented as available;
- confirmation that a stated non-default is accompanied by a stated default.

## Regression boundary

A future ADR that accepts a direction, declares an interface for it, and leaves both the
mechanism and the boundary undefined is a recurrence of this root cause, not a new finding.

Divergence discovered later in a project domain that was onboarded through the project registry
and the onboarding checklist is a different root cause, because the contract existed and was not
followed. That case belongs to a new entry.
