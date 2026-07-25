# EL-0023: Manual Learning Outcome Allowed False None

- Date: 2026-07-17
- Pull request or task: PR #224
- Category: Documentation, evidence, and governance
- Symptom: A pull request could create a new prevention control, process, template, standard, or automation while declaring `Learning outcome: none`.
- Root cause: Pull-request governance trusted an author-selected free-text outcome and only contradicted `none` when limited failure evidence or linked learning issues were already visible.
- Unsuccessful method: Ask the pull-request author to choose `new`, `existing`, or `none` and treat the selection as the primary decision.
- Successful method: Calculate `required` or `not-required` from the current diff and reconciled evidence, then infer whether referenced ledger entries are new or existing.
- Prevention control: Trusted governance forces learning required when a rule is created, a checklist is updated, a process changes, a template changes, automation is added, or failure and event evidence exists. The author-selected outcome field is prohibited.
- Verification evidence: Ten focused rule-engine tests pass all five mandatory triggers, failure evidence, the no-trigger case, reason deduplication, automatic ledger classification, and false not-required rejection.
- Occurrence evidence: Engineering-learning issue #225.
- Recurrence status: Prevention control proposed in PR #224; exact-head repository verification remains required.
