# prune-tests — which tests cost more than they protect?

> **Agent instructions:** [`skills/prune-tests/SKILL.md`](../skills/prune-tests/SKILL.md)
>
> **Run:** `/prune-tests tests/` (add `--apply` to act)

## What it does

`prune-tests` asks the suite-level question its sibling skills do not ask: which existing tests cost more than they protect? It proposes removing, merging, or rewriting them. Test suites build up **test debt** — tests that cost more than they protect — the same way a codebase builds up technical debt. AI-assisted development makes this worse. Common forms include: redundant test paths, checks that cannot meaningfully fail, and over-mocking that only verifies the mocks. Other tests simply drift out of sync with the code they name.

`prune-tests` is the **subtractive** counterpart to [`coverage-review`](./coverage-review.md). It is deliberately **conservative**. It proposes a categorized plan, and it deletes nothing by default. When a case is uncertain, it keeps the test — matching setup is not matching meaning. It does not re-derive whether a test protects its behavior. That is [`audit-test`](./audit-test.md)'s job. `prune-tests` hands off anything that looks like false confidence, instead of judging it here.

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| The suite feels slow or noisy, and you suspect tests that add cost without adding confidence | **`/prune-tests tests/`** — this page |
| AI generated a pile of tests, and you want the redundant, over-mocked, and stale ones surfaced | **`/prune-tests`** |
| You want a safe, reviewable prune plan, with high-confidence removes and merges applied automatically on a clean tree | **`/prune-tests --apply`** |
| You want the _missing_ tests, not the ones to cut | [`coverage-review`](./coverage-review.md) — `prune-tests` never adds tests |
| A test looks like it never verifies its code | [`audit-test`](./audit-test.md), which proves it by mutation — `prune-tests` defers these rather than guessing |

## Prerequisites

Just Claude Code, to get the proposal. It reads your tests and proposes changes. It deletes nothing on its own. `--apply` edits or removes tests, so it requires a **clean git tree**. Afterward, it reruns the affected tests locally. It adds no network calls of its own.

## Worked example

Fixture: [`fixtures/prune-tests/`](../fixtures/prune-tests/) ([expected findings](../fixtures/prune-tests/expected-findings.md)).

```
/prune-tests fixtures/prune-tests/cart.spec.js
```

`cart.spec.js` carries four kinds of test debt, plus one test worth keeping. A correct plan sorts them into these groups:

- **Merge (high confidence)** — `adds two items` + `sums item prices`: identical behavior contract, identical preconditions, the same example, the same scenario class.
- **Rewrite (medium confidence)** — `applies tax`: this test over-mocks the internal `tax` collaborator. It only checks that `tax.rate()` was called, so it verifies the mock instead of the `withTax` math. Use a real, in-repo tax collaborator instead.
- **Rename or rewrite (high confidence)** — `returns cents as a formatted string`: the name and the Given/When/Then comment claim a `"$X.XX"` string contract, but the assertion checks `typeof === 'number'`. The test name no longer matches its own behavior.
- **Keep** — `empty cart totals zero`: a real boundary condition and a unique signal.

What the run does _not_ do: it does not claim that any test is confirmed false-confidence. That needs a mutation, so it hands off to [`audit-test`](./audit-test.md) instead. It also does not propose new tests for missing paths.

### Closing the loop: `--audit-evidence=<path>`

A `Deferred to audit-test` entry used to require manual follow-through: run `/audit-test`, read its verdict, then come back and re-classify the entry yourself. `--audit-evidence=<path>` reads a prior `/audit-test --emit-json=<path>` run and does that re-classification automatically.

Take a test the evidence names `confirmedHollow` — execution-confirmed: a mutation ran, and the test stayed green. `--audit-evidence` promotes that entry from `Deferred` to a new **Confirmed Prune (mutation-backed)** category — the highest confidence tier this skill carries. (`--digest` reports it **Confirmed**, not the usual `Likely`.) The promotion only happens by test identity named in the evidence, never by count alone. A `likelyHollow` or `baselineLock` verdict never promotes. A missing evidence file changes nothing. A schema mismatch is ignored, never guessed at. The result stays proposal-only, still gated behind `--apply`.

## It's Working If

- A test is never removed just because it looks redundant — when scenario equivalence is uncertain, the test stays.
- `--apply` runs only on a clean git tree, and even then only the high-confidence removes and merges apply automatically.
- Anything that looks like false confidence is handed to `audit-test` as Deferred, never pruned on a guess.
- A `confirmedHollow` entry from `--audit-evidence` promotes to Confirmed Prune only by test identity named in the evidence — never by count alone.

If `prune-tests` ever deletes a test without `--apply`, or promotes a Deferred entry to Confirmed without matching evidence identity, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does `--apply` delete every test in the plan?**
A: No. Even with `--apply` on a clean tree, only high-confidence removes and merges apply automatically. Medium-confidence rewrites and anything deferred to `audit-test` still need a human call.

**Q: What does `--audit-evidence=<path>` actually change?**
A: It reads a prior `/audit-test --emit-json=<path>` run and re-classifies any `Deferred` entry the evidence confirms as hollow (`confirmedHollow`) into a new Confirmed Prune (mutation-backed) category — by test identity, never by count. A `likelyHollow` or `baselineLock` verdict never promotes, and a missing or mismatched evidence file changes nothing.

**Q: Can prune-tests tell me a test is confirmed false-confidence?**
A: No — that needs a mutation. `prune-tests` hands that judgment to [`audit-test`](./audit-test.md) and lists the test as deferred instead.

## Where it fits

`prune-tests` is the suite-hygiene step, and the subtractive counterpart to [`coverage-review`](./coverage-review.md). It hands any "does this test actually catch a real break?" question to [`audit-test`](./audit-test.md), and it never adds tests itself. It is not part of the [`qa-pass`](./qa-pass.md) ship-gate chain. Use it when the suite feels slow or noisy, not at the merge gate.

## Anti-patterns

- **Deleting a weak-looking test that is the only guard of a real behavior.** When scenario equivalence is uncertain, keep the test. This is the whole conservative stance.
- **Merging across scenario classes.** Expected-use, edge, and failure cases do not consolidate just because their setup looks similar.
- **Manufacturing prunes to fill the template.** If the suite is already lean, say so and list only _Keep_.
- **Judging false confidence here.** Whether a test never verifies its code is [`audit-test`](./audit-test.md)'s call. List it as deferred. Do not prune it based on a guess.
