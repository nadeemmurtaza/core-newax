# EL-0020: Wrong Metadata Action Repeated After the Control Was Defined

- Date: 2026-07-16
- Pull request or task: PR 49 expansion
- Category: GitHub or tool-operation error
- Symptom: While intending to update PR 49 metadata, two no-op issue-update actions were invoked against issues #50 and #51 before the correct pull-request update action was selected.
- Root cause: The target-action classification existed in documentation but was not made an executable precondition in the immediate operation sequence.
- Unsuccessful method: Rely on a stated intention to use the correct action without checking the actual selected recipient before execution.
- Successful method: Reload the explicit `update_pull_request` action schema, state the target as pull-request metadata, invoke only that action, and verify that PR 49 body changed while repository content and issue content remained unchanged.
- Prevention control: Before any mutation, require a machine-readable operation declaration containing target type, target identifier, action name, expected postcondition, and prohibited side effects. The declared action must match the invoked tool recipient.
- Verification evidence: Issues #50 and #51 remained substantively unchanged; the subsequent `GitHub.update_pull_request` call updated PR 49 successfully without moving the branch head.
- Recurrence status: Severe recurrence of EL-0015 and evidence that prose-only target classification is insufficient. An executable operation-intent guard is required.
