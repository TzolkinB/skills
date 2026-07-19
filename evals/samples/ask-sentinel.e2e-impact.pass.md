<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "which E2E specs does this diff hit?"
     situation to /e2e-impact (source→spec relevance map). Used by run-eval.mjs --dry-run offline. -->

**You're at:** you have a diff (checkout API + shared components) and need to know which Playwright specs exercise it before running the whole suite.

**Use:** `/e2e-impact`
**Why:** the question is *which E2E specs this diff plausibly hits* — `/e2e-impact` maps the changed files to the Playwright/Cypress specs via import, route, and selector/test-id signals, with a confidence per spec and an honest run-all fallback for anything it can't trace.
**Run:** `/e2e-impact main...HEAD`
**Evidence:** Proven (own) — heuristic v0; never silently drops a changed file.

**Next in the flow:** run the mapped specs; if one goes red, `/debug-test`.
