---
name: audit-orchestrator
description: Route a suspicious *passing* test to the tool that can actually prove it — unit JS/TS → Tautest/StrykerJS, app-driven Playwright/Cypress → audit-test with the reachability guard — and emit a provenance-labelled verdict, never a gate.
argument-hint: "[a suspicious test name/file, or a repo/dir to detect + route]"
allowed-tools: [Read, Bash, Glob, Skill]
disable-model-invocation: true
---

**Owns:** the **Audit stage** routing decision — detect a test's stack and hand it to the tool that can actually prove whether it guards anything. The stage-3 orchestrator.
**Not this:** the per-test mutation proof itself → `/audit-test` (this routes *to* it); missing paths → `/coverage-review`; the whole-branch ship verdict → `/sentinel`. It **never emits a gate**.

The best free mutation tools — **StrykerJS** and **Tautest** — are source-mutating and Vitest/Jest-scoped, so they hit a **reachability wall**: they cannot touch app-driven Playwright/Cypress code (*Confirmed*). This skill detects the stack and **routes, not rivals** ([ADR-0004](../../docs/adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)): where a free tool fits, it points you at it (orchestrate, don't absorb); where the wall stops it — app-driven — it falls back to **`audit-test`**, which proves a dev-served target and returns an honest 🟡 on a stale/build-served harness instead of a false 🔴 ([ADR-0016](../../docs/adr/0016-audit-test-reachability-guard.md)/[ADR-0019](../../docs/adr/0019-audit-test-reachability-warm-dev-propagation.md)). A green is not proof — and neither is a routing assertion without evidence, so every recommendation carries a **provenance label** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)); don't upgrade one past what backs it.

## Steps

### 1. Detect the stack of the *test under audit*
Classify by the target test, not the repo default — **a repo routinely holds both** (e.g. Playwright E2E *and* Vitest units). Signals, cheap first:
- **App-driven E2E** — a `playwright.config.*` (Playwright); a `cypress.config.*`, a `cypress/` dir, or a `*.cy.*` file (Cypress). These drive a running app over a browser.
- **Unit / component (JS-TS)** — `vitest.config.*` / `jest.config.*` or a `jest` key in `package.json`; a `*.test.*` / `*.spec.*` run in Node, no browser.
- **Config presence + the target's location beat a direct import.** Real suites often import a wrapper — epic-stack's Playwright specs import `#tests/playwright-utils.ts`, not `@playwright/test`, so an import-only sniff would miss them. Lead with the nearest config and where the file lives (`tests/e2e/…spec.ts` → Playwright; a `*.cy.ts` under `cypress/` → Cypress; a `*.test.ts` beside a `vitest.config` → Vitest), and use the import only to confirm.
- Look with Glob/Read: `Glob **/{playwright,cypress,vitest,jest}.config.*`, then pick the config **nearest the target file**; check `package.json` `devDependencies`/`test`.
- **Ambiguous or no runner found** → say so and ask which stack, or fall back to `/audit-test` (it degrades to a reasoned 🟡 when it can't run).

### 2. Route via the Situation → Tool table
Pick **one** primary tool and state the reason and its provenance:

| Test under audit | Route to | Why · provenance |
|---|---|---|
| Unit/component JS-TS · **a PR / changed scope** | **Tautest** (diff-mutation), then `/audit-test` on any survivor for a *fix* | Mutates only changed lines → fast PR gate. Stryker-only, Vitest/Jest (**Confirmed** — cloned; routes E2E out of scope) |
| Unit/component JS-TS · **whole-suite health / a mutation score** | **StrykerJS** (full campaign) | The defensible codebase-wide number (**Likely** — its Vitest/Jest scope is **Confirmed** at docs; the runtime cost is not measured here). Run `/audit-test` first on suspects — it's cheap |
| Unit/component JS-TS · **one suspect test / want a fix not a number** | **`/audit-test`** | Source-run → the reachability probe is caught trivially; hands a taxonomy verdict + concrete fix |
| **App-driven Playwright / Cypress** (any scope) | **`/audit-test`** (dev-served, reachability guard) | Stryker/Tautest **can't reach** app-driven code — the reachability wall (**Confirmed**, both). audit-test proves a dev-served target — **Confirmed** on Playwright, **Likely** on Cypress (runner may be macOS-blocked → Docker) — returning honest 🟡 on a stale build (ADR-0016/0019) |

### 3. Invoke or point, then emit the verdict
- **audit-test routes** → invoke `/audit-test` (via the `Skill` tool) on the target and carry its verdict through. audit-test owns the mutation, the reachability/baseline-lock guards, and the Safety rule; this skill does not re-implement them.
- **Tautest / StrykerJS routes** → **orchestrate, don't absorb**: print the exact command and a one-line setup note; these are external, source-mutating CLIs the map points *at*, not into. Then recommend `/audit-test` on any survivor for a concrete fix.
- Always label the routing claim's provenance and keep audit-test's `🔴 / 🟡 / 🟢 / ⚠️` verdict semantics intact. **Never** collapse them into a PASS/FAIL — that's the gate, and the gate is not this skill's (it's `/sentinel` → Gate).

## Output Format

```
## audit-orchestrator: [target]

**Stack detected:** [Playwright app-driven | Cypress app-driven | Vitest unit | Jest unit]  (signal: [config / import / file])
**Routed to:** [tool]  —  [one-line why]
**Provenance:** [Confirmed | Likely | Unexamined] — [what backs this routing]

<!-- audit-test route: the /audit-test verdict, verbatim -->
[🔴/🟡/🟢/⚠️ verdict block from /audit-test]

<!-- Tautest / Stryker route: point, don't absorb -->
Run: `npx tautest ...`  (setup: [one line])
Then: `/audit-test [survivor]` for a fix on anything that survives.

**Not a gate.** A routed credibility read, not a ship verdict.
```

## Notes

- **Orchestrate, don't absorb.** For Tautest/StrykerJS this skill *points* (they own source-mutation on Vitest/Jest); for the app-driven wall it routes to `/audit-test`, the gap-filler. It never reimplements a mutation engine — the moat is the *routing + the E2E gap-fill*, not another runner.
- **Provenance discipline** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)): a routing recommendation is advice only at **Likely**+, a claim of superiority only at **Confirmed**. The reachability wall (source-mutating tools can't reach app-driven code) is **Confirmed**; `audit-test` proving a dev-served target is **Confirmed on Playwright**, **Likely on Cypress**. Don't upgrade a label past its evidence.
- **À la carte and orchestrated both.** Stands alone on one suspect test; it is also stage 3 of the orchestration map, whose credibility evidence flows toward the gate (Gate) — this skill emits evidence, never the ship verdict.
- `--explain` is not supported — procedural, not pedagogical.
