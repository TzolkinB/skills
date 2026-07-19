# Live skill-eval runs are opt-in per PR and scheduled for drift — report-first, never an auto-gate

**Status: Proposed (2026-07-16).** Decides *when* Tier 1's `--live` mode runs, the one piece
[ADR-0022](0022-skill-eval-harness-asserts-tokens-judges-prose.md) left open and
[ADR-0024](0024-skill-evals-change-detection-report-first-ci.md) explicitly deferred ("once Tier 1
gains `--live` runs … unaffordable" to run on every PR). Implementation is deferred; this ADR fixes
the **trigger model** so the wiring is mechanical.

## Context

The per-PR gate ([ADR-0024](0024-skill-evals-change-detection-report-first-ci.md)) runs
`run-eval.mjs --self-test` — the **offline** grader over **recorded samples**. That is the right
default (deterministic, free, no key), but it has two structural blind spots it can *never* cover:

- **A `SKILL.md` edit that changes live behaviour.** The self-test grades fixed samples, so editing a
  skill's prompt cannot fail it — the samples don't move. The very change most likely to regress a
  skill is invisible to the offline gate. Only a real run (`--live`: isolated worktree → `claude -p`
  agent → N trials → LLM judge) exercises the edited prompt.
- **Model drift.** A new model release can degrade a skill with **no repo change at all** — so no PR,
  no diff, nothing for a change-triggered check to fire on.

But `--live` cannot ride the normal PR gate, for three reasons already fixed by prior ADRs:

- **No API key in CI** ([ADR-0024](0024-skill-evals-change-detection-report-first-ci.md)) — the
  standard job is deliberately keyless and free.
- **Real cost, possibly a subscription.** ~$0.20–0.40/trial on Opus × N trials × affected skills, and
  the agent may bill a Claude Pro/Max **subscription** rather than API credits.
- **A reliability number is not a boolean.** N trials → passes/N is nondeterministic;
  [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md) ("label, don't gate") says that is
  a label, not a merge gate — at least until a per-skill number is proven stable.

## Decision

Wire `--live` behind **two triggers, both report-first** — never a required check, never an auto-gate.

1. **Opt-in per PR (Trigger A — the `SKILL.md`-edit blind spot).** A maintainer opts a PR in — a
   `run-live-evals` label **or** `workflow_dispatch` on the branch — and a **keyed** workflow runs
   `run-eval.mjs --live` for the **diff's affected skills only** (reuse `changed.mjs` selection),
   default `--trials=3`, LLM judge. It posts a **reliability comment** (`passes/trials` per skill) and
   **exits 0 regardless** — the signal is the comment, not a red X. It is not a required status check.
   Primary use: a PR that touches a `SKILL.md`, where the offline gate is blind.

2. **Scheduled drift (Trigger B — the model-drift blind spot).** A **weekly** cron runs `--live`
   across the cased skills — a **rotating subset** each week to bound cost — with the same report, and
   **opens/updates a tracking issue** when a skill's reliability drops below its recorded baseline.
   Each report pins the **model id + date** so a drop is attributable to a model change, not guessed.

Cross-cutting:

- **Report-first, gating is a separate later decision.** Both triggers *label* reliability
  ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)). Gating a merge on a per-skill
  reliability threshold is deferred until a skill's number is demonstrably stable across several runs —
  the same label-then-gate path the offline gate already walked
  ([ADR-0024](0024-skill-evals-change-detection-report-first-ci.md) update, 2026-07-16).
- **Key isolation.** An org/repo secret used **only** by these two opt-in/scheduled workflows, never
  the standard per-PR `skill-evals` job. The subscription-billing caveat is an operational
  prerequisite: the runner must use an **API-key-billed** path (or a self-hosted runner carrying the
  maintainer's auth), documented before either workflow is enabled.

## Considered options

- **Auto-run `--live` on every PR.** Rejected: unaffordable ([ADR-0024](0024-skill-evals-change-detection-report-first-ci.md)),
  keyless CI can't, and a nondeterministic N-trial result as a required check would flake the build and
  bury the signal.
- **Gate on the reliability number immediately.** Rejected: violates
  [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md); a single flaky trial would block
  an innocent merge. A stable baseline must exist first.
- **Local-only, pre-merge (the manual path).** Kept as an always-available escape hatch
  (`run-eval.mjs --live cases/<skill>.json` before merging a prompt change), but rejected as the *sole*
  mechanism: it relies on author discipline and is blind to drift.
- **Nightly full-suite live run.** Rejected as the default on cost; weekly + a rotating subset gives
  drift coverage at a fraction of the spend.
- **Chosen: opt-in per PR (A) + scheduled drift (B), both report-first.**

## Consequences

- **Closes the two blind spots the offline gate structurally cannot.** A `SKILL.md` behaviour
  regression is caught on the PR that introduces it (A); model drift is caught decoupled from any edit
  (B). Together with the offline gate, Tier 1 now covers edits *and* drift.
- **Introduces the first money-spending CI path.** A secret + a billing decision become prerequisites —
  gated behind opt-in / schedule so a contributor never triggers spend by accident.
- **Reliability numbers become the input to the eventual gating decision** (label-then-gate) and feed
  Gate ([#49](../../../README.md)) calibration — a calibration loop is an eval loop.
- **Reversible and additive.** Deleting the two workflows removes all of it; the deterministic offline
  gate stands alone, exactly as today. This ADR adds no dependency to the existing Tier 0/1 path.
