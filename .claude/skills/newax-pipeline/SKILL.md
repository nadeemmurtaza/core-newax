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
      └────┬────┘
           ▼
   APPROVAL / PLAN            stage 2 — you present the plan, user approves
           ▼
        coder                stage 3 — implement
           ▼
       tester                stage 4 — tests + evidence
           ▼
      ┌────┴────┐ parallel
      ▼         ▼
 security   reviewer         stage 5 — audits
 -auditor
      └────┬────┘
           ▼
      final-qa               stage 6 — reconcile + verdict
           ▼
     FINAL REPORT → user
```

Models are **not fixed** — each stage's `.claude/agents/*.md` frontmatter is only
the default. The conductor picks the model per spawn (the `Agent` tool's `model`
param), scaling to the change in front of it. See **Model selection** below.

## Model selection (auto-shift)

Pass an explicit `model` to every `Agent` spawn. Start from the stage default,
then shift by the weight of the actual change. Re-score after the explorer's map
lands — the first read is from the task text alone.

**Score the change (0–5):**

| Signal | +1 each |
|---|---|
| Scope | touches 3+ files / modules, or is cross-cutting |
| Risk | migration, schema, infra, auth, tenant isolation, or data-destructive |
| Ambiguity | requirements underspecified, or multiple defensible designs |
| Novelty | new subsystem vs. following an existing pattern |
| Blast radius | shared/core code that other features depend on |

**Bands → model per stage:**

| Stage | Light (0–1) | Standard (2–3) — default | Heavy (4–5) |
|---|---|---|---|
| explorer | haiku | haiku | haiku → sonnet if the area is large/unfamiliar |
| architect | sonnet | opus | opus |
| coder | sonnet | sonnet | opus |
| tester | sonnet | sonnet | sonnet |
| security-auditor | sonnet | opus | opus |
| reviewer | sonnet | sonnet | opus |
| final-qa | sonnet | opus | opus |

**Rules:**

- Floors: never run `security-auditor` or `final-qa` below sonnet, regardless of
  score.
- If `tester` bounces back to `coder`, bump `coder` one tier for the retry.
- If the security or review pass returns a high-severity finding, run `final-qa`
  at opus even if the band said sonnet.
- Name the chosen model for each stage in the plan you present at the approval
  gate, with the score and the one line of reasoning. The user can override any
  of them there.

## Steps

1. **Recon + design (parallel).** Spawn `explorer` and `architect` in one
   message. Give `architect` the same task text; it will fold in the explorer
   map when you pass it. If they must be sequential (architect needs the map),
   run `explorer` first, then `architect` with the map.
2. **Approval gate.** Present the architect's plan to the user with `ExitPlanMode`
   (or plainly if not in plan mode). List the open decisions explicitly, plus the
   change score and the per-stage model picks. Do not proceed until the user
   approves. Fold their answers into the plan.
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
- Every `Agent` spawn carries an explicit `model` — chosen per **Model
  selection**, never left implicit.
- Never skip the approval gate for a change that writes files, migrations, or
  touches infra.
- Subagents don't share memory — pass forward everything the next stage needs.
- If the task is trivial (one-line fix, pure question), say so and skip the
  pipeline rather than run all six stages.
- Keep the user's decisions visible: anything the architect flagged as "open"
  must be answered at the gate or carried into the final report as a follow-up.
