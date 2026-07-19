<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "Playwright spec is red with a locator
     timeout" situation to /debug-test (diagnose the active failure and route the fix). Used by
     run-eval.mjs --dry-run offline. -->

**You're at:** a Playwright spec is red with a locator timeout and you want it diagnosed.

**Use:** `/debug-test`
**Why:** a Playwright test is actively failing on a locator/timing error — `/debug-test` answers the one question "root cause and fix?", diagnosing and routing the repair.
**Run:** `/debug-test path/to/failing.spec.ts`

**Next in the flow:** if the fix needs a clean handoff, `/bug-report`; if it turns out to be external drift, `/debug-test --drift`.
