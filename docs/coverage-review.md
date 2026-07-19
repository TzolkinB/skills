# coverage-review — what could break that these tests wouldn't catch?

> **Agent instructions:** [`skills/coverage-review/SKILL.md`](../skills/coverage-review/SKILL.md) · **Run:** `/coverage-review test.js code.js`

## What it does

`coverage-review` reads a test file against the code it covers and asks the question a green suite can't answer for itself: *what could break that these tests wouldn't catch?* It flags untested paths, untested error and boundary conditions, and — crucially — assertions too loose to fail.

When the project already produces coverage instrumentation (lcov, istanbul/c8, JaCoCo), it reads that as ground truth for *which lines ran*; otherwise it infers coverage statically. Either way, the judgment layer is the same and it's the part a coverage number can't give you: **a line that executed is not a line that was verified.** A line at 100% coverage guarded by `toBeDefined()` is still a gap. It never *requires* instrumentation — most AI-generated repos have none, and blocking on setup would defeat the point.

## When to use it

- AI just wrote a batch of tests and you need the *missing* cases and the loose assertions.
- You want to know whether a green suite actually protects the behavior or merely makes assertions pass.
- You have real coverage output and want the judgment on top of the raw percentages.

## When *not* to use it

- **Before code exists** → [`test-plan`](./test-plan.md).
- **You want to prove a specific passing test would fail if the code broke** → [`audit-test`](./audit-test.md). Coverage tells you a line ran; audit-test proves a test bites.
- **You want to cut redundant or stale tests** → [`prune-tests`](./prune-tests.md), its subtractive counterpart.

## Prerequisites

Just Claude Code. It reads your test and code files, plus any coverage report the project already produces (lcov, istanbul/c8, JaCoCo) — it never runs your suite to generate one, and no report just means it reasons statically instead. Nothing to install, and it adds no network calls of its own.

## Worked example

Fixture: [`fixtures/coverage-review/`](../fixtures/coverage-review/) ([expected findings](../fixtures/coverage-review/expected-findings.md)).

```
/coverage-review fixtures/coverage-review/refund.spec.js fixtures/coverage-review/refund.js
```

`refund.js` is small but branchy — two guards, an already-refunded no-op, and a full-refund boundary at `remaining === 0`. The single test is green, but it only exercises the partial-refund happy path with two loose assertions:

```js
expect(result).toBeDefined();   // passes for any non-undefined return
expect(result.ok).toBeTruthy(); // never checks status or remaining
```

A correct run flags the loose assertions (they'd pass even if the arithmetic were wrong) and the untested branches: `amount <= 0`, `amount > order.total`, the already-`refunded` no-op, and the full-refund boundary where `status` flips to `refunded`. Then it recommends the specific tests that would close each gap.

## Where it fits

Runs *after* tests exist, paired with [`audit-test`](./audit-test.md): coverage-review finds what's untested or loosely asserted, audit-test proves whether an existing green test would fail if the code broke. Both feed the [`sentinel`](./sentinel.md) ship gate. Its subtractive mirror is [`prune-tests`](./prune-tests.md), which cuts tests rather than adding them.

## Anti-patterns

- **Reading a coverage percentage as proof.** 100% line coverage with a loose assertion protects nothing — executed ≠ verified.
- **Blocking on instrumentation.** If there's no coverage output, it reasons statically; it never demands you set up a coverage tool first.
- **Straying into deletion or mutation.** Missing coverage is additive work; judging whether an *existing* test bites belongs to [`audit-test`](./audit-test.md), and trimming the suite belongs to [`prune-tests`](./prune-tests.md).
