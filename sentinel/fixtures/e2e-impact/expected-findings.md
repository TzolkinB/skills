# Expected findings — e2e-impact

`e2e-impact` maps a diff → impacted specs, so it needs a *real repo with E2E specs*. The targets
are the verified warm fixtures (siblings in `~/projects/`, not vendored). Both cases below were
traced by hand to confirm the signals resolve to real source.

## Case P — Playwright (epic-stack)
Simulated change: edit `app/routes/users/index.tsx` (the users search route).
Run: `/e2e-impact` (diff includes that file)
- **Impacted:** `tests/e2e/search.test.ts` — 🟢 **High** · two signals converge:
  - **route** — the spec reaches the users route by *interaction* and asserts `page.waitForURL('/users?search=…')` (never calling `goto`), and `app/routes/users/index.tsx` implements that route — so the route signal must read URL waits/assertions, not just `goto`/`visit`;
  - **text** — the spec asserts `getByText('Epic Notes Users')`, and that literal is rendered in the same file.
- **High on all specs** if the change is to `tests/playwright-utils.ts` — every spec `import`s it (test-side import signal).

## Case C — Cypress (cypress-realworld-app)
Simulated change: edit `src/components/SkeletonList.tsx`.
Run: `/e2e-impact` (diff includes that file)
- **Impacted:** any spec using `getBySel('list-skeleton')` — 🟢 **High** · `SkeletonList.tsx` renders
  `data-test="list-skeleton"`, matched exactly against the spec's selector.
- **Custom-command + substring nuance (validated):** this repo's `getBySel` maps to `[data-test=…]` and
  `getBySelLike` to `[data-test*=…]` (a substring match). A spec token like `accountNumber-input` is a
  *substring* of the source's `data-test="bankaccount-accountNumber-input"` — so the selector signal must
  read `cypress/support` for the custom commands and grep partial-match selectors as substrings.
- **Route:** `auth.spec.ts` visits `/personal` and `/` → a change to those route sources is Medium-impact.

## Boundary notes (what it must NOT do)
- **Never silently drop a changed file** — anything untraceable goes in the **run-all / unmapped** bucket.
- **Global changes → run-all**, not a false subset (root layout, router table, shared primitive).
- **Selection, not execution** — it never runs a spec; running/diagnosing is `/debug-test`.
- **Emit the source→spec map** so `/debug-test --drift` can read it inverted (ADR-0018).
