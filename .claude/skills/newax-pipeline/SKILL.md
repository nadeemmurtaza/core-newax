---
name: newax-pipeline
description: Run the NEWAX multi-agent delivery pipeline for a non-trivial change — explore, architect, get approval, code, test, security + review, final QA, report. Use when the user asks to "run the pipeline", "use the full pipeline", or wants a change delivered with the architecture→coding→testing→security→review→QA sequence.
---

# NEWAX delivery pipeline

Orchestrate the change through these stages. You (the main agent) are the
conductor: you spawn each stage as a subagent, carry its output to the next, and
own the approval gate and the final hand-off.

```
      user request
           │
           ▼
   ┌───────────────┐
   │  MAIN AGENT   │  (you)
   └──┬─────────┬──┘
      │ parallel│
      ▼         ▼
 explorer   architect        stage 1 — recon + design
  (haiku)    (opus)
      └────┬────┘
           ▼
   APPROVAL / PLAN            stage 2 — you present the plan, user approves
           ▼
        coder                stage 3 — implement (sonnet)
           ▼
       tester                stage 4 — tests + evidence (sonnet)
           ▼
      ┌────┴────┐ parallel
      ▼         ▼
 security   reviewer         stage 5 — audits (opus / sonnet)
 -auditor
      └────┬────┘
           ▼
      final-qa               stage 6 — reconcile + verdict (opus)
           ▼
     FINAL REPORT → user
```

## Steps

1. **Recon + design (parallel).** Spawn `explorer` and `architect` in one
   message. Give `architect` the same task text; it will fold in the explorer
   map when you pass it. If they must be sequential (architect needs the map),
   run `explorer` first, then `architect` with the map.
2. **Approval gate.** Present the architect's plan to the user with `ExitPlanMode`
   (or plainly if not in plan mode). List the open decisions explicitly. Do not
   proceed until the user approves. Fold their answers into the plan.
3. **Code.** Spawn `coder` with the approved plan verbatim. Relay its changelog.
4. **Test.** Spawn `tester` with the coder's changelog + the architect's test
   strategy. If it reports failures, loop back to `coder` with the specifics
   (max 2 loops, then surface to the user).
5. **Audit (parallel).** Spawn `security-auditor` and `reviewer` in one message,
   both pointed at the pending diff.
6. **Final QA.** Spawn `final-qa` with both findings sets. It produces the verdict
   and the final report.
7. **Deliver.** Relay the final report. Commit only if the user asked; use the
   attribution lines from the session's system prompt.

## Rules

- One stage at a time except the two explicit parallel pairs.
- Never skip the approval gate for a change that writes files, migrations, or
  touches infra.
- Subagents don't share memory — pass forward everything the next stage needs.
- If the task is trivial (one-line fix, pure question), say so and skip the
  pipeline rather than run all six stages.
- Keep the user's decisions visible: anything the architect flagged as "open"
  must be answered at the gate or carried into the final report as a follow-up.
