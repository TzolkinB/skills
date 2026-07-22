# prune-tests — which tests cost more than they protect?

> **Agent instructions:** [`skills/prune-tests/SKILL.md`](../skills/prune-tests/SKILL.md) · **Run:** `/prune-tests tests/` (add `--apply` to act)

## What it does

`prune-tests` asks the suite-level question its siblings don't: **which existing tests cost more than they protect?** — and proposes removing, merging, or rewriting them. Test suites accumulate debt the way architecture does, and AI-assisted development is especially prone to it: redundant paths, assertions that can't fail, over-mocking that only verifies the mocks, and tests drifted out of sync with the code they name.

It's the **subtractive** counterpart to [`coverage-review`](./coverage-review.md), and it's deliberately **conservative**: it proposes a categorized plan, deletes nothing by default, and keeps when uncertain — matching setup is not matching meaning. It does *not* re-derive whether a test protects its behavior; that's [`audit-test`](./audit-test.md)'s job, so anything that smells like false confidence is handed off, not judged here.

## When to use it

- The suite feels slow or noisy and you suspect tests that add cost without adding confidence.
- AI generated a pile of tests and you want the redundant, over-mocked, and stale ones surfaced.
- You want a safe, reviewable prune plan — and, with `--apply` on a clean tree, the conservative removals actually applied.

## When *not* to use it

- **You want the *missing* tests** → [`coverage-review`](./coverage-review.md). prune-tests never adds tests.
- **A test looks like it never verifies its code** → [`audit-test`](./audit-test.md), which proves it by mutation. prune-tests defers these rather than guessing.
- **You want it to just delete things.** It won't, without `--apply` on a clean git tree, and even then only high-confidence removes/merges act automatically.

## Prerequisites

Just Claude Code to get the proposal — it reads your tests and proposes, deleting nothing. `--apply` edits or removes tests, so it requires a **clean git tree** and reruns the affected tests locally afterward. It adds no network calls of its own.

## Worked example

Fixture: [`fixtures/prune-tests/`](../fixtures/prune-tests/) ([expected findings](../fixtures/prune-tests/expected-findings.md)).

```
/prune-tests fixtures/prune-tests/cart.spec.js
```

`cart.spec.js` carries four kinds of debt plus one keeper, and a correct plan sorts them:

- **Merge (high)** — `adds two items` + `sums item prices`: identical behavior contract and preconditions, same example, same scenario class.
- **Rewrite (medium)** — `applies tax`: over-mocks the *internal* `tax` collaborator and only asserts `tax.rate()` was called, so it verifies the mock instead of the `withTax` math. Use a real, in-repo tax collaborator.
- **Rename/rewrite (high)** — `returns cents as a formatted string`: the name and Given/When/Then comment claim a `"$X.XX"` string contract, but the assertion checks `typeof === 'number'`. The name is now a lie.
- **Keep** — `empty cart totals zero`: a real boundary condition and unique signal.

What the run does *not* do: it won't claim any test is confirmed false-confidence (that needs a mutation — hand off to [`audit-test`](./audit-test.md)) and it won't propose new tests for missing paths.

## Where it fits

The suite-hygiene step, and the subtractive counterpart to [`coverage-review`](./coverage-review.md). It hands any "does this test actually bite?" question to [`audit-test`](./audit-test.md) and never adds tests itself. It's *not* part of the [`sentinel`](./sentinel.md) ship-gate chain — reach for it when the suite feels slow or noisy, not at the merge gate.

## Anti-patterns

- **Deleting a weak-looking test that's the only guard of a real behavior.** When scenario equivalence is uncertain, keep — that's the whole conservative stance.
- **Merging across scenario classes.** Expected-use, edge, and failure cases don't consolidate just because their setup looks similar.
- **Manufacturing prunes to fill the template.** If the suite is already lean, say so and list only *Keep*.
- **Judging false confidence here.** A test that never verifies its code is [`audit-test`](./audit-test.md)'s call; list it as deferred, don't prune it on a hunch.
