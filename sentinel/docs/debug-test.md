# debug-test — diagnose a failing Playwright test, no describing required

> **Agent instructions:** [`skills/debug-test/SKILL.md`](../skills/debug-test/SKILL.md) · **Run:** `/debug-test tests/my.spec.ts` (add `--flake` for flake mode)

## What it does

When a Playwright test fails, `debug-test` reads it instead of asking you to describe it. It runs the test, applies fast QA heuristics (setup, assertion, code-logic angles), and routes what it can't resolve: locator and timing failures go to the Playwright healer, logic failures go to Matt Pocock's `diagnosing-bugs` skill. Most quick wins — a missing `await`, a loose assertion, a fixture that never fires — it catches itself, with a root cause and a fix.

It also has a **flake mode** (`--flake`). Most teams `.skip()` or delete a flaky test — a silent capitulation that throws away real signal, because the flaky test usually guards real behavior. debug-test instead detects the flake rate using the framework's *own* burn mechanism, quarantines the test (non-blocking, never deleted), and routes the *suspected* cause to the skill that can confirm it — always as a lead, never as a verdict.

It's scoped to Playwright (flake mode also handles Cypress). For Jest/Vitest/pytest failures, invoke `diagnosing-bugs` directly.

## When to use it

- A `*.spec.ts` is red and you want it diagnosed and routed without writing up the problem first.
- A test is intermittently failing and you want it quarantined with its signal preserved, not skipped and forgotten.

## When *not* to use it

- **The failure isn't Playwright** (Jest/Vitest/pytest) → invoke [`diagnosing-bugs`](https://github.com/mattpocock/skills) directly.
- **You want to file the failure for the team, not diagnose it** → [`bug-report`](./bug-report.md).
- **You want a teaching walkthrough** — debug-test is procedural and doesn't support `--explain`.

It also depends on external tooling: Playwright itself, optionally the Playwright agents for auto-heal, and `diagnosing-bugs` for logic diagnosis (see the README's *Dependencies*).

## Worked example

Fixture: [`fixtures/debug-test/`](../fixtures/debug-test/) ([expected findings](../fixtures/debug-test/expected-findings.md)).

```
/debug-test sentinel/fixtures/debug-test/checkout.spec.ts
```

The test ends with an un-awaited web-first assertion:

```ts
expect(banner).toBeVisible(); // BUG: missing await
```

Playwright's web-first assertions are async and auto-retrying; without `await`, this returns a floating promise that never settles — an assertion that can never fail. debug-test catches it with its quick QA heuristics alone — a 🟢 High-confidence root cause and the one-line fix (`await expect(banner).toBeVisible()`) — and does *not* route to the healer or diagnosing-bugs, because the failure is neither a locator/timeout error nor a value mismatch.

## Anti-patterns

- **Describing the bug instead of pointing it at the test.** The whole premise is that it reads the file so you don't have to narrate.
- **Using it outside Playwright.** For other runners, `diagnosing-bugs` is the direct route.
- **`.skip()`-and-forget on a flaky test.** That discards a real signal; flake mode quarantines and routes instead. (Deletion *with* a confirmed cause is [`prune-tests`](./prune-tests.md)'s call, not a disposition you reach for here.)
- **Treating a flake-mode cause as fact.** Detection and quarantine are reliable; the cause is a routed suggestion for a skill that can confirm it.
