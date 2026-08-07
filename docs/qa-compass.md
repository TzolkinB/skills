# qa-compass — the front door: describe your situation, get routed

> **Agent instructions:** [`skills/qa-compass/SKILL.md`](../skills/qa-compass/SKILL.md) · **Run:** `/qa-compass "what you're trying to do"` (omit the argument for the full map)

## What it does

A dozen-plus QA skills, and an ecosystem of external tools on top of them, is more than anyone wants to memorize. `qa-compass` is the front door to the whole map: describe the situation in plain terms — *"AI just wrote 500 lines of tests"*, *"a Playwright test is red"*, *"about to merge"* — and it names the one best tool for your situation, whether that's one of these skills or an external tool (Stryker, TEA, a Playwright agent, …), says why, shows its evidence label, and where that step sits in the wider QA flow.

It has two ways to ask: a *single question* ("this test smells wrong") returns **one** best tool; a *lifecycle ask* ("walk me through QA before I merge") returns an **ordered stage path** instead. It **routes; it doesn't analyze** — it may read your stack manifests (`package.json`, `playwright.config.*`/`cypress.config.*`, a published OpenAPI/Swagger doc) to tell whether the best fit is an external tool or one of these skills, but it never reads your test or source *logic*, never runs a test, and never emits a verdict; it hands you the invocation. It is *not* one of the skills it routes to and never joins the `/qa-pass` chain — it's the map, not a stop on the route. The one rule it exists to teach: [`qa-pass`](./qa-pass.md) is the orchestrator, not a peer; the other atomic skills each answer exactly one question.

## When to use it

- You're not sure which tool to reach for — one of these skills or an external tool — and want to be pointed at exactly one.
- You want the ordered path through a whole workflow ("what's the full path to ship this safely"), not just one tool.
- You want the whole map — run it with no argument for the skill table and the intended flow.

## When *not* to use it

- **You already know the tool you need** — just run it; the router only adds a hop.
- **You want analysis, a diagnosis, or a verdict** — the router produces none of those; it names the tool that will.

## Prerequisites

Just Claude Code. It may read your stack manifests (`package.json`, `playwright.config.*`/`cypress.config.*`, a published OpenAPI/Swagger doc) to pick the best tool for your stack, but it never reads test or source logic and it runs nothing itself.

## Worked example

`qa-compass` consumes a situation description rather than code, so it has no fixture. It maps a plain-language situation to a single skill:

| You say… | It routes you to |
|---|---|
| "AI just wrote 500 lines of tests" | [`coverage-review`](./coverage-review.md) — find the missing cases and loose assertions |
| "this test passes but I don't trust it" | [`audit-test`](./audit-test.md) — prove it by mutation |
| "a Playwright test is red" | [`debug-test`](./debug-test.md) — diagnose and route the fix |
| "about to merge" | [`qa-pass`](./qa-pass.md) — one PASS/CAUTION/FAIL QA read across the branch (a read to act on, not the release gate — pair with [`gate`](./gate.md) for the ship/canary/hold decision) |

Run `/qa-compass` with no argument and it prints the full skill table and the flow diagram instead of routing. The complete routing signals and flow live in [`skills/qa-compass/SKILL.md`](../skills/qa-compass/SKILL.md).

## Where it fits

*Before* the flow, not in it — the front door. It points you at the right skill and shows where that step sits, then gets out of the way; it never joins the [`qa-pass`](./qa-pass.md) chain and never runs analysis. Once it's routed you, you're done with it.

## Anti-patterns

- **Expecting a diagnosis or verdict.** The router points; it never analyzes, runs, or judges.
- **Using it when the target is obvious.** If you already know you need `coverage-review`, routing through the front door just adds a step.
- **Returning a menu of five.** A router that hands back five options has routed nothing — it names one primary skill (and at most one follow-up).
