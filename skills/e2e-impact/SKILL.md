---
name: e2e-impact
description: Map a working/PR diff to the Playwright/Cypress E2E specs it plausibly hits — via test-import, route, and selector/test-id signals — with a confidence per spec and an honest run-all fallback when a change can't be traced. Emits a source→spec relevance map.
argument-hint: "[base ref or diff — defaults to main...HEAD plus the working tree]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
---

**Owns:** which E2E specs a diff plausibly exercises — the app-driven test-impact map. **Selection, not execution.**
**Not this:** running or diagnosing a spec → `/debug-test`; whether a *passing* spec guards anything → `/audit-test`; classifying an already-red spec as external drift → `/debug-test --drift` (which reads *this* map inverted).

E2E specs drive the app over a browser, so — unlike unit tests — **they don't import the source they exercise.** The module graph that powers ordinary test-impact-analysis mostly misses them, so teams re-run the whole suite or guess. This skill rebuilds the source→spec link from the signals an E2E spec *does* leave: the **test-side modules** it imports, the **routes** it visits, and the **selectors / test-ids / text** it drives. Each impacted spec carries a **confidence** — the trace is heuristic by design, so this is *correctness-with-honest-gaps over false precision* — and any changed file it can't trace lands in an explicit **run-all / unmapped** bucket, **never silently dropped.** The map it emits is the same artifact `/debug-test --drift` reads inverted ([ADR-0018](../../docs/adr/0018-debug-test-drift-triage.md)): forward = "which specs does this diff hit"; backward = "did *any* diff hit this red spec at all" (the drift signature).

## Steps

### 1. Resolve the diff
Changed files = `git diff --name-only main...HEAD` **plus** the working tree (`git status --porcelain`). $ARGUMENTS may override the base ref. Split the changed files into:
- **source** — app code (components, routes, handlers, styles);
- **test-side** — specs, page objects, fixtures, helpers (these give the strongest signal).

### 2. Discover specs + framework
- **Playwright** — `Glob **/*.spec.{ts,js}` under `tests/`/`e2e/`, `@playwright/test` imports, `playwright.config.*`.
- **Cypress** — `Glob **/*.cy.{ts,js}`, a `cypress/e2e/` dir, `cypress.config.*`.
- Note which framework(s) are present; the signals below apply to both (only the selector/visit syntax differs).

### 3. Build the relevance map — union the signals, strongest first
A spec can match on several signals; confidence is the **strongest** that selected it, and every reason is listed.

| Signal | Trace it by | Confidence |
|---|---|---|
| **Test-side import** — a changed page-object / fixture / helper | grep specs for an `import … from '<changed test module>'` | **High** — a direct dependency |
| **Test-id / data-attr** — a changed file renders a `data-testid`/`data-test` a spec drives | pull the id from specs — `getByTestId('x')`, `[data-testid=x]`, `cy.get('[data-testid=x]')`, **and project custom commands** (`cy.getBySel('x')`→`[data-test=x]`; grep `cypress/support` to learn them) — then grep changed files for `x`. For **partial-match** selectors (`getBySelLike`, `[data-test*=…]`, regex) grep as a **substring**, not exact | **High** if the id is unique; **Medium** if it's a substring that matches many attrs |
| **Route** — a changed file implements a path a spec visits | derive the URL from the changed file (file-based routing: `app/routes/checkout.tsx`→`/checkout`; `pages/`; `src/routes/`; or a router config) → match specs' `page.goto('/checkout')` / `cy.visit('/checkout')`, **URL assertions/waits** (`page.waitForURL('…/checkout')`, `cy.url().should('include','/checkout')` — a spec often reaches a route by *interaction* and asserts the URL, never calling goto/visit), and in-app link navigations | **Medium** |
| **Role+name / text** — a changed file renders a label a spec targets | pull `getByRole(..,{name:'Pay'})` / `getByText('Pay')` / `cy.contains('Pay')`; grep changed files for the literal | **Medium** if specific, **Low** if generic |
| **API / endpoint** — a changed handler under a path a spec intercepts or asserts | pull `page.route('/api/x')` / `cy.intercept('/api/x')`; map to changed files under that route | **Medium** |
| **Global** — a changed router table, root layout, provider, or design-system primitive | — | **run-all** (broad blast radius; don't enumerate a false subset) |

### 4. Emit impacted specs + the unmapped bucket
- A changed source file with **no** signal reaching a spec → the **run-all / unmapped** bucket. A change to a **global** (root layout, router, shared primitive) → also run-all, because its blast radius is the whole suite and naming a subset would be false precision.
- Emit the impacted-spec set (each with reason(s) + confidence), the run-all/unmapped bucket, **and** the source→spec relevance map (for drift-mode to invert).

## Output Format

```
## e2e-impact: [N changed source files · Playwright | Cypress | both]

### Impacted specs — run these
- **checkout.spec.ts** — 🟢 High · imports changed `page-objects/checkout.ts`; drives `data-testid="pay-now"` (changed in `Pay.tsx`)
- **login.spec.ts** — 🟡 Medium · visits `/login` (changed `app/routes/login.tsx`)
- **search.spec.ts** — 🟠 Low · text "Results" also appears in changed `List.tsx` — could be coincidental; included defensively

### Run-all / unmapped — don't skip these
- `app/root.tsx` — global layout, blast radius = whole suite → run the full E2E suite
- `utils/format.ts` — no route/selector/import signal reached a spec → include defensively, or confirm it's render-invisible

### Source→spec relevance map  (for /debug-test --drift, read inverted)
Pay.tsx               → checkout.spec.ts (High)
app/routes/login.tsx  → login.spec.ts (Medium)
app/root.tsx          → (run-all — reaches every spec)
utils/format.ts       → (unmapped — reaches every spec, run defensively)
```

`run-all` and `unmapped` entries are **edges to every spec**, not absent edges — the inverse-consumer must treat them that way (see the drift-mode note).

## Notes

- **v0 is heuristic, and says so.** E2E has no reliable static source→spec edge — the app boundary is a black box to the module graph — so this unions app-surface signals and **labels confidence** rather than claiming precision. A Low match is a lead, not a guarantee; an unmapped change is run-all, never dropped. Per-test E2E coverage instrumentation (Playwright/Istanbul) would upgrade this from *heuristic* to *measured* — a scoped follow-up, not v0.
- **Shared artifact with drift-mode.** The source→spec map is exactly what `/debug-test --drift` consumes inverted ([ADR-0018](../../docs/adr/0018-debug-test-drift-triage.md)): forward it selects impacted specs; backward, an already-red spec that **no** changed file maps to is the external-drift signature. **Invert safely:** a `run-all`/`unmapped`/global change reaches *every* spec, so the inverse must **union the map's direct edges with the run-all bucket** — a red spec is a drift candidate only when *no* direct edge **and** *no* run-all/unmapped change in the diff could reach it; otherwise a globally-affected red would be misread as external drift. One build, both directions — whichever ships first subsidizes the other.
- **Selection, not execution.** It never runs a spec; it names the set to run (or hands off). Running/diagnosing → `/debug-test`; proving a green spec → `/audit-test`.
- `--explain` is not supported — procedural, not pedagogical.
