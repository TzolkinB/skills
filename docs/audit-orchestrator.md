# audit-orchestrator — route a suspicious test to the tool that can prove it

> **Agent instructions:** [`skills/audit-orchestrator/SKILL.md`](../skills/audit-orchestrator/SKILL.md) · **Run:** `/audit-orchestrator [test/file or repo/dir]`

## What it does

The best free mutation tools — **StrykerJS** and **Tautest** — are source-mutating and Vitest/Jest-scoped. They hit a **reachability wall**: they cannot touch app-driven Playwright/Cypress code, because there's no source path to mutate underneath a browser-driven spec. `audit-orchestrator` is the **Audit stage** router: it detects the stack of the specific test under suspicion — not the repo's default, since a real repo routinely holds both a Vitest unit suite and a Playwright E2E suite — and routes to whichever tool can actually prove something about it.

Where a free tool fits (unit/component JS-TS), it points you at Tautest (PR-scoped diff-mutation) or StrykerJS (whole-suite campaign) and orchestrates rather than reimplements. Where the wall stops those tools — any app-driven Playwright/Cypress test — it falls back to [`audit-test`](./audit-test.md), which proves a dev-served target directly. Every recommendation carries a **provenance label** (Confirmed/Likely/Unexamined): the reachability wall itself is Confirmed, but a routing claim never gets upgraded past what backs it.

## When to use it

- You have a suspicious passing test and don't know (or don't want to work out) which mutation tool can actually reach it.
- A repo mixes unit and E2E suites and you want the audit routed to the right tool per test, not a blanket guess.

## When *not* to use it

- **You already know it's app-driven E2E** → call [`audit-test`](./audit-test.md) directly; the router just adds a hop.
- **You want a codebase-wide mutation score** → StrykerJS itself, which this skill points you at rather than replaces.
- **You want the actual proof, not a routing decision** → this skill hands off to `audit-test` or an external tool; it never runs the mutation itself.

## Prerequisites

Just Claude Code, plus whatever the routed-to tool needs — most commonly [`audit-test`](./audit-test.md)'s prerequisites (a runnable dev-served target and a clean git tree) when the target is app-driven. Detecting the stack itself is local config/import inspection with no network calls.

## Worked example

`audit-orchestrator` needs a real repo to detect a runner against, so it uses **warm sibling fixtures** in `~/projects/` rather than a vendored one ([why](../fixtures/README.md)): [expected findings](../fixtures/audit-orchestrator/expected-findings.md).

Pointed at an epic-stack Playwright spec, it detects **Playwright app-driven** (via `@playwright/test` import + `playwright.config.ts`) and routes to `audit-test` with Confirmed provenance — Stryker/Tautest would survive every mutation on this target and report a false 🔴, so recommending them here would be the wrong call. Pointed at a Vitest unit test, it detects **Vitest unit** and routes to Tautest for PR-scoped diff-mutation (then `audit-test` on any survivor for a concrete fix), also at Confirmed provenance since Tautest's Stryker-only, Vitest/Jest scope is directly verified.

## Where it fits

Stage 3 of the [orchestration map](./orchestration-map.md) — after tests exist, routing the audit rather than performing it. It hands off to [`audit-test`](./audit-test.md) for app-driven targets and to Tautest/StrykerJS (external, pointed at rather than absorbed) for unit/component targets. It never emits a PASS/FAIL gate — that's [`sentinel`](./sentinel.md) → [`gate`](./adr/0028-witness-gate-skill-mvp1.md)'s job downstream.

## Anti-patterns

- **Recommending Stryker/Tautest for app-driven code.** They can't reach it — every mutation survives, producing a false 🔴 that looks like proof and isn't.
- **Guessing the stack from the repo default.** A repo with both Vitest and Playwright needs the *target test's* stack detected, not an assumption from whichever runner is more prominent.
- **Absorbing the mutation engine.** For Tautest/StrykerJS this skill prints the command and points; it doesn't reimplement a mutation runner.
- **Collapsing the routed verdict into PASS/FAIL.** It carries `audit-test`'s 🔴/🟡/🟢/⚠️ semantics through untouched — the ship verdict belongs to the gate, not here.
