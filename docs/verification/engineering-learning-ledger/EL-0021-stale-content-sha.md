# EL-0021: Sequential File Update Used a Stale Content SHA

- Date: 2026-07-16
- Pull request or task: PR 49 expansion
- Category: GitHub or tool-operation error
- Symptom: GitHub rejected an update of `tooling/verify-pr-governance.mjs` with HTTP `409` because the supplied blob SHA did not match the current file version on the branch.
- Root cause: A blob SHA captured before an earlier change to the same file was reused as though it still represented the current branch state.
- Unsuccessful method: Reuse cached file-version evidence for a later sequential update.
- Successful method: Fetch the target file immediately before the update and use the current blob SHA returned for that exact branch state.
- Prevention control: Every sequential update or delete must refresh the target file SHA after any prior mutation to the same path. A `409` stops the write sequence until current state is re-read.
- Verification evidence: GitHub returned current blob SHA `cc3d3a89b186b78213e3cb4f77da47028756005c`, which was then used for the successful retry.
- Recurrence status: Newly recorded; controlled through current-state refresh and stop-on-conflict rules.
