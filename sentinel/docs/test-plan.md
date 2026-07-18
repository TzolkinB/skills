# test-plan — define what to test, before the code exists

> **Agent instructions:** [`skills/test-plan/SKILL.md`](../skills/test-plan/SKILL.md) · **Run:** `/test-plan "feature description"`

## What it does

`test-plan` turns a feature description or ticket into a plan you write *before* the code — a contract that says "this behavior will work this way." It breaks the feature into acceptance criteria, a happy path, edge cases, unhappy paths, and preconditions, and it assigns every case the cheapest test layer that still proves it (`unit` / `component` / `integration` / `e2e`).

Its value is that it forces the definition of *done and correct* up front, when it's cheap to disagree, instead of reverse-engineering it from whatever tests the code happened to make green. It's the front of the Sentinel flow: the other skills judge tests that already exist; this one decides what those tests should be.

## When to use it

- You're about to build a feature and want the cases and their layers before writing a line.
- You want the edge and unhappy paths named explicitly, not just the happy one.
- You're bootstrapping Sentinel on an existing repo and want upcoming work planned with layer recommendations (see the README's *Existing Project Bootstrap*).

## When *not* to use it

- **Tests already exist and you want the gaps** → [`coverage-review`](./coverage-review.md).
- **You want to know whether a passing test actually protects anything** → [`audit-test`](./audit-test.md).
- **You want the production-risk view of a change** → [`threat-model`](./threat-model.md).

It reads a *description*, not code — so it's the wrong tool once the code and tests are in front of you.

## Prerequisites

Just Claude Code. `test-plan` reads the feature description you give it and writes a plan — it runs no code, needs nothing installed, and adds no network calls of its own.

## Worked example

`test-plan` consumes a feature description rather than a source file, so it has no code fixture ([why](../fixtures/README.md)). Given:

```
/test-plan "Users can book a room from 9am-5pm, no overlaps allowed"
```

a good plan names the acceptance criteria and then spreads cases across layers instead of piling everything into one:

- **Happy path** — `e2e` user submits a booking and sees confirmation; `integration` the write persists the expected fields.
- **Edge cases** — `integration` overlap constraint rejects a double-booking *at the minute boundary*; `unit` the time-range guard rejects end-before-start; `component` empty input shows inline validation.
- **Unhappy paths** — `integration` permission denied returns the authz contract; `e2e` network failure surfaces retry guidance.
- **Preconditions** — user logged in, seed data present.

The tell of a good plan is that the boundary and rejection cases appear *before* anyone writes code to handle them.

## Where it fits

The front of the [Sentinel flow](./ask-sentinel.md) — it runs *before* any code or tests exist. The per-case layer labels it produces are what [`sentinel`](./sentinel.md) later aggregates into a branch's layer-distribution snapshot. Once the tests are written, hand off to [`coverage-review`](./coverage-review.md) for what's missing and [`audit-test`](./audit-test.md) for whether the green tests actually bite.

## Anti-patterns

- **Writing the plan after the code** to rationalize the tests that already pass — the plan then describes the implementation instead of the contract.
- **Restating the happy path three ways** with no edge or unhappy cases; a plan with no way to fail isn't a plan.
- **Layer inflation** — marking every case `e2e`. If a case would still pass with the browser swapped for an API client, it belongs at `integration` or below.
