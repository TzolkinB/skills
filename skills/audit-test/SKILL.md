---
name: audit-test
description: Audit a passing test for false confidence — would it still pass if the code it covers broke? — and prove the answer by running a targeted mutation, not by reasoning alone
argument-hint: "[test name, test file, test + its code, or a directory/glob/--changed for batch]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
---

**Owns:** whether an *existing* passing test is real — proven by running one targeted mutation. The verifier.
**Not this:** missing paths or new tests to add → `/coverage-review`; redundant or stale tests to remove → `/prune-tests`; whether the source is testable at all → `/qa-review`.

A green test is not proof. This skill asks the sharpest question about the tests you already have: **would this passing test fail if the code it covers broke?** If it wouldn't, it's **false confidence** — it looks like protection but guards nothing.

The trap: an AI can *reason* a test is fine and be exactly as wrong as the test it's judging. So don't stop at reasoning. For a suspect test, reason out the single most-likely-breaking change to the code, **apply that mutation, run just that one test, and report what actually happened** — never the whole suite. The strongest honest claim is factual: "I broke the code like this and the test still passed." Whether the mutation was behaviorally meaningful stays a visible human judgment — this skill is a **challenger, not an oracle**. (See [ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md).)

There's a second, subtler failure the mutation alone can't see: a test whose assertion is *live* but **pinned to the wrong value** — edited to bless a regression (the fingerprint an AI self-healer leaves when it "fixes" a red test by rewriting the expected value). It kills mutations, so it reads 🟢 — yet it *enforces* the broken behavior and would reject the real fix. Catching it needs an intent signal, not just a mutation (see [ADR-0017](../../docs/adr/0017-audit-test-baseline-lock-suspected.md)).

## Steps

1. Resolve the target from $ARGUMENTS:
   - **a single named test** → deep-audit that one test.
   - **a test file** → triage every test in it, deep-audit only the flagged ones.
   - **a test *and* its code** (both paths given) → deep-audit, code-aware. The first-class mode — full confidence needs the code.
   - **a directory, glob, or `--changed`** → resolve to a set of test files, then run [Batch mode](reference/batch-mode.md). Discover test files with the **multi-ecosystem patterns** below; for `--changed`, list files changed against the merge-base (`git diff --name-only main...HEAD`) filtered to those same patterns. This is the mode `/sentinel` calls over a branch's changed tests.
   - **nothing** → default to the whole suite (same patterns) and run [Batch mode](reference/batch-mode.md).

   **Test-file discovery patterns** (extensible by convention — not JS-only, per [ADR-0014](../../docs/adr/0014-sacred-path-integrity-discovery-fails-loud.md)):
   - JS/TS: `**/*.{spec,test}.{js,jsx,ts,tsx,mjs,cjs}`
   - pytest: `**/test_*.py`, `**/*_test.py`
   - Go: `**/*_test.go`
   - JVM: `**/*Test.java`, `**/*Tests.java`, `**/*Test.kt`

   If discovery matches **zero** test files, the audit is **INCONCLUSIVE — no recognized test files**: report it and stop. Never treat "nothing found" as "nothing wrong" — a caller like `/sentinel` must read INCONCLUSIVE as "the audit did not run," not as a clean result.
2. Read the test(s) fully. If code paths are given, read those too.
3. **Triage (cheap, static).** For each test, state its **behavior contract** in one sentence ("what real behavior would break if this failed?"), then smell-check it. The assertion-quality smells — loose, incidental, overmocked (taxonomy 2–4) — are the *same static read* `/coverage-review` defines; apply that read here rather than re-deriving it. The taxonomy below adds the smells specific to *this* skill's question (focal-unit-never-invoked, order-dependent, implementation-coupled, pseudo-tested). What `audit-test` contributes beyond the static read is Step 4 — escalating the suspects to a live mutation. Only suspicious tests advance; this **funnel** keeps runtime to a handful of single-test runs.
4. **Deep audit (per flagged test).** Reason out the single most plausible code change that *should* make this test fail, then prove it — honoring the **Safety rule**:
   - Apply the mutation to the source, run just that one test (framework commands: [reference/run-one-test.md](reference/run-one-test.md)), record pass/fail, then **revert immediately**.
   - Test failed as it should → **🟢 killed the proposed mutation** (proven-solid *against this mutation* — not a blanket guarantee the test is fine). But before recording 🟢 for a *changed* test, run the [Baseline-lock check](reference/baseline-lock-check.md): a live assertion can still be pinned to a regressed value it was edited to match — if it fires, report **⚠️ Baseline-lock suspected**, not 🟢.
   - Test still passed → **candidate 🔴** — do **not** record it yet. Run the [Reachability check](reference/reachability-check.md) first: only a survival that clears reachability is **🔴 Proven false-confidence**; a survival that fails reachability is **🟡** — the mutation never reached the running app, so the test target is stale, not the test proven hollow.
   - If the code can't be run (no runnable env, missing deps), do **not** guess a Proven verdict — fall back to the mutation *thought* experiment and label it **🟡 Likely**.
5. Classify each finding with the failure taxonomy and write the report. A **characterization test** (one deliberately pinning current behavior, even quirky behavior, so a refactor can't change it silently) is *labeled a safety net*, not condemned.
6. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode). Otherwise omit it — default output stays lean.

## Verdicts

Reuses `/sentinel`'s three states, scoped to a single test, plus one suspicion flag (⚠️) for the failure a mutation can't see:

- 🔴 **Proven false-confidence** — mutation ran, test stayed green, **and the reachability check confirmed the harness is source-live**. Factual, execution-proven.
- 🟡 **Likely false-confidence** — reasoned only; code wasn't runnable *or* the mutation didn't reach the running app (stale/remote harness), so this is short of proof.
- 🟢 **Killed the proposed mutation** — the mutation ran and the test failed as it should (or no plausible green-surviving change exists). Proven-solid *against that mutation*; not a blanket "this test is fine." A test that never advanced past triage is **Unexamined**, not 🟢.
- ⚠️ **Baseline-lock suspected** — the assertion is *live* (it kills mutations) but appears pinned to a value the code was **changed to produce**, not its intended behavior. Neither a clean 🟢 nor a hollow 🔴: a distinct suspicion that needs the reviewer (or an intent source) to confirm the intended value. A caller reads it as **caution, never a pass**. (See [ADR-0017](../../docs/adr/0017-audit-test-baseline-lock-suspected.md).)

## Failure taxonomy ("How it fails")

1. **Focal unit never invoked** — the function under test is never actually called (setup runs, assertions check something else).
2. **Overmocked / interaction-only** — asserts a collaborator was *called*, never that the real behavior happened. Verifies the mock, not the code.
3. **Incidental assertion** — checks something true regardless of whether the behavior works (a field that's always set, a status that's always 200).
4. **Loose assertion** — a check that can't meaningfully fail (`toBeDefined()`, `toBeTruthy()` on a whole object). (See GLOSSARY.md: Loose Assertion.)
5. **Order-dependent assertion** — passes only because of test execution order or shared state, not because the behavior is correct.
6. **Implementation-coupled** — asserts *how* the code works (internal calls, private shape) rather than *what* it guarantees; passes even when the guarantee is broken. *(Needs code+test mode to judge.)*
7. **Pseudo-tested** — the strongest, execution-proven case: the code can be broken arbitrarily and the test never notices.
8. **Baseline-locked** — a *live* assertion pinned to the wrong value: it kills mutations but was edited to match a regression, so it enforces the broken behavior and would reject the fix. Distinct from 1–7 (which guard *nothing*); this one guards the *wrong thing*. Detected via the Baseline-lock check, not the mutation alone.

## Output Format

Single-test / flagged-test entry:

```
## audit-test: "rejects overlapping bookings"
**Verdict:** 🔴 Proven false-confidence
**How it fails:** Overmocked — asserts save() was called, never that the overlap was rejected
**Proof:** commented out the overlap guard (booking.ts:34) → ran this test → still passed
**A real test would:** assert the 2nd booking is rejected with 409, not that save() ran
```

For a 🟡 verdict, replace **Proof** with **Reasoning** and say why the code couldn't be run. For a 🟢, state briefly what made it fail (or why no green-surviving change exists). For **⚠️ Baseline-lock suspected**, show the intent signal — the co-changed assertion (`old → new` expected value) or the in-code source of truth it contradicts — and the remedy:

```
## audit-test: "renders the initial deck"
**Verdict:** ⚠️ Baseline-lock suspected
**How it fails:** Baseline-locked — assertion loosened in lockstep with the code change it should catch
**Signal:** assertion `toHaveCount(12)` → `toHaveCount(10)`, co-changed with `Main.reducer.ts` slicing the deck to 10; `robots.ts` declares 12 cards / 6 pairs
**Remedy:** restore `toHaveCount(12)`, or — if a 10-card deck is intended — update `robots.ts`/the deck's declared size to match. Confirm the intended count before merging.
```

Single-test mode always shows its verdict, including 🟢. **Batch mode** reports a provenance tally instead — Unexamined tests are never folded into the proven-solid greens; see [reference/batch-mode.md](reference/batch-mode.md) for its format ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)).

## Structured emission (`--emit-json=<path>`) — for the Gate skill

When `--emit-json=<path>` is present in $ARGUMENTS, **also** write the run's provenance tally as a small
`gate-audit-test/v0.1` JSON file at that path — *in addition to* the human report, which is unchanged. This is
the **parsed** credibility input the Gate skill (`/gate`) ingests: a *parsed* proven-clean verdict is
the only thing that lets Gate lift a release decision to `ship` (the B→A graduation,
[ADR-0029](../../docs/adr/0029-witness-parsed-audit-test-graduation.md)). Emit **only the counts** — never a
prose scrape and never a confidence number; Gate derives the category itself
([schema](../gate/schema/audit-test-emission.v0.schema.json)):

```json
{
  "schema": "gate-audit-test/v0.1",
  "producer": "audit-test",
  "scope": "--changed",
  "audited": 47,
  "deepAudited": 5,
  "provenSolid": 2,
  "provenHollow": 1,
  "likelyHollow": 1,
  "baselineLock": 1,
  "unexamined": 42
}
```

The counts map 1:1 to the batch tally's verdict classes: `provenSolid` = 🟢, `provenHollow` = 🔴,
`likelyHollow` = 🟡, `baselineLock` = ⚠️, `unexamined` = triaged-but-never-mutated; `deepAudited` = how many
advanced past triage, `audited` = total triaged. **The counts must be truthful and consistent** — in
particular, if you deep-audited nothing, `deepAudited` is `0` (Gate derives `unexamined` → the run can
never reach `ship`). For an **INCONCLUSIVE** run (no recognized test files), emit all-zero counts. Emission is
mechanical bookkeeping of the verdicts you already assigned — it introduces **no** new judgment, so it works in
single-test mode too (the tally is just that one test's class).

## Explain Mode (`--explain`)

Usage: `/audit-test tests/booking.spec.ts --explain`. When present, append after the standard report:

```
### Why This Matters
[1-2 plain-language sentences per flagged category on why this class of false confidence is
dangerous generally — e.g. why an overmocked test is worse than no test because it looks like
protection while guarding nothing. Link to GLOSSARY.md terms rather than re-explaining,
e.g. "See: False Positive Test", "See: Loose Assertion".]
```

The default report already teaches specifically (it names the mutation and the fix); `--explain` adds the generalizable concept.

## Safety rule (mutations edit source)

Deep audit changes real files, so it inherits the same hard rule as `prune-tests`' apply mode ([ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md)):

1. Refuse to run mutations unless `git status` reports a **clean tree** (or the user points to a scratch copy). Print the reason and fall back to 🟡 (reasoning only) otherwise.
2. Mutate → run the single test → **revert** — one test at a time, never leave more than one mutation live.
3. Revert immediately after each single-test run, and **verify the tree is clean with `git status` before finishing**. The clean-tree precondition makes recovery *possible* if a run dies mid-mutation — `git checkout -- <file>` restores the source — but that is a manual recovery step, not a guarantee the skill can make about a crashed session. Never leave a mutation live between tests.

## Notes

- **This is not `coverage-review`.** Don't flag missing paths or propose new tests — that's the additive skill. This judges tests that *already pass*.
- **This is not `prune-tests`.** Don't propose deleting anything. A false-confidence test is often guarding a real behavior badly — the fix is usually to *strengthen* it, not remove it.
- **`audit-test` vs Stryker.** `audit-test` is the *judgment* tool — interactive, per-test, no setup, a taxonomy verdict + a concrete fix; it never produces a codebase-wide [mutation score](../../GLOSSARY.md#mutation-score). Use it to review a PR or a suspect test and get a *fix*; reach for [StrykerJS](https://stryker-mutator.io/) for periodic suite health, a defensible mutation score, or release gating. Run `audit-test` first (it's cheap), fix what it flags, then spend Stryker's minutes-to-hours if you need the number. ([ADR-0004](../../docs/adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md).)
