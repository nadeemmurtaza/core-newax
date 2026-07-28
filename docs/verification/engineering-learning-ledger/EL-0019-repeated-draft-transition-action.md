# EL-0019: Draft Transition Action Repeated After State Was Already Correct

- Date: 2026-07-16
- Pull request or task: PR 49 expansion
- Category: GitHub or tool-operation error
- Symptom: The pull request was successfully converted to draft, but the same draft-conversion action was invoked repeatedly and returned tool errors because the requested state already existed.
- Root cause: The confirmed result of the first successful state transition was not treated as the new source of truth before selecting the next action.
- Unsuccessful method: Repeat the same state-changing action without first reading the returned state and validating whether another mutation is required.
- Successful method: Stop after the first successful transition, use the returned pull-request state as authoritative, and select the next action only when it changes a different target.
- Prevention control: Every state-changing tool call must have an explicit precondition and postcondition. A successful postcondition prohibits repeating the same mutation unless new evidence shows the state changed again.
- Verification evidence: PR 49 returned `draft: true` after the first successful conversion. Later repeated conversions failed without changing repository content.
- Recurrence status: New recurrence of target-action and stop-condition failures related to EL-0015; covered by external-tool intake and pull-request governance expansion.
