# NEWAX multi-agent delivery pipeline

A staged agent workflow for delivering non-trivial changes to this repo.

```
YOU
 │
 ▼
NEWAX MAIN AGENT ────────────┐
 │  parallel                 │
 ▼                           ▼
ARCHITECT (opus)        EXPLORER (haiku)
 │  design                   read-only recon
 └─────────────┬─────────────┘
               ▼
        APPROVAL / PLAN   ← user approves, open decisions answered
               ▼
          CODER (sonnet)  implement the approved plan
               ▼
         TESTER (sonnet)  smoke tests + dry-runs + evidence
               │
        ┌──────┴──────┐  parallel
        ▼             ▼
 SECURITY-AUDITOR   REVIEWER (sonnet)
   (opus)
        └──────┬──────┘
               ▼
         FINAL-QA (opus)  reconcile findings, verdict
               ▼
          FINAL REPORT → YOU
```

## Files

| File | Role | Model |
|---|---|---|
| `.claude/agents/explorer.md` | read-only recon of code + live env | haiku |
| `.claude/agents/architect.md` | ordered implementation plan + risks + test strategy | opus |
| `.claude/agents/coder.md` | implement the approved plan | sonnet |
| `.claude/agents/tester.md` | write/run tests, report pass/fail | sonnet |
| `.claude/agents/security-auditor.md` | secrets, SQLi, tenant isolation, blast radius | opus |
| `.claude/agents/reviewer.md` | correctness, simplicity, plan fidelity | sonnet |
| `.claude/agents/final-qa.md` | reconcile + verdict + final report | opus |
| `.claude/skills/newax-pipeline/SKILL.md` | the orchestration procedure | — |

## Use

- `/newax-pipeline <task>` — or ask to "run the full pipeline on …".
- Claude Code auto-discovers `.claude/agents/*` when working in this repo. To use
  the agents globally, copy them to `~/.claude/agents/`.
- Trivial tasks skip the pipeline by design — it's for changes big enough to
  warrant a plan and an approval gate.

## Notes

- The stages are separate subagents with no shared memory; the main agent carries
  each stage's output into the next.
- The two parallel pairs (explorer+architect, security+reviewer) are spawned in a
  single step each.
- The approval gate is mandatory for anything that writes files, adds migrations,
  or touches infra.
