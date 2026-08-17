# coverage-review — finds what these tests miss

> **Agent instructions:** [`skills/coverage-review/SKILL.md`](../skills/coverage-review/SKILL.md)
>
> **Run:** `/coverage-review test.js code.js`

## What it does

`coverage-review` reads a test file against the code it covers. It asks the question a green suite never answers on its own: _what breaks that these tests do not catch?_ It flags untested paths, and untested error and boundary conditions. Most important, it flags loose assertions — assertions that pass even when the code is wrong.

When the project already produces coverage instrumentation (lcov, istanbul/c8, JaCoCo), coverage-review reads that as ground truth for _which lines ran_. Otherwise it infers coverage statically. Either way, the judgment layer stays the same. It is the part a coverage number never gives you: **a line that ran is not a line that someone checked.** A line at 100% coverage guarded by `toBeDefined()` is still a gap. coverage-review never _requires_ instrumentation — most AI-generated repos have none, and a hard setup barrier defeats the point.

## When to use it

- AI just wrote a batch of tests, and you need the _missing_ cases and the loose assertions.
- You want to know whether a green suite actually protects the behavior, or only makes assertions pass.
- You have real coverage output, and you want the judgment on top of the raw percentages.

## When _not_ to use it

- **Before code exists.** Use [`test-plan`](./test-plan.md) instead.
- **You want proof that a specific passing test fails when the code breaks.** Use [`audit-test`](./audit-test.md) instead. Coverage tells you a line ran; audit-test proves a test fails when the code breaks.
- **You want to cut redundant or stale tests.** Use [`prune-tests`](./prune-tests.md) instead — its subtractive counterpart.

## Prerequisites

coverage-review needs only Claude Code. It reads your test and code files, plus any coverage report the project already produces (lcov, istanbul/c8, JaCoCo). It never runs your suite to generate a report. With no report, it reasons statically instead. Nothing to install. It adds no network calls of its own.

## Worked example

Fixture: [`fixtures/coverage-review/`](../fixtures/coverage-review/) ([expected findings](../fixtures/coverage-review/expected-findings.md)).

```
/coverage-review fixtures/coverage-review/refund.spec.js fixtures/coverage-review/refund.js
```

`refund.js` is small but branchy — two guards, an already-refunded no-op, and a full-refund boundary at `remaining === 0`. The single test is green, but it only exercises the partial-refund happy path with two loose assertions:

```js
expect(result).toBeDefined(); // passes for any non-undefined return
expect(result.ok).toBeTruthy(); // never checks status or remaining
```

A correct run flags the two loose assertions. They pass even if the arithmetic is wrong. The run also flags the untested branches: `amount <= 0`, `amount > order.total`, the already-`refunded` no-op, and the full-refund boundary where `status` flips to `refunded`. Then it recommends the specific tests that close each gap. It also changes the two loose assertions into an **Escalate to audit-test** list — named candidates for a targeted mutation, not a verdict on them.

## Where it fits

coverage-review runs _after_ tests exist, paired with [`audit-test`](./audit-test.md). coverage-review finds what is untested or weakly asserted. audit-test proves whether an existing green test fails when the code breaks. Both feed the [`qa-pass`](./qa-pass.md) ship gate. Its subtractive mirror is [`prune-tests`](./prune-tests.md), which cuts tests rather than adding them.

## Anti-patterns

- **Reading a coverage percentage as proof.** 100% line coverage with a loose assertion protects nothing. Running a line does not mean anyone verified it.
- **Blocking on instrumentation.** With no coverage output, coverage-review reasons statically. It never demands that you set up a coverage tool first.
- **Straying into deletion or mutation.** Missing coverage is additive work. Judging whether an _existing_ test bites belongs to [`audit-test`](./audit-test.md). Trimming the suite belongs to [`prune-tests`](./prune-tests.md).
