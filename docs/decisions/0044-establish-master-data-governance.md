# ADR 0044: Establish Master Data Governance

## Purpose

Define how the Central Registry decides that two records describe the same real-world person or
organization, how it merges them, and how that decision reaches every project holding a reference.

## 1. Decision Title

ADR 0044: Establish Master Data Governance

## 2. Status

Accepted

## 3. Date

2026-08-23

## 4. Context

ADR 0039 makes core the authoritative source for people, organizations, contact methods, and
addresses. ADR 0040 lets projects submit candidate records to a core inbox.

The moment more than one project contributes, core receives records that may or may not describe
someone it already knows. A lead project discovers an institution that a commerce project already
transacts with. Two projects hold the same person under different email addresses.

The Central Registry currently has no rules for deciding this. ADR 0025 introduced staged
verification of people intake before canonical application, which is the correct shape for a
single intake path, but it does not define matching, merging, or how a merge propagates to
mirrors.

## 5. Problem

Without matching rules, core accumulates duplicate canonical records, and the duplicates are worse
than useless: they split a person's history across records, so attribution, consent, and
suppression each see only part of the picture. A person suppressed under one record continues to
be contacted under the other.

Without merge rules, resolving a duplicate is destructive. Deleting the losing record breaks every
project reference pointing at it, and there is no way for those projects to learn what happened.

Without survivorship rules, merging is arbitrary. When two records disagree about a name or an
address, something must decide which value survives, and an undefined rule means the answer
depends on merge order.

Without merge propagation, a merge that core performs silently corrupts every mirror, because
ADR 0037 removed the database's ability to cascade.

## 6. Decision

**Contributions are candidates, adjudicated before they become canonical.**

A record submitted through the inbox enters a staging state. Core applies matching rules to decide
whether it creates a new canonical record, matches an existing one, or requires human review. This
extends the staged-intake principle of ADR 0025 to every contributing project.

**Matching is explicit, tiered, and tenant-bounded.**

Matching rules are declared per entity rather than embedded in code. They are tiered:

- A deterministic match on a strong identifier is applied automatically.
- A probabilistic match on weaker signals is proposed, not applied, and requires review above a
  declared confidence threshold and below certainty.
- Below the review threshold, a new canonical record is created.

Matching never crosses a tenant boundary. Two people in different tenants are never the same
person for merge purposes, regardless of shared attributes, per ADR 0027.

**Merge preserves both identifiers.**

A merge nominates a surviving record and marks the other superseded. The superseded identifier is
retained and continues to resolve to the survivor. It is never deleted and never reused.

**Survivorship rules are declared per field.**

When merged records disagree, the surviving value is chosen by a declared rule: most recently
verified, highest-trust source, or explicit human selection. The rule is recorded per field so a
merge outcome is reproducible rather than dependent on order.

**Merge is a published event and is reversible.**

A merge publishes both identifiers so that every project holding the superseded reference can
update it. Applying merge events is a mandatory consumer behaviour under ADR 0039.

A merge can be reversed. Because both records are preserved and the merge is recorded rather than
applied destructively, an incorrect merge is corrected rather than reconstructed.

**Provenance is recorded.**

Every canonical field records which source contributed it and when. Without provenance,
survivorship rules cannot be evaluated and a wrong value cannot be traced to its origin.

## 7. Reasoning

Adjudicating candidates rather than accepting writes is what preserves the authority rule from
ADR 0037. If a project's submission became canonical directly, the Central Registry would be
whichever project wrote last.

Tiered matching reflects the real distribution of cases. Most matches are unambiguous, a minority
are genuinely uncertain, and automating the uncertain ones produces wrong merges that are expensive
to detect. Requiring review for the uncertain band trades throughput for correctness in the band
where correctness is at risk.

Preserving the superseded identifier is what makes merges safe across a distributed system.
Projects hold references core cannot see or update. If the identifier stops resolving, those
references break silently; if it resolves to the survivor, they degrade gracefully while the merge
event propagates.

Declaring survivorship per field makes merges reproducible. An undefined rule means merging A into
B produces a different result from merging B into A, which is not a property a system of record can
have.

Reversibility follows from a practical observation: matching will sometimes be wrong, and a design
that assumes otherwise makes its worst failure unrecoverable.

## 8. Alternatives Considered

**Accept contributions directly as canonical records.** Simplest. Rejected because it makes the
last writer authoritative and removes the distinction between core and project data entirely.

**Fully automatic matching with no review path.** Higher throughput and no operational burden.
Rejected because wrong merges are hard to detect and expensive to unwind, and confidence in the
uncertain band is genuinely not high enough.

**Delete the superseded record on merge.** Simplest merge. Rejected because it breaks every project
reference silently, which is precisely the failure ADR 0037 exists to prevent.

**Defer master data governance until duplicates become a problem.** Rejected because duplicates
accumulate silently, and the cost of resolving them grows with the number of project references
pointing at them. The rules must exist before the second contributor, not after.

**Leave matching to each project.** Rejected because a project cannot see other projects' records,
so it cannot detect a duplicate that spans them, which is the case that matters.

## 9. Consequences

Positive:

- Multiple projects can contribute without producing duplicate canonical records.
- Merges propagate correctly instead of silently corrupting mirrors.
- Merge outcomes are reproducible and reversible.
- A person's consent, suppression, and history resolve to one record.
- Field-level provenance makes wrong values traceable.

Cost:

- A review path is required, which is operational work rather than only engineering work.
- Staging adds latency between contribution and canonical availability.
- Retaining superseded records and provenance increases storage and query complexity.
- Every consumer must implement merge handling.
- Matching rules require tuning against real data and will be wrong initially.

## 10. Impact On NEWAX Core

Master data governance extends the existing People, Organizations, Contacts, and Addresses modules
rather than forming a separate module. It is the adjudication layer in front of them.

The Central Registry gains a review surface, which is a product responsibility as well as an
engineering one. A review queue nobody works is a growing backlog of unresolved duplicates.

## 11. Impact On Client Systems

A contributed record may not be immediately canonical. Client-facing behaviour must present
staging honestly rather than as failure.

Data quality improves in a client-visible way: one customer resolves to one record across every
NEWAX system.

## 12. Security Considerations

Merging combines two records' data, so it must respect the access boundaries of both. A merge must
never be a path to see data the actor could not otherwise access.

Matching operates on identifying attributes and must not leak the existence of records the actor
cannot see. A match response that reveals an existing record to an unauthorized contributor is a
disclosure.

Merge, unmerge, and survivorship overrides are high-impact operations and must be permission-gated
and audited through `core_audit_logs`, per ADR 0033.

Tenant-bounded matching is a security control, not only a correctness one. Cross-tenant matching
would merge two customers' records.

## 13. Scalability Considerations

Matching cost grows with canonical record count and must use indexed blocking keys rather than
comparing against the full set.

Merge propagation cost grows with subscriber count and is bounded by the delivery mechanism in
ADR 0040.

The review queue is the bottleneck that scales worst, because it is human. Match thresholds must be
tuned to keep review volume tractable, and the tuning is ongoing rather than one-time.

## 14. Maintenance Considerations

Matching rules require ongoing tuning against real data, and their quality must be measured. Merge
rates, review queue depth, and unmerge rates are the signals that indicate whether thresholds are
set correctly.

Provenance and superseded records grow without bound and need a retention position, which must
preserve enough history for references to resolve.

## 15. Related Documents

- [Core Convergence Map](../architecture/core-convergence-map.md)
- [Central Registry Architecture](../architecture/central-registry-architecture.md)
- [ADR 0025: Stage and Verify People Intake Before Canonical Application](0025-stage-and-verify-people-intake-before-canonical-application.md)
- [ADR 0027: Separate Tenant Ownership from Organizations](0027-separate-tenant-ownership-from-organizations.md)
- [ADR 0033: Build Audit Governance Foundation](0033-build-audit-governance-foundation.md)
- [ADR 0037: Define Cross-Database Reference Rules](0037-define-cross-database-reference-rules.md)
- [ADR 0039: Distribute Core Data by API and Replicated Read Models](0039-distribute-core-data-by-api-and-replicated-read-models.md)
- [ADR 0040: Build Transactional Outbox and Core Inbox](0040-build-transactional-outbox-and-core-inbox.md)

## 16. Approved By

NEWAX Engineering and Architecture.
