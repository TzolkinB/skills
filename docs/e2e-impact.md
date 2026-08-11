# e2e-impact — which E2E specs does this diff hit?

> **Agent instructions:** [`skills/e2e-impact/SKILL.md`](../skills/e2e-impact/SKILL.md) · **Run:** `/e2e-impact [base ref or diff]`

## What it does

Ordinary test-impact analysis walks the module graph. A changed file's imports point to the tests it breaks. E2E specs work differently. They drive a running app in a browser. They never `import` the source code they test. The module graph misses most of them. Teams then re-run the whole suite on every change, or guess which specs matter.

`e2e-impact` rebuilds the source-to-spec link from the signals a spec leaves behind. It reads three kinds of signal. A spec imports **test-side modules** — page objects, fixtures, helpers. A spec visits or checks a **route** by URL. A spec drives a **selector, test ID, or text** string.

Each impacted spec carries a **confidence** label: High, Medium, or Low. The trace method is heuristic by design. It states honest gaps instead of a false, precise answer.

If a changed file reaches no spec through any signal, it lands in an explicit **run-all / unmapped** bucket. The tool never drops it silently. A change to a global file — a root layout, a router table, a shared primitive — also goes to run-all. A false, narrow list is worse than an honest statement that the blast radius is the whole suite.

## When to use it

- You want to run E2E on a PR, and want only the subset that plausibly matters — not the whole suite.
- You want a defensible answer to "which specs does this change touch," for app-driven Playwright/Cypress tests. The module graph gives no answer here.

## When *not* to use it

- **You want to run or diagnose a spec** → [`debug-test`](./debug-test.md). This skill only selects. It does not run tests.
- **You want to know if a *passing* spec catches a real break** → [`audit-test`](./audit-test.md).
- **A spec is already red with no clear cause** → [`debug-test --drift`](./debug-test.md) reads this skill's source-to-spec map, inverted. It checks whether any changed file plausibly reaches it ([ADR-0018](./adr/0018-debug-test-drift-triage.md)).

## Prerequisites

Just Claude Code, plus a git repo with `main...HEAD` history, and a Playwright and/or Cypress suite to scan. It reads config files and spec files. It never runs a spec. It adds no network calls of its own.

## Worked example

`e2e-impact` needs a real repo with real E2E specs to trace against. It uses **warm sibling fixtures** in `~/projects/` instead of a vendored one ([why](../fixtures/README.md)). See the [expected findings](../fixtures/e2e-impact/expected-findings.md).

Editing `app/routes/users/index.tsx` in epic-stack (Playwright) surfaces `tests/e2e/search.test.ts` at 🟢 **High** confidence. Two signals converge. The spec reaches the route by interaction and asserts `page.waitForURL('/users?search=…')` instead of calling `goto`. The spec also asserts `getByText('Epic Notes Users')` — a literal text string rendered in the same changed file.

In cypress-realworld-app, editing `SkeletonList.tsx` — which renders `data-test="list-skeleton"` — surfaces every spec that uses `getBySel('list-skeleton')`, at High confidence. The fixture also proves the substring case. A spec token like `accountNumber-input` matches the source's `data-test="bankaccount-accountNumber-input"`. This match happens because the trace reads `getBySelLike`/`[data-test*=…]` as a partial match, not an exact one.

## Where it fits

This skill sits before E2E execution — stage 1 of the [orchestration map](./orchestration-map.md), at the point where a PR decides what to run. Its output is the source-to-spec relevance map. [`debug-test --drift`](./debug-test.md) reads this same map, inverted. This skill asks: which specs does this diff hit? Drift mode asks: did any diff hit this already-red spec at all?

This skill only selects specs. Running and diagnosing stay with `debug-test`. Proving that a selected spec catches a real break stays with [`audit-test`](./audit-test.md).

## Anti-patterns

- **Treating a Low-confidence match as a guarantee.** A Low match — generic text, a coincidental literal — is a lead worth including defensively. It is not proof that the spec is affected.
- **Silently dropping an untraceable change.** Anything no signal reaches goes in the run-all/unmapped bucket. It is never simply omitted.
- **Naming a false subset on a global change.** A root layout, router table, or shared primitive is run-all. It is not an enumerated guess at which specs it touches.
- **Running the spec yourself.** Selection stops here. Execution and diagnosis are `debug-test`'s job.
