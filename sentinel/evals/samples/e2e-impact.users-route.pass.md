<!-- RECORDED SAMPLE — a faithful /e2e-impact run on the epic-stack Playwright fixture (Case P).
     Simulated change: app/routes/users/index.tsx (the users search route). The impacted spec
     tests/e2e/search.test.ts never calls goto — it reaches the users route by interaction and
     asserts page.waitForURL('/users?search=…') and getByText('Epic Notes Users'), both rendered
     by the changed file → 🟢 High on two converging signals. Used by run-eval.mjs --dry-run
     offline; a representative transcript, not a live capture. Deliberately does NOT run/diagnose
     a spec and does NOT declare the change unimpacted, so the must_not checks read as correctly
     absent. -->

## e2e-impact: 1 changed source file · Playwright

### Impacted specs — run these
- **tests/e2e/search.test.ts** — 🟢 High · two signals converge on the changed `app/routes/users/index.tsx`:
  - **route** — the spec reaches the users route by interaction and asserts `page.waitForURL('/users?search=…')`; it never calls `goto`, so a goto/visit-only grep would miss it. The changed file implements that route.
  - **text** — the spec asserts `getByText('Epic Notes Users')`, and that literal is rendered in the changed file.

### Run-all / unmapped — don't skip these
- (none — the one changed file traced to a spec by two signals)

### Source→spec relevance map  (for /debug-test --drift, read inverted)
app/routes/users/index.tsx  → tests/e2e/search.test.ts (High · route waitForURL + text 'Epic Notes Users')
