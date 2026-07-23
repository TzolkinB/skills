<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "suspicious passing test — which prover
     fits my stack?" situation to /audit-orchestrator (the stack-aware Audit entry point, distinct
     from reaching for /audit-test directly). Used by run-eval.mjs --dry-run offline. -->

**You're at:** a passing test you distrust, and you want the right prover picked for your stack rather than reaching for one tool blindly.

**Use:** `/audit-orchestrator`
**Why:** it's the stack-aware Audit entry point — it picks the right prover *for your stack* (unit JS/TS → Stryker/Tautest, app-driven Playwright/Cypress → `/audit-test`), so you don't have to choose the tool yourself.
**Run:** `/audit-orchestrator path/to/suspect.spec.ts`
**Evidence:** advice — Tautest Confirmed, StrykerJS Likely, audit-test Confirmed.

**Next in the flow:** it routes into the prover it picked; act on that tool's verdict.
