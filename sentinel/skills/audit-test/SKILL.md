---
name: audit-test
description: Audit a passing test for false confidence — would it still pass if the code it covers broke? — and prove the answer by running a targeted mutation, not by reasoning alone
argument-hint: "[test name, test file, test + its code, or a directory/glob/--changed for batch]"
allowed-tools: [Read, Bash, Glob]
---

**Owns:** whether an *existing* passing test is real — proven by running one targeted mutation. The verifier.
**Not this:** missing paths or new tests to add → `/coverage-review`; redundant or stale tests to remove → `/prune-tests`; whether the source is testable at all → `/qa-review`.

A green test is not proof. This skill asks the sharpest question about the tests you already have: **would this passing test fail if the code it covers broke?** If it wouldn't, it's **false confidence** — it looks like protection but guards nothing.

The trap: an AI can *reason* a test is fine and be exactly as wrong as the test it's judging. So don't stop at reasoning. For a suspect test, reason out the single most-likely-breaking change to the code, **apply that mutation, run just that one test, and report what actually happened** — never the whole suite. The strongest honest claim is factual: "I broke the code like this and the test still passed." Whether the mutation was behaviorally meaningful stays a visible human judgment — this skill is a **challenger, not an oracle**. (See [ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md).)

## Steps

1. Resolve the target from $ARGUMENTS:
   - **a single named test** → deep-audit that one test.
   - **a test file** → triage every test in it, deep-audit only the flagged ones.
   - **a test *and* its code** (both paths given) → deep-audit, code-aware. The first-class mode — full confidence needs the code.
   - **a directory, glob, or `--changed`** → resolve to a set of test files, then run **Batch mode**. Discover test files with the **multi-ecosystem patterns** below; for `--changed`, list files changed against the merge-base (`git diff --name-only main...HEAD`) filtered to those same patterns. This is the mode `/sentinel` calls over a branch's changed tests.
   - **nothing** → default to the whole suite (same patterns) and run Batch mode.

   **Test-file discovery patterns** (extensible by convention — not JS-only, per [ADR-0014](../../docs/adr/0014-sacred-path-integrity-discovery-fails-loud.md)):
   - JS/TS: `**/*.{spec,test}.{js,jsx,ts,tsx,mjs,cjs}`
   - pytest: `**/test_*.py`, `**/*_test.py`
   - Go: `**/*_test.go`
   - JVM: `**/*Test.java`, `**/*Tests.java`, `**/*Test.kt`

   If discovery matches **zero** test files, the audit is **INCONCLUSIVE — no recognized test files**: report it and stop. Never treat "nothing found" as "nothing wrong" — a caller like `/sentinel` must read INCONCLUSIVE as "the audit did not run," not as a clean result.
2. Read the test(s) fully. If code paths are given, read those too.
3. **Triage (cheap, static).** For each test, state its **behavior contract** in one sentence ("what real behavior would break if this failed?"), then smell-check it. The assertion-quality smells — loose, incidental, overmocked (taxonomy 2–4) — are the *same static read* `/coverage-review` defines; apply that read here rather than re-deriving it. The taxonomy below adds the smells specific to *this* skill's question (focal-unit-never-invoked, order-dependent, implementation-coupled, pseudo-tested). What `audit-test` contributes beyond the static read is Step 4 — escalating the suspects to a live mutation. Only suspicious tests advance; this **funnel** keeps runtime to a handful of single-test runs.
4. **Deep audit (per flagged test).** Reason out the single most plausible code change that *should* make this test fail, then prove it — honoring the **Safety rule**:
   - Apply the mutation to the source, run just that one test, record pass/fail, then **revert immediately**.
   - Test still passed → **🔴 Proven false-confidence.** Test failed as it should → **🟢 killed the proposed mutation** (proven-solid *against this mutation* — not a blanket guarantee the test is fine).
   - If the code can't be run (no runnable env, missing deps), do **not** guess a Proven verdict — fall back to the mutation *thought* experiment and label it **🟡 Likely**.
5. Classify each finding with the failure taxonomy and write the report. A **characterization test** (one deliberately pinning current behavior, even quirky behavior, so a refactor can't change it silently) is *labeled a safety net*, not condemned.
6. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode). Otherwise omit it — default output stays lean.

## Verdicts

Reuses `/sentinel`'s three states, scoped to a single test:

- 🔴 **Proven false-confidence** — mutation ran, test stayed green. Factual, execution-proven.
- 🟡 **Likely false-confidence** — reasoned only; code wasn't runnable, so this is the thought experiment, not proof.
- 🟢 **Killed the proposed mutation** — the mutation ran and the test failed as it should (or no plausible green-surviving change exists). Proven-solid *against that mutation*; not a blanket "this test is fine." A test that never advanced past triage is **Unexamined**, not 🟢.

## Batch / directory mode

The same audit fanned out over a set of test files, with the triage funnel doing the cost control. It's how `/sentinel` consumes this skill.

1. **Resolve the file set** (Step 1). If discovery matches no test files, report **INCONCLUSIVE — no recognized test files** and stop. A caller like `/sentinel` must treat INCONCLUSIVE as "the audit did not run," never as a clean result.
2. **Triage every test** (Step 3), then **deep-audit only the flagged ones** (Step 4) — never more than one live mutation across the whole batch, reverting between each.
3. **Cost guard.** The funnel normally keeps deep audits to a handful. If more than ~15 tests flag, or even triage is heavy, report the counts and ask the user to narrow scope rather than grinding the whole suite — deep-audit the highest-smell tests first and say plainly which ones you did **not** reach.
4. **Report the tally plus flagged-only** (see Output Format). Each flagged entry names the test **and its file path**, so a caller — e.g. `/sentinel` mapping findings to sacred paths — can locate every finding without re-triaging.

Batch mode judges tests exactly as single-test mode does; it does **not** know or care about sacred paths or branch verdicts — that's the caller's synthesis.

## Failure taxonomy ("How it fails")

1. **Focal unit never invoked** — the function under test is never actually called (setup runs, assertions check something else).
2. **Overmocked / interaction-only** — asserts a collaborator was *called*, never that the real behavior happened. Verifies the mock, not the code.
3. **Incidental assertion** — checks something true regardless of whether the behavior works (a field that's always set, a status that's always 200).
4. **Loose assertion** — a check that can't meaningfully fail (`toBeDefined()`, `toBeTruthy()` on a whole object). (See GLOSSARY.md: Loose Assertion.)
5. **Order-dependent assertion** — passes only because of test execution order or shared state, not because the behavior is correct.
6. **Implementation-coupled** — asserts *how* the code works (internal calls, private shape) rather than *what* it guarantees; passes even when the guarantee is broken. *(Needs code+test mode to judge.)*
7. **Pseudo-tested** — the strongest, execution-proven case: the code can be broken arbitrarily and the test never notices.

## Output Format

Single-test / flagged-test entry:

```
## audit-test: "rejects overlapping bookings"
**Verdict:** 🔴 Proven false-confidence
**How it fails:** Overmocked — asserts save() was called, never that the overlap was rejected
**Proof:** commented out the overlap guard (booking.ts:34) → ran this test → still passed
**A real test would:** assert the 2nd booking is rejected with 409, not that save() ran
```

For a 🟡 verdict, replace **Proof** with **Reasoning** and say why the code couldn't be run. For a 🟢, state briefly what made it fail (or why no green-surviving change exists).

**Batch mode** shows flagged findings plus a **provenance tally** — never a flat "hold up" count, which hides the difference between a test proven solid and one never examined ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). Only deep-audited tests can be 🟢; every test that never left triage is **Unexamined**, counted separately and never as green. Each line carries the test's **file path**:

```
Audited 47 · deep-audited 5 (3 🟢 proven-solid · 1 🔴 proven-hollow · 1 🟡 likely-hollow) · 42 unexamined

🔴 "rejects overlapping bookings" (booking.spec.ts) — overmocked (proof: removed guard, still green)
🟡 "sends confirmation email" (email.spec.ts) — likely incidental (env not runnable, reasoned only)
🟢 "charges the card" (payment.spec.ts) — killed the proposed mutation (nulled the amount → test failed)

42 unexamined — triaged clean but never mutated; not evidence of health. Use `--all` to list them.
```

Single-test mode always shows its verdict, including 🟢. In batch mode, `--all` additionally lists the **Unexamined** tests; without it they are summarized by count only — but they are **never** folded into the proven-solid greens.

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

## Running just one test

"Run just that one test" is framework-specific — never run the whole suite, and never trust a run you can't confirm targeted exactly one test:

- **Jest / Vitest:** `jest -t '<test name>' <file>` / `vitest run -t '<test name>' <file>`
- **pytest:** `pytest '<file>::<test_id>'`
- **Go:** `go test -run '^<TestName>$' ./<pkg>`
- **JUnit (Maven / Gradle):** `mvn -Dtest='<Class>#<method>' test` / `gradle test --tests '<Class>.<method>'`

If the name is ambiguous (duplicate names, parametrized cases), target by file + name and **confirm the run executed exactly one test**. A selector that matches zero tests "passes" vacuously and would fake a 🟢 — if you can't confirm exactly one test ran, fall back to 🟡.

## Notes

- **This is not `coverage-review`.** Don't flag missing paths or propose new tests — that's the additive skill. This judges tests that *already pass*.
- **This is not `prune-tests`.** Don't propose deleting anything. A false-confidence test is often guarding a real behavior badly — the fix is usually to *strengthen* it, not remove it.
- **When to reach for Stryker instead.** `audit-test` is the *judgment* tool: interactive, per-test, no setup, funnel-bounded, handing you a taxonomy verdict + a concrete fix. It never produces a codebase-wide [mutation score](../../GLOSSARY.md#mutation-score) — that's a full [mutation campaign](../../GLOSSARY.md#mutation-campaign) (see [StrykerJS](https://stryker-mutator.io/)), the heavyweight route this skill deliberately avoids ([ADR-0004](../../docs/adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)). Reach for `audit-test` when reviewing a PR, a suspicious test, or you want a *fix* not a number; reach for Stryker for periodic suite health, a defensible mutation score, or gating a release. Run `audit-test` first — it's cheap — and fix what it flags before spending Stryker's minutes-to-hours. (The funnel can't pre-filter a Stryker run: Stryker mutates *source*, `audit-test` triages *tests*. Consuming a Stryker survivor report into this taxonomy is a planned seam, not built yet.)
