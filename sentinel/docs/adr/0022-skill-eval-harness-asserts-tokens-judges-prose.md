# The skill-eval harness asserts on tokens, judges the prose against the fixture rubric, and never diffs output

**Status: Proposed (2026-07-15).** Prompted by the *"Don't ship skills without evals"* talk
(Philipp Schmid, Google DeepMind) and the [skill maturity pass](../../fixtures/README.md) against
Matt Pocock's *writing-great-skills* rubric. A cross-cutting decision for how the suite protects
itself against regression on every skill edit — the counterpart to [ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md),
which decided *how skills are triggered*; this decides *how we know a skill still works after we change it*.

## Context

Thirteen skills are under active development. Today the only guard against a skill edit silently
degrading is the **manual, reasoning-based** dogfood check the [fixtures README](../../fixtures/README.md)
describes: a human runs the skill against its known-bad fixture and reads the output to confirm the
planted smell still surfaced. That is real discipline, but it is not repeatable, not run on every
change, and it measures a single trial of a nondeterministic system.

Two constraints bound any automation of that check:

- **The fixtures README already forbids output-diffing.** "Skill output is prose that varies run to
  run, so there is deliberately no exact-output comparison, no snapshot, no CI gate that diffs skill
  output. `expected-findings.md` is a human checklist, not a golden file." That decision is correct
  and this ADR does **not** overturn it.
- **Trigger-accuracy evals mostly do not apply here.** Eleven of thirteen skills are user-invoked
  ([ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)); a user typing `/audit-test` cannot
  "fail to trigger." Only the two model-invoked entry points (`ask-sentinel`, `sentinel`) have a
  trigger/routing surface worth evaluating. The talk's central theme — description tuning to stop
  over/under-firing — is therefore ~85% out of scope by design.

The talk's transferable prescriptions are narrower than its framing: **cheap deterministic asserts
where the output is deterministic; LLM-as-judge against a rubric where it is prose; grade outcomes
not paths; isolated runs; multiple trials for a reliability number.** The suite already owns the
deep end of this — [EXPERIMENT-0018](../experiments/EXPERIMENT-0018-drift-triage.md) is a blinded
sensitivity/specificity study. What is missing is the cheap, repeatable middle tier that runs on
every edit.

## Decision

Adopt a **three-tier rigor model**, and build the missing middle tier as a lightweight harness whose
grading stance is fixed by this ADR:

- **Tier 0 — lint** (every commit, no model calls): no-op detector, description why/how/directive
  shape, dead reference-link check, frontmatter sanity.
- **Tier 1 — fixture-outcome harness** (every *changed* skill): run the skill on its fixture in an
  isolated worktree, N trials, grade the run.
- **Tier 2 — blinded experiment** (occasional, ADR-gating): stays manual, as EXPERIMENT-0018 is.

The harness's grading stance — the load-bearing decision:

1. **Assert deterministically only on genuinely deterministic tokens** — a verdict emoji
   (`🔴`/`🟡`/`🟢`), a route name, a cited filename. These are cheap, free of model cost, and fail fast.
2. **Judge the prose with an LLM-as-judge against the fixture's `expected-findings.md`**, which is
   hereby promoted from a human checklist to the executable rubric (`must_surface` / `must_not`
   items). The judge must **quote the transcript line** that satisfies each `must_surface` item —
   grounding against a rubber-stamp pass.
3. **Never diff prose, never snapshot, never golden-file.** This upholds the fixtures README verbatim;
   the harness automates the *"a human reads the run and confirms the planted smell"* step with a
   rubric-judge, it does not compare output strings.
4. **Grade outcomes, not paths.** Pass means the planted finding was surfaced (or the correct
   verdict/route reached), never "the skill loaded on turn 1."
5. **Isolate every run** in a fresh worktree so the agent cannot read a prior transcript and pass
   without doing the work.
6. **Report reliability, not a boolean.** N trials per case → passes/N; nondeterminism is measured,
   not hidden.
7. **Label, don't gate — at first.** Emit a reliability report; promote a case to a merge-blocking
   gate only once it is stable, in the lineage of [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md).

## Considered options

- **Golden-file / snapshot diff of skill output.** Rejected: the fixtures README forbids it, and
  correctly — prose output varies run to run, so a diff harness would be all false failures.
- **LLM-as-judge for everything, including the verdict skills.** Rejected: it throws away a free,
  deterministic signal (the `🔴`/route token) and pays judge cost + judge nondeterminism to
  re-derive something a regex settles. Judge the prose; assert the token.
- **Deterministic regex for everything.** Rejected: it cannot grade a prose judgment (did
  `coverage-review` name the untested boundary?) without brittle keyword matching that a reworded but
  correct run would fail.
- **Keep it fully manual (status quo).** Rejected for the regression-on-edit case — a hand check does
  not run on every change and measures one trial. **Retained** for Tier 2: blinded multi-arm
  experiments stay manual and occasional; the harness does not try to automate them.
- **Chosen: token-assert + rubric-judge + never-diff, tiered.** Automates the frequent-cheap tier
  without violating the no-diff decision or over-investing in the two trigger surfaces.

## Consequences

- **`expected-findings.md` files become the rubric of record.** Their existing sections map directly:
  "Verdict the skill should reach" → `expect_verdict` token assert; the finding taxonomy →
  `must_surface`; "what the skill should NOT do" → `must_not` (the false-positive guard). Writing a
  fixture now means writing an executable spec, for free.
- **The verdict-emitting skills grade cheapest** — `audit-test` (`🔴`/`🟡`), `debug-test`
  (drift/local, flake), `contract-guard` (deliberate/accidental), `e2e-impact` (source→spec map),
  and the two routers — because the deterministic assert does most of the work. The prose-only skills
  (`coverage-review`, `qa-review`, `prune-tests`, `threat-model`) are judge-heavy and land second.
- **The judge is itself an LLM** — nondeterministic and prone to rubber-stamping. Mitigations are
  mandatory, not optional: quote-grounding (§Decision.2), a cheap judge model, periodic hand
  spot-checks, and a one-time meta-eval of the judge against a known-good and a known-bad transcript.
  Expectations stay modest; the judge is a screen, not an oracle.
- **The router eval (Tier 1b) is the acceptance substrate for [#47](../../../README.md).** Proving a
  13-way router routes correctly is exactly a should-route/should-not-route case set — the one place
  the talk's trigger machinery is on-target.
- **Feeds Witness (#49) later.** A calibration loop is an eval loop; the harness's per-case reliability
  numbers are an input the Gate-stage plugin can calibrate against.
- **Reversible and cheap by construction.** Tier 0 is pure text (free, every commit); Tier 1 is gated
  to the changed skill × a few trials, not all thirteen × six on every PR; Tier 2 is untouched. If the
  judge proves untrustworthy, the token asserts and the lint still stand on their own.
