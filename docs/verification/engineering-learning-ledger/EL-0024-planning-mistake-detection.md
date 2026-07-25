# EL-0024: Planning History Was Not Automatically Analyzed

- Date: 2026-07-17
- Pull request or task: PR #227
- Category: Planning and decision quality
- Symptom: Forgotten migrations, forgotten dependencies, wrong implementation order, ignored requirements, skipped architecture review, wrong estimates, and scope creep could only be noticed manually after waste had already occurred.
- Root cause: Engineering planning evidence existed across commits, issues, and task discussions, but no trusted control normalized and correlated that history into evidence-backed findings.
- Unsuccessful method: Rely on memory, commit-message keywords, or retrospective self-reporting to decide whether the plan was followed.
- Successful method: Create a structured planning issue before implementation, declare requirements, scope, dependencies, estimates, and review needs, record sequence events as they occur, and reconstruct the evidence during pull-request governance.
- Prevention control: Planning governance evaluates commit order, changed files, linked planning issues, and task events; it blocks unwaived high-confidence detected mistakes while preserving suspected and insufficient-evidence states separately.
- Verification evidence: Twenty-three focused local-equivalent tests passed for the detector, GitHub history adapter, CLI, and governance boundaries before final exact-head verification. Exact-head repository verification remains required.
- Planning evidence: Issue #226.
- Occurrence evidence: Engineering-learning issue #228.
- Recurrence status: Prevention control proposed in PR #227; the issue remains open and its explanation remains challenged until exact workflow provenance is available.
