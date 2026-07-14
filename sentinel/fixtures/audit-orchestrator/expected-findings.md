# Expected findings — audit-orchestrator

`audit-orchestrator` reads a repo/test, detects the stack, and routes. Unlike the other
fixtures it needs a *repo context* to detect a runner, so the targets here are the verified
warm fixtures used to validate `audit-test` (siblings in `~/projects/`, not vendored).

## Case A — app-driven Playwright (epic-stack)
Run: `/audit-orchestrator ~/projects/epic-stack/tests/e2e/search.test.ts`
- **Stack detected:** Playwright app-driven (signal: `@playwright/test` import + `playwright.config.ts`).
- **Routed to:** `/audit-test` (dev-served, reachability guard).
- **Provenance:** Proven — Stryker/Tautest can't reach app-driven code (reachability wall);
  audit-test proves a dev-served Playwright target, honest 🟡 on a stale build.
- Must **not** recommend StrykerJS/Tautest here (they'd survive every mutation → false 🔴).

## Case B — app-driven Cypress (cypress-realworld-app)
Run: `/audit-orchestrator ~/projects/cypress-realworld-app` (a `*.cy.ts` target)
- **Stack detected:** Cypress app-driven (signal: `cypress.config.ts` + `cypress/` dir + `*.cy.*`).
- **Routed to:** `/audit-test` (dev-served) — and if the Cypress runner won't launch (macOS 26 /
  Electron 36), that's an **environment reachability failure**, not a verdict: route to Docker
  (`cypress/included`), don't emit 🔴/🟢.

## Case C — unit Vitest (the .cov-fixture, or any Vitest repo)
Run: `/audit-orchestrator <a Vitest *.test.ts>` scoped to a PR
- **Stack detected:** Vitest unit (signal: `vitest.config.*` / `vitest` in devDeps, Node run, no browser).
- **Routed to:** **Tautest** (PR diff-mutation) for the changed scope, **then** `/audit-test` on any
  survivor for a fix; or `/audit-test` directly for a single suspect test.
- **Provenance:** Proven (Tautest is Stryker-only, Vitest/Jest — cloned and read).

## Boundary notes (what it must NOT do)
- **Never emit a PASS/FAIL gate** — it routes and carries a credibility verdict; the ship verdict is
  `/sentinel` → Witness.
- **Orchestrate, don't absorb** — for Tautest/Stryker it prints the command + points; it does
  not reimplement mutation.
- **Never upgrade a provenance label past its evidence** — the reachability wall is *Proven*;
  audit-test-proves-dev-served is *Proven on Playwright*, *Likely on Cypress*.
