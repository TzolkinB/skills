# audit-test — Batch / directory mode

Loaded from Step 1 when the target is a directory, glob, `--changed`, or nothing. The same audit fanned out over a set of test files, with the triage funnel doing the cost control. It's how `/qa-pass` consumes this skill.

1. **Resolve the file set** (Step 1). If discovery matches no test files, report **INCONCLUSIVE — no recognized test files** and stop. A caller like `/qa-pass` must treat INCONCLUSIVE as "the audit did not run," never as a clean result.
2. **Triage every test** (Step 3), then **deep-audit only the flagged ones** (Step 4) — never more than one live mutation across the whole batch, reverting between each.
3. **Cost guard.** The funnel normally keeps deep audits to a handful. If more than ~15 tests flag, or even triage is heavy, report the counts and ask the user to narrow scope rather than grinding the whole suite — deep-audit the highest-smell tests first and say plainly which ones you did **not** reach.
4. **Report the tally plus flagged-only** (see Output Format). Each flagged entry names the test **and its file path**, so a caller — e.g. `/qa-pass` mapping findings to sacred paths — can locate every finding without re-triaging.

Batch mode judges tests exactly as single-test mode does; it does **not** know or care about sacred paths or branch verdicts — that's the caller's synthesis.

## `--changed` population: hunk-level, with a file fallback

`--changed` audits **the tests this change touched**, not every test in a touched file ([ADR-0055](../../../docs/adr/0055-audit-test-changed-counts-tests-with-changed-lines.md), #276). A spec file with 50 tests where 6 changed is a population of 6, so the examined-floor measures what the PR changed.

1. Get changed line ranges: `git diff -U0 main...HEAD -- <test files>` plus the working tree. Use the **new-file** line ranges.
2. For each discovered test, find its line span (from `test(` / `it(` / `def test_` / `func Test` through its closing line). A test is **in scope** if a changed range overlaps its span.
3. **Fallback for shared code.** A changed range outside every test span can affect more than one test. Widen it to what it can reach, no further:
   - **Inside a `describe` block, outside any test** (a hook, a local helper, a constant): every test in the **innermost enclosing describe**.
   - **At file top level, outside any test or describe** (a shared constant, a top-level hook or helper, a **changed or removed** import): **every test in the file**.
   - **A newly added `import` line does not count.** It can only serve code that was added with it, and that code is already in scope.
4. A file with changes only inside test spans contributes only those tests. A new file contributes all its tests. A deleted test contributes nothing.
5. The population is set **mechanically from the diff, before triage**. It is not chosen by suspicion, so this does not reopen the flagged-population exploit that [ADR-0038](../../../docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md) Decision 1 closed.
6. **Changed support files.** A *modified or deleted* non-test file counts as *test support* when it sits under a test directory (`tests/`, `e2e/`, `cypress/`, `__tests__/`, `spec/`, `fixtures/`, `support/`) or is plainly a page object, fixture or helper. Every discovered test file that **imports it directly** (one hop) is brought in whole, and the scope says `via changed support file`. A support file that is **newly added** brings in nothing: no existing test imported it, and the tests that use it are new, so already in scope. Support the runner loads **without an import** (`cypress/support/e2e.*`, `playwright.config.*`, a global setup file, a Jest/Vitest `setupFiles` entry) cannot be narrowed: the population is the whole suite, and the scope says so. **Application source is not support.** Do not expand a changed `src/` file into the specs that exercise it; mapping app changes to specs is `/e2e-impact`'s job.
7. If you cannot tell which tests changed (a rename-only diff, a generated file, a language you cannot parse spans for), use the whole file and say `file-level (could not resolve test spans)` in the scope.

Say what you did in the tally and `scope`, one count per route: `--changed (7 of 12 tests in 3 files: 2 by changed lines, 3 via whole-file fallback, 2 via changed support file)`. `audited` counts the in-scope tests, so Gate's floor is `deepAudited / audited` over that population. The "of M" total is **counted** (every test in those files at head, e.g. `grep -c` on the test declarations), never estimated; a live check on the fixture once reported 15 where the real total was 12. Gate reads the `scope` text but never decides on it.

**Not for adopting a mature suite.** `--changed` says nothing about older tests that were never audited. To baseline an existing suite, run `/audit-test <directory>` (or `--certify` on the directory) once, deliberately. A PR that only touches a few tests should not carry that backlog.

**Still not covered:** tests that reach a changed support file only through a second import (a barrel file or a helper that re-exports another). The reference stops at one hop. If you see that chain, say so in the report.

**Base ref.** `--changed` diffs against `main`. Pass `--base=<ref>` to use another base (`master`, `develop`, a release branch, or a commit). The scope names the base when it is not `main`.

## Batch output (provenance tally)

Show flagged findings plus a **provenance tally** — never a flat "hold up" count, which hides the difference between a test confirmed solid and one never examined ([ADR-0013](../../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). Only deep-audited tests can be 🟢; every test that never left triage is **Unexamined**, counted separately and never as green. Each line carries the test's **file path**:

```
Audited 47 · deep-audited 5 (2 🟢 confirmed-solid · 1 🔴 confirmed-hollow · 1 🟡 likely-hollow · 1 ⚠️ baseline-lock) · 42 unexamined

🔴 "rejects overlapping bookings" (booking.spec.ts) — overmocked (proof: removed guard, still green)
⚠️ "renders the initial deck" (seed.spec.ts) — baseline-lock: assertion 12→10 co-changed with the deck slice; robots.ts declares 12 (confirm intended count)
🟡 "sends confirmation email" (email.spec.ts) — likely incidental (env not runnable, reasoned only)
🟢 "charges the card" (payment.spec.ts) — killed the proposed mutation (nulled the amount → test failed)

42 unexamined — triaged clean but never mutated; not evidence of health. Use `--all` to list them.
```

In batch mode, `--all` additionally lists the **Unexamined** tests; without it they are summarized by count only — but they are **never** folded into the confirmed-solid greens.

## Diagnostic vs certification mode

Batch mode runs in one of two modes, answering two genuinely different questions ([ADR-0038](../../../docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)):

- **Diagnostic** (default — everything above): triage every test, deep-audit **only the flagged suspects**. Answers *"are there hollow tests among the ones most likely to be hollow?"* Cheap and targeted. A clean diagnostic run found no problems **where it looked** — it has not certified the suite, so Gate's examined-floor ([ADR-0035](../../../docs/adr/0035-gate-examined-floor.md)) correctly caps it at `canary`. This is not a shortfall; it is the honest scope of a suspect-only pass.
- **Certification** (`--certify`): deep-audit a **representative sample sized to the examined-floor ∪ the flagged suspects** (a fixed, publicly-reproducible seeded ordering, not a random draw — see step 2 below), so `deepAudited / audited` can clear the floor *legitimately* and a `ship` recommendation stands on breadth evidence. Answers *"is the suite broadly trustworthy enough to stake a release on?"* — the question `ship` actually asks. Opt-in because breadth costs real mutation runs.

Reach for `--certify` when you want a run that can honestly reach `ship`; stay in the default diagnostic mode for a cheap "anything smell hollow?" check.

### `--certify` — how it works

`--certify` composes with **any** batch population (whole-suite, a dir, a glob, or `--changed`) — it changes *which tests escalate to a mutation*, never the triage step, which still covers the whole resolved population exactly as in diagnostic mode. It is a **batch-only** modifier: on a single named test it is a no-op with a one-line warning (a single test is already fully deep-audited). It is independent of `--examined-floor` — `--certify --examined-floor=25` reads as "certify, but at the cheaper 25% floor."

1. **Triage the whole population** (Step 3), exactly as diagnostic mode does — this enumerates every test identity and flags the suspects.
2. **Draw the sample** — a subset of size `N = ceil(floor% × audited)` (`floor%` = the effective `--examined-floor`, default 50%, clamped ≥ 25%), drawn by a **pinned sha256 hash-and-sort**, not the agent's judgement of "representative." This is **not** a random draw — the seed is a published constant, so the ordering is arbitrary but fully deterministic and *identity-independent*: reproducible **cross-machine** (a fixture drawn on macOS reproduces identically in Linux/Windows CI) and computable by anyone in advance. That has two consequences worth knowing: a fixed seed means every `--certify` run at a given floor draws the **same** subset, so repeated runs accumulate no new breadth on their own (at a 50% floor, the bottom half of the ordering is never drawn); and the emission carries no seed, ordering, or sample manifest, so neither Gate nor a human reviewer can check after the fact that the documented draw was actually performed — only that the documented *command*, if run, would reproduce it (`gate.mjs --self-test` proves the latter, not the former).

   > Sort the triaged identities by `sha256("<SEED>:<id>")` ascending, where `id` is `<file>::<test name>` and `SEED` is the fixed constant `sentinel-certify-v0` (no `--seed` flag in v0). Take the first `N`.

   ```bash
   SEED="sentinel-certify-v0"
   # triaged-ids.txt: one "<file>::<test name>" per line — the full triaged population
   while IFS= read -r id; do
     printf '%s\t%s\n' "$(printf '%s' "$SEED:$id" | shasum -a 256 | cut -d' ' -f1)" "$id"
   done < triaged-ids.txt | LC_ALL=C sort | cut -f2-
   ```

   This emits the whole population in seeded order; `head -n N` is the sample, and reading further down the **same** ordering is the top-up (below). The tool is free — `shasum -a 256` (macOS), `sha256sum` (Linux), `openssl dgst -sha256`, `python3 -c 'import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'`, or `perl -MDigest::SHA=sha256_hex` all emit the **identical** digest, so the sample is identical everywhere. `LC_ALL=C sort` keeps the ordering byte-stable across locales. A fixed seed means each test keeps its hash position forever — adding a test later inserts it at its own position rather than re-shuffling the existing picks.
3. **Deep-audit `sample ∪ suspects`.** Union the sample with the flagged suspects and **dedupe** — a test that is both sampled and flagged is audited once. The **union**, not just the sample, is what `deepAudited` counts.
4. **Verdict semantics for sampled clean tests** — the one place certification differs from diagnostic ([ADR-0041](../../../docs/adr/0041-audit-test-certification-mode-verdict-semantics.md)). The routing key is the **triage smell, not the mode**, so 🟡 keeps its single meaning — *a flagged suspect, reasoned about, not execution-disproven*:
   - A healthy sampled test yields **🟢** the normal way (propose the breaking mutation, run the one test, it fails).
   - A **flagged suspect** with no devisable mutation → **🟡** (unchanged), even when it was also sampled — it still carries a real suspicion signal.
   - A **clean-triaged, sampled** test (drawn for breadth, never flagged), runnable, with **no devisable breaking mutation** → **Unexamined**, *not* 🟡 — triage raised no suspicion to reason about, and routing it to 🟡 would fabricate one and needlessly degrade the run to `WARNED`. **Name it in the report** ("clean-triaged, no breaking mutation found — worth a human look") — a clean test that resists every mutation is itself a mild smell. It gets no `runs[]` record.
   - **Env not runnable** → **🟡** in both modes, unchanged. You cannot certify what you cannot execute.
5. **Adaptive top-up — the floor clears iff achievable.** Because step 4 can drop a sampled test to Unexamined (out of `deepAudited`), the floor is not cleared "by construction." If drop-outs leave `deepAudited` short of the floor, **draw the next identities from the same seeded ordering** (skipping ones already in the union) until the floor clears **or the triaged pool is exhausted**. Pool-exhausted-and-still-short → honest `canary`. Counts stay truthful at whatever point the run stops — an interrupted or exhausted run under-reports rather than claiming breadth it never achieved.
6. **Cost — disclose, don't guard.** The diagnostic `>~15 flagged → narrow scope` guard is **suppressed** in certification (you opted into the expensive path deliberately). Instead, **before running any mutations, print the cost**: how many sampled + suspect tests (K after dedup) will be deep-audited against `audited` total, at the chosen floor — so the user can Ctrl-C or lower `--examined-floor` first. This is [ADR-0035](../../../docs/adr/0035-gate-examined-floor.md)'s "surface the cost" applied at audit time. On a large suite a 50% floor is genuinely many one-at-a-time mutation runs; `--examined-floor=25` or a narrower scope is the documented relief.

### Certification and the emission

Certification needs **no** schema or Gate change ([ADR-0038](../../../docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)) — it produces a truthful tally Gate ingests exactly as any other run. Two things it does add to the emission (see SKILL.md → Structured emission):

- **`scope` self-labels the run** — e.g. `"certify(floor=50%) · --changed"` rather than a bare `"--changed"`, so a human reading the bundle can tell a floor-clearing tally came from a certification run.
- **A loud rationale line when the certified scope is narrower than the whole suite** — e.g. `"certified scope: --changed (12 of ~180 suite test files) — ship recommendation is scoped to this changeset"`. Use a cheap `Glob` count of all test files for the "~M" denominator; if that is not cleanly computable, name the scope without the fraction. This keeps a certified `--changed` `ship` from *reading* broader than it is — disclosure, never a suppressed count.

The floor-clearing certification tally looks like the diagnostic tally, but `deep-audited` now reflects the sampled ∪ suspect breadth:

```
Certify(floor=50%) · whole-suite — Audited 48 · deep-audited 24 (22 🟢 confirmed-solid · 1 🔴 confirmed-hollow · 1 ⚠️ baseline-lock) · 2 unexamined (clean-sampled, no breaking mutation found — worth a look) · 22 not sampled
```
