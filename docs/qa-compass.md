# qa-compass — the entry point: describe your situation, get routed

> **Agent instructions:** [`skills/qa-compass/SKILL.md`](../skills/qa-compass/SKILL.md)
>
> **Run:** `/qa-compass "what you're trying to do"` (omit the argument for the full map)

## What it does

This project has more than a dozen QA skills. Many external tools work alongside them. No one wants to memorize all of them. `qa-compass` is the entry point to the whole map. Describe your situation in plain words. For example: "AI just wrote 500 lines of tests", "a Playwright test is red", or "about to merge". `qa-compass` names the one best tool for your situation. That tool is one of these skills, or an external tool such as Stryker, TEA, or a Playwright agent. It states why the tool fits, shows the tool's evidence label, and shows where that step sits in the wider QA flow.

There are two ways to ask. A single question, for example "this test smells wrong", gets one best tool. A lifecycle question, for example "walk me through QA before I merge", gets an ordered list of stages instead.

`qa-compass` routes. It does not analyze your code. If the choice depends on your stack, it reads your stack manifests: `package.json`, `playwright.config.*` or `cypress.config.*`, or a published OpenAPI or Swagger document. These tell it whether the best fit is an external tool or one of these skills. It never reads your test logic or source logic. It never runs a test. It never gives a verdict. It hands you the command to run instead.

`qa-compass` is not one of the skills it routes to. It never joins the `/qa-pass` chain. It is the map, not a stop on the route. One rule matters most: [`qa-pass`](./qa-pass.md) is the orchestrator, not a peer skill. Each of the other atomic skills answers exactly one question.

## When to use it

- You are not sure which tool to reach for — one of these skills or an external tool. You want to be pointed at exactly one.
- You want the ordered path through a whole workflow, for example "what is the full path to ship this safely", not just one tool.
- You want the whole map. Run `qa-compass` with no argument for the skill table and the intended flow.

## When _not_ to use it

- **You already know the tool you need.** Run it directly. The router only adds a step.
- **You want analysis, a diagnosis, or a verdict.** The router produces none of these. It names the tool that will.

## Prerequisites

Only Claude Code. `qa-compass` sometimes reads your stack manifests — `package.json`, `playwright.config.*` or `cypress.config.*`, a published OpenAPI or Swagger document — to pick the best tool for your stack. It never reads test logic or source logic, and it runs nothing itself.

## Worked example

`qa-compass` takes a description of your situation, not code, so it has no fixture. It maps a plain-language situation to a single skill:

| You say…                                 | It routes you to                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "AI just wrote 500 lines of tests"       | [`coverage-review`](./coverage-review.md) — find the missing cases and loose assertions                                                                                                         |
| "this test passes but I do not trust it" | [`audit-test`](./audit-test.md) — prove it by mutation                                                                                                                                          |
| "a Playwright test is red"               | [`debug-test`](./debug-test.md) — diagnose and route the fix                                                                                                                                    |
| "about to merge"                         | [`qa-pass`](./qa-pass.md) — one PASS, CAUTION, or FAIL QA read across the branch (a read to act on, not the release gate. Pair with [`gate`](./gate.md) for the ship, canary, or hold decision) |

Run `/qa-compass` with no argument. It prints the full skill table and the flow diagram instead of routing. The complete routing signals and flow live in [`skills/qa-compass/SKILL.md`](../skills/qa-compass/SKILL.md).

## Where it fits

`qa-compass` sits before the QA flow, not inside it. It is the entry point. It points you at the right skill, shows where that step sits, then steps aside. It never joins the [`qa-pass`](./qa-pass.md) chain and never runs analysis. Once it routes you, its job ends.

## Anti-patterns

- **Expecting a diagnosis or a verdict.** The router points to a tool. It never analyzes, runs, or judges.
- **Using it when the target is obvious.** If you already know you need `coverage-review`, routing through the entry point only adds a step.
- **Returning a menu of five.** A router that hands back five options has routed nothing. It names one primary skill, and at most one follow-up.
