# Architecture & Decisions

This doc exists because a feature list ("Sentinel has 6 skills") doesn't show engineering judgment, and a working plugin doesn't explain itself. This is the *why* behind Sentinel — the part that's actually useful on a resume or in an interview, and the part I'd want to remember myself six months from now.

## Why 6 separate skills instead of one big prompt

Each skill answers exactly one question:

| Skill | Question it answers |
|---|---|
| `test-plan` | What *should* be tested, before any code exists? |
| `qa-review` | Is this code testable at all? |
| `coverage-review` | Of what's testable, what's actually covered? |
| `debug-test` | When a Playwright test is failing — what's the root cause and how do I fix it? |
| `bug-report` | How do I hand this off cleanly? |
| `sentinel` | What's the net verdict across all of the above? |

A single mega-prompt would blur these questions together — you'd get one wall of text instead of being able to run `/qa-review` mid-code-review and `/debug-test` when a Playwright test is actively failing. Splitting them means each one stays sharp for its one job, and they compose instead of overlapping. This is the same reason you don't write one function that validates, saves, and emails — single responsibility applies to prompts too.

## Why `debug-test` orchestrates instead of just analyzing

`debug-test` is different from the other skills — it doesn't just read and reason. It runs the test, routes to the Playwright healer for UI/locator/timing failures, and escalates to Matt Pocock's diagnosing-bugs workflow for logic failures. This is deliberate: a failing Playwright test has three distinct failure categories (selector/timing, logic, flakiness) that require fundamentally different tools. Handling all three with one analysis pass would mean either missing healer's auto-fix capability or applying heavy debugging machinery to a broken locator that healer would fix in seconds.

The tradeoff: `debug-test` now has an external dependency on the Playwright healer agent and on diagnosing-bugs. Those must be available for the escalation paths to work. The fast-heuristics layer (Step 2) is self-contained and catches the majority of common failures without any external dependency.

## Why `/sentinel` orchestrates instead of everything being flat

Five independent skills solve five independent problems, but shipping a branch requires all five at once, synthesized into one decision. `/sentinel` is the only skill that doesn't do original analysis — it calls the other four and reduces their output to a verdict. That's a deliberate layering: atomic skills for daily use, one orchestrator for the "am I safe to merge" moment.

The alternative — teaching every skill to also produce a verdict — would mean five different opinions about shippability with no single source of truth. Centralizing that judgment in one place was worth the extra layer of indirection.

## Why a 3-state verdict (PASS / CAUTION / FAIL) instead of pass/fail

Binary pass/fail either ships you something that isn't ready, or blocks you over a `LOW`-severity nit. Real QA judgment isn't binary — most branches are "shippable with known gaps," which is a real, distinct state from "solid" and from "broken." CAUTION exists so the report can be honest about risk without becoming a blocker for every minor gap. This mirrors the actual conversation you'd have in a PR review, not a CI gate.

## Why coverage-review flags loose assertions, not just missing ones

`expect(result).toBeDefined()` passes CI and looks like a real test. It isn't — it can't fail in any way that matters. Line-coverage tools don't catch this; they only see that the line executed, not that anything was verified. This was the actual frustration that started the whole project: AI-generated tests that are syntactically real but semantically empty. `coverage-review` treats a loose assertion as equivalent to a missing one, because functionally it is.

## Why `qa-review` is a separate concern from general code quality

Testability and code quality are orthogonal — ugly code can be perfectly testable, and clean code can hide a `Date.now()` that makes every test flaky. Folding testability into a general code review means it competes for attention with style and structure and usually loses. Giving it its own skill means "can I test this" gets asked explicitly, every time, instead of being an afterthought.

## Tradeoffs, honestly

- **No automated tool execution.** Every skill reads and reasons, but none of them run your actual test suite or linter. That's a conscious scope limit — plugging in real execution (via `Bash`) is the natural next step, but it also means the report is only as good as what gets read, not what gets run.
- **Judgment over rules.** Severity labels (HIGH/MEDIUM/LOW) are inherently subjective. This is deliberate — a rigid rules engine would either be too strict to be useful or too lax to catch real gaps. The cost is that verdicts can vary run to run.
- **English output, not structured data.** Reports are markdown, not JSON. Good for reading in a PR or Slack, not (yet) for piping into other tooling. Fine for a personal framework; would need rework for team-wide CI integration.

## What I'd change if this became a team tool instead of a personal one

Add real test-runner integration (so `coverage-review` reads actual coverage output, not just static analysis), make verdicts configurable per-team risk tolerance, and emit structured output alongside the markdown report so it can gate CI, not just inform a human.
