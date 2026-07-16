# Skill-eval CI runs only the diff's affected skills, and reports before it gates

**Status: Accepted (2026-07-15).** Implements the "runs on every edit" half of
[ADR-0022](0022-skill-eval-harness-asserts-tokens-judges-prose.md) — the three-tier rigor model —
by wiring Tier 0 (lint) and Tier 1 (fixture-outcome) into CI. Where ADR-0022 decided *how* a run is
graded, this decides *which* runs happen on a PR and *whether the result blocks the merge*.

> **Update (2026-07-16) — gate flipped on.** The precondition this ADR set for gating the
> change-detection step — a passing one-time LLM-judge meta-eval *per case* — is now met for every
> skill with a case (all 10 fixture-backed skills). CI therefore runs `changed.mjs --gate`: a changed
> skill whose offline self-test stops discriminating, or a lint error on a changed `SKILL.md`, now
> fails the check. This gates only the **deterministic** offline self-test over recorded samples (the
> data-integrity guard); it does **not** gate live skill behavior, which still needs `--live` + the
> LLM judge and stays a manual step. `changed.mjs` still defaults to report-first without `--gate`.

## Context

The harness (ADR-0022) can now grade five skills' cases offline. But a check that no PR runs is not a
regression guard. The naïve wiring — run all thirteen skills' evals on every PR — is wasteful today
and, once Tier 1 gains `--live` runs (a real agent, ~$0.20–0.40/trial), unaffordable. A skill edit
touches one skill; the eval that could catch its regression is that skill's, not the whole suite.

Two forces shape the wiring:

- **Blast radius is mostly local, but not always.** A changed `SKILL.md` affects one skill. A changed
  `cases/<skill>.json` or one of its samples affects that skill. But a change to the **runner or a
  grader** (`run-eval.mjs`, `lib/*`) can shift *every* skill's outcome — a whole-suite blast radius,
  the direct analogue of `/e2e-impact`'s global → run-all bucket.
- **The gate question is not uniform.** [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)
  ("label, don't gate") and ADR-0022 §Decision.7 both say a case earns a merge-block only once trusted,
  and the epic fixes the precondition: a passing one-time LLM-judge meta-eval. Yet some checks in this
  workflow are *not* judgment calls — that the linter still detects a seeded no-op, that the
  change-detector still maps a diff correctly — and gating those is ordinary hygiene, not a premature gate.

## Decision

Add `sentinel/evals/changed.mjs` and a `skill-evals` PR workflow with a **split stance**:

1. **Select by diff.** Map the PR's changed files → affected skills: a changed `SKILL.md` →
   that skill; a changed `cases/<skill>.json` or `samples/<skill>.*` → that skill; a changed
   **runner/grader** (`run-eval.mjs`, `lib/`) → *every* skill that has a case (run-all). Run only the
   affected skills' `--self-test` + a lint scoped to the changed `SKILL.md`.
2. **Report-first for eval verdicts.** The change-detection step runs the **offline heuristic** judge
   (no API key in CI — the LLM meta-eval stays a manual trust step), writes a per-skill job summary,
   and **exits 0 even on a failing self-test.** The signal is the summary, not a red X. A `--gate` flag
   flips it to blocking; it is held until the meta-eval establishes trust (ADR-0013 lineage).
3. **Gate the tooling self-tests.** `lint.mjs --self-test` and `changed.mjs --self-test` are
   deterministic, offline unit checks that the harness *itself* works. They **block the merge** — a
   break there is a bug, not a judgment call.
4. **Surface coverage gaps.** A changed `SKILL.md` with no `cases/<skill>.json` is reported as a
   coverage gap — there is no eval to catch its regression — rather than silently passing.

## Considered options

- **Run all thirteen evals on every PR.** Rejected: wasteful now, unaffordable once `--live` costs
  real money; and it buries the one relevant result under twelve no-ops.
- **Gate the eval verdicts immediately.** Rejected: violates ADR-0013 and ADR-0022 §Decision.7 — the
  LLM judge is a screen, not an oracle, until its meta-eval passes. Premature gating trains people to
  ignore or rubber-stamp a red X.
- **Gate nothing (pure report).** Rejected: lets a genuinely broken linter or change-detector merge
  green. The tooling self-tests are deterministic and cheap to gate, so they should be.
- **A path-import of the runner instead of a subprocess.** Rejected: `run-eval.mjs` / `lint.mjs` are
  scripts with top-level `process.exit`; `changed.mjs` shells out to the exact entry points a human
  runs, so CI and local behave identically.
- **Chosen: diff-scoped selection, report-first eval verdicts, gated tooling self-tests.**

## Consequences

- **PR cost scales with the diff, not the suite.** A one-skill edit runs one self-test; a
  runner/grader edit fans out to all five (correctly). Tier 2 blinded experiments stay manual (ADR-0022).
- **The report is visible without being punitive.** Reviewers see the affected-skill table and any
  coverage gap in the PR's job summary; nothing goes red on a judgment call. Flipping `--gate` on later
  is a one-line change once the meta-eval trust gate is met — the same label-then-gate path Sentinel
  preaches to its users.
- **`changed.mjs` is itself under the harness's own discipline.** Its `classifyChanges` is a pure
  function with a `--self-test`, so the selector that decides what runs is itself a graded, gating check.
- **No API key in CI.** The per-PR judge is the free heuristic; the LLM-judge meta-eval remains the
  deliberate, keyed, manual step recorded on the PR — cost stays off the critical path.
- **Dev tooling, not user-facing.** No CHANGELOG entry, consistent with the rest of the eval harness.
