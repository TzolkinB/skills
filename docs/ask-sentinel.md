# ask-sentinel — the front door: describe your situation, get routed

> **Agent instructions:** [`skills/ask-sentinel/SKILL.md`](../skills/ask-sentinel/SKILL.md) · **Run:** `/ask-sentinel "what you're trying to do"` (omit the argument for the full map)

## What it does

A dozen QA skills is more than anyone wants to memorize. `ask-sentinel` is the front door: describe the situation in plain terms — *"AI just wrote 500 lines of tests"*, *"a Playwright test is red"*, *"about to merge"* — and it names the one skill that answers your question, says why, and shows where that step sits in the wider QA flow.

It **routes; it doesn't analyze** — it never reads your code, runs a test, or emits a verdict; it hands you the skill that does. It is *not* one of them and never joins the `/sentinel` chain — it's the map, not a stop on the route. The one rule it exists to teach: [`sentinel`](./sentinel.md) is the orchestrator, not a peer; the other atomic skills each answer exactly one question.

## When to use it

- You're not sure which skill to reach for and want to be pointed at exactly one.
- You want the whole map — run it with no argument for the skill table and the intended flow.

## When *not* to use it

- **You already know the skill you need** — just run it; the router only adds a hop.
- **You want analysis, a diagnosis, or a verdict** — the router produces none of those; it names the skill that will.

## Prerequisites

Just Claude Code — the router reads nothing and runs nothing. It only points you at another skill.

## Worked example

`ask-sentinel` consumes a situation description rather than code, so it has no fixture. It maps a plain-language situation to a single skill:

| You say… | It routes you to |
|---|---|
| "AI just wrote 500 lines of tests" | [`coverage-review`](./coverage-review.md) — find the missing cases and loose assertions |
| "this test passes but I don't trust it" | [`audit-test`](./audit-test.md) — prove it by mutation |
| "a Playwright test is red" | [`debug-test`](./debug-test.md) — diagnose and route the fix |
| "about to merge" | [`sentinel`](./sentinel.md) — the ship gate, one verdict |

Run `/ask-sentinel` with no argument and it prints the full skill table and the flow diagram instead of routing. The complete routing signals and flow live in [`skills/ask-sentinel/SKILL.md`](../skills/ask-sentinel/SKILL.md).

## Where it fits

*Before* the flow, not in it — the front door. It points you at the right skill and shows where that step sits, then gets out of the way; it never joins the [`sentinel`](./sentinel.md) chain and never runs analysis. Once it's routed you, you're done with it.

## Anti-patterns

- **Expecting a diagnosis or verdict.** The router points; it never analyzes, runs, or judges.
- **Using it when the target is obvious.** If you already know you need `coverage-review`, routing through the front door just adds a step.
- **Returning a menu of five.** A router that hands back five options has routed nothing — it names one primary skill (and at most one follow-up).
