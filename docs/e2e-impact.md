# e2e-impact — which E2E specs does this diff actually hit?

> **Agent instructions:** [`skills/e2e-impact/SKILL.md`](../skills/e2e-impact/SKILL.md) · **Run:** `/e2e-impact [base ref or diff]`

## What it does

Ordinary test-impact analysis walks the module graph: a changed file's imports point to the tests that would break. E2E specs break that trick — they drive a running app over a browser, so they never `import` the source they exercise, and the module graph mostly misses them. Teams end up re-running the whole suite on every change or guessing which specs matter. `e2e-impact` rebuilds the source→spec link from the signals a spec *does* leave behind: the **test-side modules** it imports (page objects, fixtures, helpers), the **routes** it visits or asserts by URL, and the **selectors / test-ids / text** it drives.

Each impacted spec carries a **confidence** (High/Medium/Low) — the trace is heuristic by design, so this is correctness-with-honest-gaps over false precision. Any changed file that reaches no spec through any signal lands in an explicit **run-all / unmapped** bucket rather than being silently dropped, and a change to a global (root layout, router table, shared primitive) goes to run-all too, because naming a false subset would be worse than admitting the blast radius is the whole suite.

## When to use it

- Before running E2E on a PR and you want the subset that plausibly matters instead of the whole suite.
- You want a defensible answer to "which specs does this change touch" for app-driven Playwright/Cypress tests, where the module graph can't tell you.

## When *not* to use it

- **You want to actually run or diagnose a spec** → [`debug-test`](./debug-test.md). This skill selects; it never executes.
- **You want to know if a *passing* spec would catch a real break** → [`audit-test`](./audit-test.md).
- **A spec is already red with no clear cause** → [`debug-test --drift`](./debug-test.md) consumes this skill's source→spec map, inverted, to check whether *any* changed file could plausibly reach it ([ADR-0018](./adr/0018-debug-test-drift-triage.md)).

## Prerequisites

Just Claude Code, plus a git repo with `main...HEAD` history to diff and a Playwright and/or Cypress suite to scan. It reads config and spec files; it never runs a spec and adds no network calls of its own.

## Worked example

`e2e-impact` needs a real repo with real E2E specs to trace against, so it uses **warm sibling fixtures** in `~/projects/` rather than a vendored one ([why](../fixtures/README.md)): [expected findings](../fixtures/e2e-impact/expected-findings.md).

Editing `app/routes/users/index.tsx` in epic-stack (Playwright) surfaces `tests/e2e/search.test.ts` at 🟢 **High** confidence on two converging signals: the spec reaches the route by *interaction* and asserts `page.waitForURL('/users?search=…')` rather than calling `goto`, and it asserts `getByText('Epic Notes Users')` — a literal rendered in the same changed file. In cypress-realworld-app, editing `SkeletonList.tsx` (which renders `data-test="list-skeleton"`) surfaces every spec using `getBySel('list-skeleton')` at High confidence — and the fixture also proves the substring case: a spec token like `accountNumber-input` matches the source's `data-test="bankaccount-accountNumber-input"` only because the trace reads `getBySelLike`/`[data-test*=…]` as a partial match, not an exact one.

## Where it fits

Sits *before* E2E execution — stage 1 of the [orchestration map](./orchestration-map.md), right where a PR decides what to run. Its output, the source→spec relevance map, is the same artifact [`debug-test --drift`](./debug-test.md) reads inverted: this skill asks "which specs does this diff hit," drift-mode asks "did *any* diff hit this already-red spec at all." Selection only — running and diagnosing stay with `debug-test`, and proving a selected spec isn't hollow stays with [`audit-test`](./audit-test.md).

## Anti-patterns

- **Treating Low confidence as a guarantee.** A Low match (generic text, a coincidental literal) is a lead worth including defensively, not proof the spec is affected.
- **Silently dropping an untraceable change.** Anything no signal reaches goes in run-all/unmapped — it's never just omitted.
- **Naming a false subset on a global change.** A root layout, router table, or shared primitive is run-all, not an enumerated guess at which specs it touches.
- **Running the spec yourself.** Selection stops here; execution and diagnosis are `debug-test`'s job.
