# qa-compass — the entry point: describe your situation, get routed

> **Agent instructions:** [`skills/qa-compass/SKILL.md`](../skills/qa-compass/SKILL.md)
>
> **Run:** `/qa-compass "what you're trying to do"` (omit the argument for the full map)

## What it does

This project has more than a dozen QA skills, plus external tools that work alongside them. No one wants to memorize all of them. `qa-compass` is **the entry point to the whole map**: describe your situation in plain words — "AI just wrote 500 lines of tests", "a Playwright test is red", "about to merge" — and it names the **one best tool** for it, whether that's one of these skills or an external tool such as Stryker, TEA, or a Playwright agent. It states why the tool fits, shows the tool's evidence label, and shows where that step sits in the wider QA flow.

There are two ways to ask. A single question, for example "this test smells wrong", gets one best tool. A lifecycle question, for example "walk me through QA before I merge", gets an ordered list of stages instead.

`qa-compass` **routes; it does not analyze**. If the choice depends on your stack, it reads your stack manifests — `package.json`, `playwright.config.*` or `cypress.config.*`, or a published OpenAPI or Swagger document — to tell whether the best fit is an external tool or one of these skills. It never reads your test logic or source logic, never runs a test, never gives a verdict. It hands you the command to run instead.

`qa-compass` is not one of the skills it routes to, and it never joins the `/qa-pass` chain — it is the map, not a stop on the route. One rule matters most: [`qa-pass`](./qa-pass.md) is the orchestrator, not a peer skill. Each of the other individual skills answers exactly one question.

## When to use it

| Your situation | Where to go |
| --- | --- |
| Not sure which tool fits — a single question, or the whole workflow | **`/qa-compass "situation"`** — this page; a single question gets one tool, a lifecycle ask gets an ordered stage path |
| Want the whole map — the skill table and the intended flow | **`/qa-compass`** with no argument |
| You already know the tool you need | Run it directly — e.g. [`coverage-review`](./coverage-review.md), [`audit-test`](./audit-test.md), [`gate`](./gate.md) — the router only adds a step |
| You want analysis, a diagnosis, or a verdict | Not `qa-compass` — run the tool that does it: [`debug-test`](./debug-test.md) diagnoses, [`gate`](./gate.md) decides ship/canary/hold |

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

## It's Working If

- A single-question ask returns exactly one primary tool, at most one follow-up — never a menu of five.
- A lifecycle ask returns an ordered stage path anchored to where your change sits now, with only the stages that apply — never a bare seven-stage dump.
- The ordered path is a recommendation, not a mandate — you can take it whole or run just one stage out of it.
- Stack detection only runs when the choice actually hinges on it — mainly the Audit and Triage stages — not on every route.
- A stack it can't confidently detect never gets guessed at — it asks one clarifying question or shows the full map instead.

If `qa-compass` ever analyzes code, runs a test, or hands back more than two tools for one question, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: My situation is genuinely ambiguous — could be one question, could be the whole workflow. Which do I get?**
A: The point-route — the cheaper answer — with the sequence offered as a follow-up. `qa-compass` never inflates one question into a seven-stage plan.

**Q: What does an "Unexamined" evidence label mean — should I trust it the same as Confirmed or Likely?**
A: No. Confirmed and Likely tools get a full recommendation. Unexamined means `qa-compass` named a real tool but hasn't verified it works in this repo's context — it's surfaced as a lead, not advice.

**Q: Does `qa-compass` ever route you to a self-healer, like the Playwright Healer agent or Cypress self-heal?**
A: Only with its credibility caveat attached. A self-healer can heal or skip a test to green, which can mask a real regression — `qa-compass` surfaces that as a hazard, not an endorsement.

## Where it fits

`qa-compass` sits before the QA flow, not inside it. It is the entry point. It points you at the right skill, shows where that step sits, then steps aside. It never joins the [`qa-pass`](./qa-pass.md) chain and never runs analysis. Once it routes you, its job ends.

## Anti-patterns

- **Expecting a diagnosis or a verdict.** The router points to a tool. It never analyzes, runs, or judges.
- **Using it when the target is obvious.** If you already know you need `coverage-review`, routing through the entry point only adds a step.
- **Returning a menu of five.** A router that hands back five options has routed nothing. It names one primary skill, and at most one follow-up.
