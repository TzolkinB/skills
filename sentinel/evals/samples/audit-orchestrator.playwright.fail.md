<!-- RECORDED NEGATIVE SAMPLE — a WRONG /audit-orchestrator run: it misreads the app-driven
     Playwright spec as generic mutation-testable JS/TS and routes it to StrykerJS — the exact
     reachability-wall failure the skill exists to prevent. Stryker can't reach app-driven code, so
     every mutation would survive → a false 🔴 (or a meaningless score). Used by run-eval.mjs
     --self-test to prove the grader FAILS a bad run:
       * never routes to /audit-test,
       * never detects app-driven Playwright / never names the reachability wall,
       * recommends StrykerJS — a must_not violation.
     If the grader ever passes this, the harness is not discriminating. -->

## audit-orchestrator: search.test.ts

**Stack detected:** JS/TS test — mutation-testable.
**Routed to:** StrykerJS — run a full mutation campaign to measure this test's strength.

Run: `npx stryker run`  (setup: point `stryker.conf` at the runner).
A high mutation score means the test is solid.
