# debug-test — diagnose a failing Playwright test, no describing required

> **Agent instructions:** [`skills/debug-test/SKILL.md`](../skills/debug-test/SKILL.md) · **Run:** `/debug-test tests/my.spec.ts` (add `--flake` for flake mode)

## What it does

When a Playwright test fails, `debug-test` reads and runs it instead of asking you to describe it, applies fast QA heuristics (setup, assertion, code-logic angles), and routes what it can't resolve — locator/timing failures to the Playwright healer, logic failures to Matt Pocock's `diagnosing-bugs`. The quick wins — a missing `await`, a loose assertion, a fixture that never fires — it catches itself, with a root cause and a one-line fix.

Its **flake mode** (`--flake`) handles the special case most teams get wrong. Instead of `.skip()`-ing or deleting a flaky test — a silent capitulation that throws away the real signal it usually guards — it measures the flake rate with the framework's *own* burn mechanism, quarantines the test (non-blocking, never deleted), and routes the *suspected* cause to the skill that can confirm it.

## When to use it

- A `*.spec.ts` is red and you want it diagnosed and routed without writing up the problem first.
- A test fails intermittently and you want it quarantined with its signal preserved, not skipped and forgotten (`--flake`).

## When *not* to use it

- **The failure isn't Playwright** (Jest/Vitest/pytest) → invoke [`diagnosing-bugs`](https://github.com/mattpocock/skills) directly. debug-test is Playwright-scoped (flake mode also handles Cypress).
- **You want to file the failure for the team, not diagnose it** → [`bug-report`](./bug-report.md).
- **You want a teaching walkthrough** — debug-test is procedural and doesn't support `--explain`.

## Prerequisites

Unlike the rest of Sentinel (which needs only Claude Code), debug-test orchestrates external tooling:

- **Playwright** — required. The skill runs `npx playwright test` and is scoped to it.
- **Playwright agents** (`npx playwright init-agents`, once per repo) — optional. Enables the healer's locator/timing auto-heal; without them, those failures fall through to `diagnosing-bugs`.
- **Matt Pocock's `diagnosing-bugs` skill** — the terminal route for logic bugs. Without it, debug-test can triage but has nowhere to hand a deep diagnosis.

See the README's [Dependencies](../README.md#dependencies) table for install commands and what degrades when each is missing.

## Worked example

Fixture: [`fixtures/debug-test/`](../fixtures/debug-test/) ([expected findings](../fixtures/debug-test/expected-findings.md)).

```
/debug-test fixtures/debug-test/checkout.spec.ts
```

The test ends with an un-awaited web-first assertion:

```ts
expect(banner).toBeVisible(); // BUG: missing await
```

Playwright's web-first assertions are async and auto-retrying; without `await`, this returns a floating promise that never settles — an assertion that can never fail. debug-test catches it with its quick QA heuristics alone (a 🟢 High-confidence root cause plus the one-line fix, `await expect(banner).toBeVisible()`) and does *not* route to the healer or diagnosing-bugs, because the failure is neither a locator/timeout error nor a value mismatch.

## Where it fits

debug-test is the one skill that lives in **two** places in the [Sentinel flow](./ask-sentinel.md):

- **Standalone**, the moment a single spec goes red — diagnose and route the fix.
- **Inside the `/sentinel` chain** — the orchestrator runs it over any failing tests it finds on the branch before reaching a verdict.

That's what separates it from [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md), which sit deliberately *outside* the `/sentinel` chain. Downstream, a confirmed logic bug hands off to `diagnosing-bugs`; a flaky test it can't fix routes to [`qa-review`](./qa-review.md), [`audit-test`](./audit-test.md), or [`prune-tests`](./prune-tests.md) depending on the suspected cause.

## Anti-patterns

- **Describing the bug instead of pointing it at the test.** The whole premise is that it reads the file so you don't have to narrate.
- **Using it outside Playwright.** For other runners, `diagnosing-bugs` is the direct route.
- **`.skip()`-and-forget on a flaky test.** That discards a real signal; flake mode quarantines and routes instead. (Deletion *with* a confirmed cause is [`prune-tests`](./prune-tests.md)'s call.)
- **Treating a flake-mode cause as fact.** Detection and quarantine are reliable; the cause is a routed suggestion for a skill that can confirm it.
