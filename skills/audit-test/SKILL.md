---
name: audit-test
description: Audit a passing test for false confidence — would it still pass if the code it covers broke? — and prove the answer by running a targeted mutation, not by reasoning alone
argument-hint: "[test name, test file, or test + its code]"
allowed-tools: [Read, Bash, Glob]
---

## Philosophy

A green test is not proof. `coverage-review` asks "what's *missing*?" and `prune-tests` asks "which tests cost more than they protect?" This skill asks the sharpest question about the tests you already have: **would this passing test fail if the code it covers broke?** If it wouldn't, it's false confidence — it looks like protection but guards nothing.

The trap is that an AI can *reason* a test is fine and be exactly as wrong as the test it's judging — that's the same false-confidence failure, one level up. So `audit-test` doesn't stop at reasoning. For a test it suspects, it reasons out the single most-likely-breaking change to the code, **applies that mutation, runs just that one test, and reports what actually happened.** The strongest honest claim is factual: "I broke the code like this and the test still passed." (See [ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md).)

Whether the mutation was behaviorally meaningful stays a visible human judgment — this skill is a challenger, not an oracle.

## Steps

1. Resolve the target from $ARGUMENTS:
   - **a single named test** → deep-audit that one test.
   - **a test file** → triage every test in it, deep-audit only the flagged ones.
   - **a test *and* its code** (both paths given) → deep-audit, code-aware. This is the first-class mode — full confidence needs the code.
   - **a directory / glob, or nothing** → `Glob` for `**/*.{spec,test}.*` and triage across the suite. *(Batch is the fast-follow; if the suite is large, ask the user to narrow scope.)*
2. Read the test(s) fully. If code paths are given, read those too.
3. **Triage (cheap, static).** For each test, state its **behavior contract** in one sentence ("what real behavior would break if this failed?") and smell-check it against the failure taxonomy below. Only tests that smell suspicious advance — this keeps runtime to a handful of single-test runs.
4. **Deep audit (per flagged test).** Reason out the single most plausible code change that *should* make this test fail. Then prove it:
   - **Safety first (see Safety rule).** Only run on a clean git tree or a scratch copy, and guarantee revert.
   - Apply the mutation to the source, **run just that one test** (never the whole suite), record pass/fail, then **revert immediately**.
   - Test still passed → **🔴 Proven false-confidence.** Test failed as it should → **🟢 Holds up.**
   - If the code can't be run (no runnable env, missing deps), do **not** guess a Proven verdict — fall back to the mutation *thought* experiment and label it **🟡 Likely**.
5. Classify each finding with the failure taxonomy and write the report. A **characterization test** (one deliberately pinning current behavior) is *labeled a safety net*, not condemned.
6. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode). Otherwise omit it — default output stays lean.

## Verdicts

Reuses `/sentinel`'s three states, scoped to a single test:

- 🔴 **Proven false-confidence** — mutation ran, test stayed green. Factual, execution-proven.
- 🟡 **Likely false-confidence** — reasoned only; code wasn't runnable, so this is the thought experiment, not proof.
- 🟢 **Holds up** — the mutation made it fail as it should, or no plausible green-surviving change exists.

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

For a 🟡 verdict, replace **Proof** with **Reasoning** and say why the code couldn't be run.
For a 🟢 verdict, state briefly what made it fail (or why no green-surviving change exists).

**Batch mode** shows flagged-only plus a tally — never the full green list, which just re-creates the noise this tool exists to cut:

```
Audited 47 · 42 hold up · 5 flagged

🔴 "rejects overlapping bookings" — overmocked (proof: removed guard, still green)
🔴 "charges the card" — focal unit never invoked
🟡 "sends confirmation email" — likely incidental (env not runnable, reasoned only)
...
```

Single-test mode always shows its verdict, including 🟢. (A `--all` flag to show every green in batch mode is a possible later add.)

## Explain Mode (`--explain`)

Usage: `/audit-test tests/booking.spec.ts --explain`

When present, append after the standard report:

```
### Why This Matters
[1-2 plain-language sentences per flagged category on why this class of false confidence is
dangerous generally — e.g. why an overmocked test is worse than no test because it looks like
protection while guarding nothing. Link to GLOSSARY.md terms rather than re-explaining,
e.g. "See: False Positive Test", "See: Loose Assertion", "See: Coverage (line vs behavioral)".]
```

The default report already teaches specifically (it names the mutation and the fix); `--explain` adds the generalizable concept.

## Safety rule (mutations edit source)

Deep audit changes real files, so it inherits the same hard rule as `prune-tests`' apply mode ([ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md)):

1. Refuse to run mutations unless `git status` reports a **clean tree** (or the user points to a scratch copy). Print the reason and fall back to 🟡 (reasoning only) otherwise.
2. Mutate → run the single test → **revert** — one test at a time, never leave more than one mutation live.
3. Guarantee revert even on crash or interrupt. Never leave the tree dirty. Verify with `git status` before finishing.

## Notes

- **Proof, not opinion.** A 🔴 must be backed by an actual run ("I changed X, ran the test, it stayed green"). If you didn't run it, it's 🟡 — never dress up reasoning as proof.
- **Run one test, not the suite.** Cost stays a handful of single-test runs by design; a full mutation campaign is the heavyweight overhead this skill deliberately avoids.
- **This is not `coverage-review`.** Don't flag missing paths or propose new tests — that's the additive skill. This judges tests that *already pass*.
- **This is not `prune-tests`.** Don't propose deleting anything. A false-confidence test is often guarding a real behavior badly — the fix is usually to *strengthen* it, not remove it.
- **When to reach for Stryker instead.** `audit-test` is the *judgment* tool: interactive, per-test, no setup, bounded by the triage funnel, and it hands you a taxonomy verdict + a concrete fix. It does **not** produce a codebase-wide mutation score, and it never will — that's a full [mutation campaign](../../GLOSSARY.md#mutation-campaign) (see [StrykerJS](https://stryker-mutator.io/)), the heavyweight route this skill deliberately avoids ([ADR-0004](../../docs/adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)). Route by the job:
  - *Reviewing a PR, one suspicious test, no Stryker set up, or you want a **fix** not a number* → `audit-test`.
  - *Periodic suite health, a defensible **[mutation score](../../GLOSSARY.md#mutation-score)**, gating a release* → Stryker.
  - *Go/no-go:* run `audit-test` first (it's cheap); if it's flagging lots of false-confidence, fix those before spending Stryker's minutes-to-hours; when the suite looks tight and you need the number, run the campaign.
  - Note the funnel **cannot** pre-filter a Stryker run — Stryker mutates *source*, `audit-test` triages *tests*; they select on different axes. Consuming a Stryker survivor report *into* this skill's taxonomy is a planned seam, not built yet.
- **A characterization test is a safety net, not a failure.** If a test deliberately pins current behavior (even quirky behavior) so a refactor can't change it silently, label it as such and pass it.
- **Never condemn a test you couldn't run** as Proven. Missing environment means 🟡, and say so plainly.
