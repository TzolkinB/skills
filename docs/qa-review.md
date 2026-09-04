# qa-review — is this code even testable?

> **Agent instructions:** [`skills/qa-review/SKILL.md`](../skills/qa-review/SKILL.md)
>
> **Run:** `/qa-review path/to/file.ts`

## What it does

`qa-review` is a code review from the QA angle. It asks different questions than a general review: Is this testable? Does it pass and fail with no code change — is it flaky? Are there hidden dependencies? Is it coupled to something with no mock? It scans for hard-coded dependencies and non-determinism, for example `Date.now()`, `Math.random()`, or an uncontrolled timer. It also scans for coupling that resists mocking, brittle assertions, and unclear contracts.

Testability is independent of code quality. Beautiful code is sometimes untestable. Ugly code is sometimes perfectly testable. This review catches a class of problem that a style or correctness review misses entirely. Untestable code signals that hidden dependencies and non-determinism sit baked into the code. The fix is usually the code, not the test.

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| During code review, before anyone writes tests, and you want untestable code caught while it's still cheap to change | **`/qa-review path/to/file.ts`** — this page |
| You suspect a module is flaky, or has no way to mock, and want that risk named before it ships | **`/qa-review`** |
| You want the consequence of wrong code in production | [`threat-model`](./threat-model.md) instead — `qa-review` does not rank blast radius (how much breaks if the code fails) |
| Tests already exist and you want the coverage gaps | [`coverage-review`](./coverage-review.md) instead |
| You want a general code-quality or style review | A different tool — `qa-review` only judges testability |

## Prerequisites

Only Claude Code. `qa-review` reads the code statically and runs nothing. Nothing to install. It adds no network calls of its own.

## Worked example

Fixture: [`fixtures/qa-review/`](../fixtures/qa-review/) ([expected findings](../fixtures/qa-review/expected-findings.md)).

```
/qa-review fixtures/qa-review/pricing.js
```

`pricing.js` is a pricing helper with many testability smells. A correct run groups the findings by category:

- **Testability:**
  - a hard-coded production URL with no way to inject a different one
  - `new Date().getHours()`, which drives a flash-sale branch and depends on the time
  - unseeded `Math.random()`
  - an inline `fetch(...)` with no way to stub it
  - an uncontrolled `setTimeout(..., 3000)`
- **Brittleness** — `body.includes('rate limit exceeded')`, a fragile match on an external message, and an unguarded `JSON.parse(body).surcharge`.
- **Coupling** — the function bundles the clock, the random-number generator, the network, and the timer together. It only runs with everything live, so no one unit-tests it in isolation.

A correct run does not rank the production impact of a wrong price. That consequence view belongs to [`threat-model`](./threat-model.md).

## It's Working If

- A finding never conflates code quality with testability — beautiful code can still get flagged, ugly code can still pass clean.
- Findings group by category (testability, brittleness, coupling) rather than a flat list.
- The review never ranks production impact or blast radius — that stays [`threat-model`](./threat-model.md)'s question.

If `qa-review` ever rates code quality or style, or ranks the production consequence of a finding, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Is testable code the same as good code?**
A: No — they're independent. Beautiful code is sometimes untestable, and ugly code is sometimes perfectly testable. `qa-review` catches a class of problem a style or correctness review misses entirely.

**Q: Does qa-review tell me how bad it would be if this code shipped broken?**
A: No — that's [`threat-model`](./threat-model.md)'s question. `qa-review` only judges whether the code is testable, not the consequence of it being wrong.

## Where it fits

`qa-review` sits in the while-reviewing step of the [QA flow](./qa-compass.md), before anyone writes tests. It catches untestable code while it is still cheap to fix, and it is part of the [`qa-pass`](./qa-pass.md) QA-synthesis chain. Its sibling [`threat-model`](./threat-model.md) asks the separate question of what breaks in production, and runs on its own.

## Anti-patterns

- **Using it as a general code-quality review.** Clean-code opinions belong elsewhere. `qa-review` answers exactly one question: is this testable?
- **Re-flagging blast radius.** Consequence-of-failure belongs to [`threat-model`](./threat-model.md). Mixing the two questions muddies both.
- **Treating it as a coverage check.** `qa-review` reads the shape of the code, not whether tests exercise it.
