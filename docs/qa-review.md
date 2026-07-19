# qa-review — is this code even testable?

> **Agent instructions:** [`skills/qa-review/SKILL.md`](../skills/qa-review/SKILL.md) · **Run:** `/qa-review path/to/file.ts`

## What it does

`qa-review` is a code review from the QA angle, and it asks different questions than a general one: *Can I test this? Will it be flaky? Are there hidden dependencies? Is it coupled to something I can't mock?* It scans for hard-coded dependencies, non-determinism (`Date.now()`, `Math.random()`, uncontrolled timers), coupling that resists mocking, brittle assertions, and unclear contracts.

The point is that testability is orthogonal to code quality. Beautiful code can be untestable and ugly code can be perfectly testable — so this review catches a class of problem a style or correctness review sails right past. Untestable code is a signal that hidden dependencies and non-determinism are baked in; the fix is usually the code, not the test.

## When to use it

- Mid code-review, before tests are written, to catch untestable code while it's still cheap to change.
- You suspect a module will be flaky or impossible to mock and want that named before it ships.

## When *not* to use it

- **You want the consequence if the code is wrong in production** → [`threat-model`](./threat-model.md). qa-review deliberately does *not* rank blast radius.
- **Tests already exist and you want the coverage gaps** → [`coverage-review`](./coverage-review.md).
- **You want a general code-quality or style review** — that's a different tool; qa-review only judges testability.

## Prerequisites

Just Claude Code — `qa-review` reads the code statically and runs nothing. Nothing to install, and it adds no network calls of its own.

## Worked example

Fixture: [`fixtures/qa-review/`](../fixtures/qa-review/) ([expected findings](../fixtures/qa-review/expected-findings.md)).

```
/qa-review fixtures/qa-review/pricing.js
```

`pricing.js` is a plausible pricing helper riddled with testability smells. A correct run groups them by category:

- **Testability** — a hard-coded prod URL with no injection, `new Date().getHours()` driving a flash-sale branch (time-dependent), unseeded `Math.random()`, an inline `fetch(...)` that can't be stubbed, and an uncontrolled `setTimeout(..., 3000)`.
- **Brittleness** — `body.includes('rate limit exceeded')` (a fragile match on an external message) and an unguarded `JSON.parse(body).surcharge`.
- **Coupling** — the function bundles clock, RNG, network, and timer together, so it can only run with the whole world live; it can't be unit-tested in isolation.

Note what a correct run does *not* do: it doesn't rank the production impact of a mispricing — that consequence view is [`threat-model`](./threat-model.md)'s job.

## Where it fits

Sits in the *while-reviewing* slot of the [Sentinel flow](./ask-sentinel.md) — before tests are written, catching untestable code while it's cheap to fix — and it's part of the [`sentinel`](./sentinel.md) shippability chain. Its consequence-focused sibling [`threat-model`](./threat-model.md) asks the orthogonal "what breaks in production" question and runs on its own.

## Anti-patterns

- **Using it as a general code-quality review.** Clean-code opinions belong elsewhere; qa-review answers exactly one question: can this be tested?
- **Re-flagging blast radius.** Consequence-of-failure is [`threat-model`](./threat-model.md); mixing them muddies both.
- **Treating it as a coverage check.** It reads the code's *shape*, not whether tests exercise it.
