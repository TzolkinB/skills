<!-- RECORDED SAMPLE — a faithful /audit-orchestrator run on the epic-stack Playwright target
     (search.test.ts). Detects app-driven Playwright, routes to /audit-test behind the reachability
     wall (source-mutating tools can't reach app-driven code), labels the routing Confirmed, and keeps
     audit-test's honest 🟡 on a stale build. Used by run-eval.mjs --dry-run offline. Deliberately
     NAMES Stryker/Tautest only to explain the wall — it never tells you to run them and never emits
     a PASS/FAIL gate — so the must_not checks read as correctly absent. -->

## audit-orchestrator: search.test.ts (epic-stack)

**Stack detected:** Playwright app-driven  (signal: `playwright.config.ts` + the target under `tests/e2e/`; the spec imports a `#tests/playwright-utils.ts` wrapper, so a bare `@playwright/test` import sniff would miss it).
**Routed to:** `/audit-test` (dev-served, reachability guard)  —  source-mutating tools can't reach app-driven code.
**Provenance:** Confirmed — Stryker/Tautest hit the reachability wall (they can't touch app-driven Playwright code), so `/audit-test` is the gap-filler: it proves a dev-served target and, on a stale/build-served harness, returns an honest 🟡 rather than a false 🔴.

🟡 Inconclusive — the harness is serving a stale build, so a mutation can't be proven caught right now; re-run dev-served for a 🔴/🟢. (audit-test's reachability guard: an honest 🟡, never a false 🔴.)

**Not a gate.** A routed credibility read, not a ship verdict — the ship call is `/sentinel` → Gate.
