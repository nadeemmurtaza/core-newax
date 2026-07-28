---
name: Engineering Learning Intake
description: Record engineering learning from failures with confirmed root
  causes, prevention controls, and verification evidence
labels: ['engineering-learning']
---

<!-- newax-engineering-event
fingerprint: [REQUIRED: unique fingerprint from failure event]
source-type: [engineering-governance|ci-workflow|manual-review]
source-id: [REQUIRED: trace back to originating event]
occurred-at: [ISO 8601 timestamp]
pr-number: [PR number if applicable]
commit-sha: [commit SHA if applicable]
failure-category: [category of failure]
root-cause-id: [REQUIRED: ROOT-* identifier from catalog]
root-cause-confidence: [high|medium|low]
root-cause-status: [confirmed|machine-supported|candidate]
duplicate-of: [issue number if duplicate, or 'none']
-->

# Engineering Learning Intake

## Evidence

- **Pull request:** [PR link or number]
- **Commit:** [commit SHA]
- **Failed workflow run:** [if applicable, link to workflow run]
- **Dashboard record:** [if applicable]
- **Policy version:** [policy version if applicable]

## Root-cause assessment

- **Root-cause status:** `confirmed` or `machine-supported`
- **Confirmed root cause:** [Specific, clear description of what went wrong]
- **Unsuccessful method:** [What was attempted that didn't work]
- **Successful method:** [What actually resolved or prevents the issue]
- **Prevention control:** [How to prevent recurrence]
- **Ledger entry:** [EL-#### reference]

## Required confirmation

- [ ] Complete logs and affected scope reviewed
- [ ] Root cause confirmed (not speculative)
- [ ] Unsuccessful method recorded accurately
- [ ] Successful method documented or verified
- [ ] Prevention control documented
- [ ] Coverage gaps remain explicit
- [ ] Existing ledger entry linked

## Resolution record

- **Root-cause status:** `confirmed` or `machine-supported`
- **Confirmed root cause:** [Final confirmed statement]
- **Resolution status:** `verified` or `unverified`
- **Fix commit:** [Full commit SHA, or `not-applicable: reason`]
- **Successful verification:** [Evidence that fix works: tests, CI passes, etc.]
- **Reviewer confirmation:** [Who confirmed and when]
