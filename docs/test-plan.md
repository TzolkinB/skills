# test-plan — define what to test, before the code exists

> **Agent instructions:** [`skills/test-plan/SKILL.md`](../skills/test-plan/SKILL.md) · **Run:** `/test-plan "feature description"`

## What it does

`test-plan` turns a feature description or a ticket into a plan you write before the code. The plan is a contract: "this behavior will work this way." It breaks the feature into acceptance criteria, a happy path, edge cases, unhappy paths, and preconditions. It assigns every case the cheapest test layer that still proves it: `unit`, `component`, `integration`, or `e2e`.

Its value is that it forces a definition of *done and correct* up front, when disagreement is cheap. The alternative is reverse-engineering that definition from whatever tests the code happens to make green. `test-plan` sits at the front of the QA flow. The other skills judge tests that already exist. This skill decides what those tests need to be.

## When to use it

- You are about to build a feature, and want the cases and their layers before writing a line of code.
- You want the edge and unhappy paths named explicitly, not just the happy one.
- You add these skills to an existing repository, and want upcoming work planned with layer recommendations (see the README's *Existing Project Bootstrap* section).

## When *not* to use it

- **Tests already exist and you want the gaps** → [`coverage-review`](./coverage-review.md).
- **You want to know whether a passing test protects anything** → [`audit-test`](./audit-test.md).
- **You want the production-risk view of a change** → [`threat-model`](./threat-model.md).

`test-plan` reads a *description*, not code. Once the code and tests exist, it is the wrong tool.

## Prerequisites

Just Claude Code. `test-plan` reads the feature description you give it, and writes a plan. It runs no code. It needs nothing installed. It adds no network calls of its own.

## Worked example

`test-plan` reads a feature description, not a source file, so it has no code fixture ([why](../fixtures/README.md)). Given this input:

```
/test-plan "Users can book a room from 9am-5pm, no overlaps allowed"
```

a good plan names the acceptance criteria first, then spreads cases across layers instead of piling every case into one:

- **Happy path** — `e2e`: user submits a booking and sees confirmation. `integration`: the write persists the expected fields.
- **Edge cases** — `integration`: the overlap constraint rejects a double-booking *at the minute boundary*. `unit`: the time-range guard rejects end-before-start. `component`: empty input shows inline validation.
- **Unhappy paths** — `integration`: permission denied returns the authz contract. `e2e`: network failure surfaces retry guidance.
- **Preconditions** — user logged in, seed data present.

The tell of a good plan is that the boundary and rejection cases appear *before* anyone writes code to handle them.

## Where it fits

`test-plan` sits at the front of the [QA flow](./qa-compass.md). It runs before any code or tests exist. The per-case layer labels it produces are what [`qa-pass`](./qa-pass.md) later aggregates into a branch's layer-distribution snapshot. Once the tests are written, hand off to [`coverage-review`](./coverage-review.md) for the gaps, and to [`audit-test`](./audit-test.md) for whether the passing tests actually catch real bugs.

## Anti-patterns

- **Writing the plan after the code**, to rationalize the tests that already pass. The plan then describes the implementation, not the contract.
- **Restating the happy path three ways**, with no edge or unhappy cases. A plan with no way to fail is not a plan.
- **Layer inflation** — marking every case `e2e`. If a case still passes with the browser swapped for an API client, move it to `integration` or below.
