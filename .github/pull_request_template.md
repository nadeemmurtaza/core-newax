# Pull Request Record

## Scope

Describe the one coherent change in this pull request.

## Intended outcome

State the business or engineering outcome this change must produce.

## Requirement references

- Requirement or issue:
- Applicable ADRs:
- Applicable standards:
- Applicable learning-ledger entries:

## Planning evidence

- Planning issues: `#123`, comma-separated issues, or `not-required` only for an explicitly exempt maintenance change
- Declared scope source: Identify the planning issue containing the repository path boundaries.
- Task sequence source: Identify the planning issue containing ordered tasks and dependencies.
- Architecture review evidence: Identify the approval event or write `not-required` when every task explicitly says review is not required.
- Estimate source: Identify the task estimates and any approved revisions.
- Scope-change approvals: Identify approval events or write `none`.

Review-ready pull requests require at least one planning issue, a declared task sequence, and declared scope paths. Planning mistake governance evaluates the issue history and commit sequence; these fields do not override that evidence.

## Communication evidence

- Communication issues: `#123`, comma-separated issues, or `not-required` only for an explicitly exempt maintenance change
- Requirement confirmations: Identify the structured requirement and interpretation records.
- Assumptions awaiting confirmation: Identify open assumptions or write `none`.
- Decision records: Identify canonical decisions required by this change.
- Approval evidence: Identify approval records or write `not-required`.
- Conflicts and resolutions: Identify supersession or resolution records or write `none`.

Review-ready pull requests require at least one linked communication issue and structured communication evidence. Pull-request prose does not override the issue, comment, review, and commit history evaluated by communication governance.

## AI and tool quality evidence

- AI or engineering-tool assistance used: `yes` or `no`
- AI quality issues: `#123`, comma-separated issues, or `not-required` when no structured AI or tool output record exists
- Attributed output records: Identify output IDs, model or tool metadata, hashes, occurrence times, and artifact references, or write `none`.
- Validation evidence: Identify version, compiler, runtime, review, package, documentation, copy-provenance, or static-analysis records, or write `none`.
- Corrections and regressions: Identify correction commits and exact regression evidence, or write `none`.
- Dataset privacy review: Confirm the record contains bounded metadata, hashes, and durable references only.

Assistance alone is not a mistake. Review-ready pull requests with structured output evidence require a linked AI quality issue. Trusted governance blocks only attributable, unresolved, unwaived, high-confidence findings supported by verified evidence.

## Prevention evidence

- Prevention records: `#123`, comma-separated resolved learning issues, or `not-required` when no resolved learning occurrence is linked
- Resolved root causes: Identify the root-cause IDs or write `none`.
- Generated control packs: Identify pack IDs and revisions or write `none`.
- Control paths: Identify the seven deterministic paths per root cause or write `none`.
- Candidate executable controls: Identify CI or static-analysis controls awaiting ownership, implementation, review, or verification, or write `none`.
- Supersession approvals: Identify structured approvals or write `none`.

Resolved mistakes require a complete current seven-control pack. Closed but unverified issues do not qualify. Prevention governance compares generated expected content with the exact pull-request head; pull-request prose does not override the evidence.

## Confidence evidence

- Confidence records: `#123`, comma-separated structured confidence issues, or `not-required` only when no finding issue is linked
- Scoring policy: `CONFIDENCE-1.0.0`
- Finding coverage: Identify which linked finding issue each confidence input record represents.
- Recalculation evidence: Identify the generated score records or analysis output.
- Missing subsystem evidence: Identify metrics that remain `insufficient-evidence`, or write `none`.
- Manual final scores supplied: `no`

Confidence percentages and evidence-quality labels are generated from recalculable inputs. They measure evidence support under the named policy and are not statistical probabilities. Authors must not type final scores into this pull request. A high metric cannot substitute for missing evidence in another metric.

## Acceptance criteria

- [ ] The intended behavior is testable.
- [ ] What must not happen is explicit.
- [ ] Existing behavior that must remain unchanged is identified.
- [ ] Affected security, tenancy, permissions, data, and workflow boundaries are identified.

## What changed

Describe the implemented change.

## What did not change

Identify adjacent scope that remains deliberately unchanged or deferred.

## Dependency and generated-artifact review

- Dependency change: `yes` or `no`
- Lockfile regenerated by pnpm: `yes`, `no`, or `not-required`
- Peer compatibility checked: `yes`, `no`, or `not-required`
- Install or build scripts reviewed: `yes`, `no`, or `not-required`
- Generated artifacts refreshed: `yes`, `no`, or `not-required`
- Temporary generators or diagnostics removed: `yes` or `not-required`

## Verification

Record the latest source state only. Replace `pending` after the final source change.

- Head commit: `pending`
- Frozen-lockfile install: `pending`
- Database validation and migrations: `pending` or `not-required`
- Formatting write: `pending`
- Formatting check: `pending`
- ESLint: `pending`
- Type-check: `pending`
- Focused tests: `pending`
- Complete tests: `pending`
- Production build: `pending`
- Complete diff review: `pending`
- Actual workflow validation: `pending` or `not-required`
- Exact-head CI: `pending`
- Unresolved issues: `pending`

## Engineering learning record

Complete this section for every pull request.

Do not add a `Learning outcome` field. Trusted governance computes the outcome from the pull-request diff and reconciled evidence. The outcome is automatically `required` when any of these conditions is true:

- A new rule, policy, or engineering standard is created.
- A checklist is created or updated.
- An engineering process or governance control changes.
- A pull-request, issue, or operational template changes.
- Engineering automation is added.
- A failed workflow, linked learning issue, local event, or external-tool event exists.

The author cannot choose `none`.

- Ledger entries: `EL-XXXX`, comma-separated entries, or `not-required`
- Learning issues: `#123`, comma-separated issues, or `not-required`
- Root-cause status: `confirmed`, `machine-supported`, or `not-required`
- Root-cause evidence: Identify the failed run, issue, log, reproduction, reviewer confirmation, or rule-engine trigger.
- Resolution evidence: Identify the fix commit and successful focused and complete verification.
- Successful method used: Describe the evidence-backed method used.
- Unsuccessful method avoided: Name the known failed method that was not repeated.
- New prevention control: Describe the new control or write `not-required` only when the rule engine returns `not-required`.
- Ledger consulted before implementation: `yes`
- Failure history reconciled: `yes`
- External and tool events reconciled: `yes`

When learning is required, governance determines whether each ledger entry is:

- `new` because the entry is introduced in this pull request; or
- `existing` because it is already present in the trusted learning catalog.

A required outcome must include at least one ledger entry and one occurrence-specific learning issue. A not-required outcome must use `not-required` for ledger entries, learning issues, and root-cause status.

New learning must update either:

- `docs/verification/engineering-learning-ledger.md`
- `docs/verification/engineering-learning-ledger/EL-XXXX-description.md`

When the same root cause already exists, link the existing ledger entry and still link the occurrence-specific engineering-learning issue.

## Code necessity and simplicity audit

- [ ] Requirement traced.
- [ ] Existing NEWAX implementation checked.
- [ ] Framework-native alternative checked.
- [ ] Duplicate logic avoided.
- [ ] Unused code removed.
- [ ] Unused dependency removed.
- [ ] Unnecessary abstraction avoided.
- [ ] Unreachable code removed.
- [ ] Speculative functionality excluded.
- [ ] Simpler safe implementation considered.

## Repository freeze and evidence

- Repository-content freeze: `not-started`, `active`, or `complete`
- Final verification evidence location: Pull-request metadata, review, comment, or release record.
- Source file contains the workflow run that verifies itself: `no`
- Repository file action used for pull-request metadata: `no`

After the repository-content freeze becomes `active`, do not change source files merely to record CI run IDs, commit hashes, or completion language.

## Risk assessment

- Security risk:
- Data or migration risk:
- Compatibility risk:
- Operational risk:
- Rollback or recovery:

## Known issues

State `None` only after verification.

## Deferred issues

List explicitly approved deferred work. Deferred work must not be required for this pull request's acceptance criteria.

## Merge policy

State whether the pull request may merge immediately, must remain stacked, or requires explicit NEWAX authorization.
