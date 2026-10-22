# EL-0025: Communication History Was Not Correlated Before Dependent Work

- Date: 2026-07-17
- Pull request or task: PR #231
- Category: Communication and decision quality
- Symptom: Requirement misunderstandings, unconfirmed assumptions, ambiguous specifications, undocumented decisions, wrong interpretations, conflicting instructions, and missing approvals could become implementation work before a trusted control identified them.
- Root cause: Communication evidence existed across issues, comments, reviews, and decisions, but no system normalized authority, applicability, timing, supersession, approval, and dependent-work evidence into enforceable findings.
- Unsuccessful method: Rely on memory, free-text summaries, recency, or retrospective explanations to decide what was understood and approved.
- Successful method: Record structured communication events before work, preserve stable topics and references, collect GitHub history, and evaluate evidence-bounded rules against dependent implementation.
- Prevention control: Pull-request governance blocks unwaived high-confidence communication findings and preserves suspected, resolved, waived, clear, and insufficient-evidence states separately.
- Verification evidence: Twenty-seven focused local-equivalent tests passed for detection, parsing, collection, CLI behavior, and governance before final exact-head verification. Exact-head repository verification remains required.
- Planning and communication evidence: Issue #230.
- Occurrence evidence: Engineering-learning issue #232.
- Recurrence status: Prevention control proposed in PR #231; issue #232 remains open and challenged until exact workflow provenance is available.
