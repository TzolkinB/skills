# audit-orchestrator — routes a suspicious test to the tool that proves it

> **Agent instructions:** [`skills/audit-orchestrator/SKILL.md`](../skills/audit-orchestrator/SKILL.md)
>
> **Run:** `/audit-orchestrator [test/file or repo/dir]`

## What it does

The best free mutation tools — **StrykerJS** and **Tautest** — mutate source code and work only with Vitest/Jest. They hit a **reachability wall**: no source path exists to mutate under a browser-driven spec, so they never touch app-driven Playwright or Cypress code.

`audit-orchestrator` is the **Audit stage** router. It detects the stack of the specific test under suspicion, not the repo's default. A real repo often holds both a Vitest unit suite and a Playwright E2E suite. It routes to whichever tool actually proves something about that test.

Where a free tool fits (unit or component JS-TS), audit-orchestrator points you at Tautest (PR-scoped diff-mutation) or StrykerJS (whole-suite campaign). It orchestrates; it does not reimplement these tools. Where the wall stops those tools — any app-driven Playwright or Cypress test — audit-orchestrator falls back to [`audit-test`](./audit-test.md), which proves a dev-served target directly.

Every recommendation carries a **label** — Confirmed, Likely, or Unexamined, that shows how strong the evidence is. The evidence for the reachability wall is Confirmed. A routing claim never goes higher than the evidence behind it. That label is not uniform across frameworks. Proving a Playwright target is **Confirmed**. Proving a Cypress target is only **Likely**. The Cypress runner sometimes fails to launch at all on macOS 26. This is an Electron incompatibility. Reinstalling does not fix it. Docker works around this problem. This is an environment problem, not a routing failure.

## When to use it

| Your situation | Where to go |
| --- | --- |
| You have a suspicious passing test, and you do not know which mutation tool actually reaches it, or you do not want to work that out | **`/audit-orchestrator [test/file or repo/dir]`** — this page |
| A repo mixes unit and E2E suites, and you want the audit routed to the right tool per test, not a blanket guess | **`/audit-orchestrator`** |
| You already know it is app-driven E2E | [`audit-test`](./audit-test.md) directly — the router only adds a step |
| You want a codebase-wide mutation score | StrykerJS itself — this skill points you at StrykerJS, it does not replace it |
| You want the actual proof, not a routing decision | Not this skill — it hands off to `audit-test` or an external tool and never runs the mutation itself |

## Prerequisites

audit-orchestrator needs only Claude Code, plus whatever the routed-to tool needs. Most commonly that means [`audit-test`](./audit-test.md)'s prerequisites — a runnable dev-served target and a clean git tree — when the target is app-driven. Detecting the stack itself is local config and import inspection, with no network calls.

## Worked example

audit-orchestrator needs a real repo to detect a runner against. It uses **warm sibling fixtures** in `~/projects/`, not a vendored one ([why](../fixtures/README.md)). See [expected findings](../fixtures/audit-orchestrator/expected-findings.md).

Pointed at an epic-stack Playwright spec, audit-orchestrator detects **Playwright app-driven** (signal: a `@playwright/test` import, plus `playwright.config.ts`). It routes to `audit-test` with Confirmed provenance. Stryker and Tautest have no reach into this target, so every mutation on it goes undetected. A run reports a false 🔴. Recommending them here is the wrong call.

Pointed at a Vitest unit test, audit-orchestrator detects **Vitest unit**. It routes to Tautest for PR-scoped diff-mutation, then to `audit-test` on any survivor — a mutation the test failed to catch — for a concrete fix. This is also Confirmed provenance, since Tautest's Stryker-only, Vitest/Jest scope is directly verified.

## It's Working If

- The stack detected is the specific test's own stack, never the repo's overall default.
- Stryker or Tautest are never recommended for app-driven Playwright or Cypress code — the reachability wall means every mutation there goes undetected.
- The evidence label matches what's actually verified: Confirmed for Playwright, Likely for Cypress.
- The routed verdict — 🔴/🟡/🟢/⚠️ — passes through untouched; `audit-orchestrator` never collapses it into its own PASS/FAIL.

If `audit-orchestrator` ever recommends Stryker or Tautest for a target behind the reachability wall, or emits its own PASS/FAIL verdict, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Why does a Cypress target only get a Likely label instead of Confirmed?**
A: The Cypress runner sometimes fails to launch at all on macOS 26 — an Electron incompatibility that reinstalling does not fix. Docker works around it, but the label reflects an environment limitation, not a routing failure.

**Q: Can Stryker or Tautest reach an app-driven Playwright or Cypress test if I point them at it directly?**
A: No. No source path exists to mutate under a browser-driven spec, so mutations there go undetected and a run reports a false 🔴. That is why `audit-orchestrator` falls back to `audit-test` instead.

**Q: Does audit-orchestrator run the mutation itself?**
A: No — it orchestrates. It routes to `audit-test`, Tautest, or StrykerJS and hands off; it never reimplements a mutation engine.

## Where it fits

Stage 3 of the [orchestration map](./orchestration-map.md) — audit-orchestrator runs after tests exist, and it routes the audit rather than performing it. It hands off to [`audit-test`](./audit-test.md) for app-driven targets, and to Tautest or StrykerJS (external tools it points at, not absorbs) for unit or component targets. It never emits a PASS/FAIL gate — that is [`qa-pass`](./qa-pass.md) then [`gate`](./gate.md)'s job, downstream.

## Anti-patterns

- **Recommending Stryker or Tautest for app-driven code.** They have no reach into it. Every mutation goes undetected. The result is a false 🔴 that looks like proof and is not.
- **Guessing the stack from the repo default.** A repo with both Vitest and Playwright needs the target test's own stack detected, not a guess from whichever runner is more common.
- **Absorbing the mutation engine.** For Tautest or StrykerJS, this skill prints the command and points at it. It does not reimplement a mutation runner.
- **Collapsing the routed verdict into PASS/FAIL.** It carries `audit-test`'s 🔴/🟡/🟢/⚠️ verdict through, untouched. The ship verdict belongs to the gate, not here.
