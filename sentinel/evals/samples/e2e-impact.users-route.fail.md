<!-- RECORDED NEGATIVE SAMPLE — a WRONG /e2e-impact run that falls into the module-graph blind
     spot: it looks for E2E specs that IMPORT app/routes/users/index.tsx (E2E specs never import
     the source they drive), finds none, greps only page.goto for routes (the impacted spec
     reaches the route by interaction + waitForURL, never goto), and concludes no specs are
     impacted — silently dropping the changed file instead of landing it in run-all/unmapped.
     This is exactly the failure e2e-impact exists to prevent. Used by run-eval.mjs --self-test
     to prove the grader FAILS a bad run:
       * never names tests/e2e/search.test.ts,
       * never reads the URL-wait route signal or the text signal,
       * never emits the source→spec relevance map,
       * declares the traceable change unimpacted — a must_not violation.
     If the grader ever passes this, the harness is not discriminating. -->

## e2e-impact: 1 changed source file · Playwright

### Impacted specs
No spec imports `app/routes/users/index.tsx`, and no `page.goto('/users')` call appears in any
spec. No E2E specs impacted by this diff — nothing to select.
