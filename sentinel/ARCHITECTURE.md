# Architecture & Decisions

This doc exists because a feature list ("Sentinel has nine skills") doesn't show engineering judgment, and a working plugin doesn't explain itself. This is the *why* behind Sentinel — the part that's actually useful on a resume or in an interview, and the part I'd want to remember myself six months from now.

## Why separate skills instead of one big prompt

Each skill answers exactly one question — eight atomic skills plus one orchestrator:

| Skill | Question it answers |
|---|---|
| `test-plan` | What *should* be tested, before any code exists? |
| `qa-review` | Is this code testable at all? |
| `coverage-review` | Of what's testable, what's actually covered? |
| `audit-test` | Would this *passing* test fail if the code it covers broke? |
| `prune-tests` | Which existing tests cost more than they protect? |
| `threat-model` | If this change is wrong, what breaks in production and would anyone notice? |
| `debug-test` | When a Playwright test is failing — what's the root cause and how do I fix it? |
| `bug-report` | How do I hand this off cleanly? |
| `sentinel` | What's the net verdict across all of the above? |

`threat-model` and `bug-report` are core-but-independent — real skills, but deliberately *not* in the `/sentinel` chain, because they answer questions (what breaks in production; how to hand off) orthogonal to shippability.

A single mega-prompt would blur these questions together — you'd get one wall of text instead of being able to run `/qa-review` mid-code-review and `/debug-test` when a Playwright test is actively failing. Splitting them means each one stays sharp for its one job, and they compose instead of overlapping. This is the same reason you don't write one function that validates, saves, and emails — single responsibility applies to prompts too.

## Why `debug-test` orchestrates instead of just analyzing

`debug-test` is different from the other skills — it doesn't just read and reason. It runs the test, routes to the Playwright healer for UI/locator/timing failures, and escalates to Matt Pocock's diagnosing-bugs workflow for logic failures. This is deliberate: a failing Playwright test has three distinct failure categories (selector/timing, logic, flakiness) that require fundamentally different tools. Handling all three with one analysis pass would mean either missing healer's auto-fix capability or applying heavy debugging machinery to a broken locator that healer would fix in seconds.

The tradeoff: `debug-test` now has an external dependency on the Playwright healer agent and on diagnosing-bugs. Those must be available for the escalation paths to work. The fast-heuristics layer (Step 2) is self-contained and catches the majority of common failures without any external dependency.

## Why `/sentinel` orchestrates instead of everything being flat

Several independent skills solve independent problems, but shipping a branch requires them at once, synthesized into one decision. `/sentinel` is the only skill that doesn't do original analysis — it calls the others in its chain (`test-plan`, `coverage-review`, `qa-review`, `debug-test`, and `audit-test` in batch over the changed tests) and reduces their output to a verdict. That's a deliberate layering: atomic skills for daily use, one orchestrator for the "am I safe to merge" moment. It is not a peer of the skills it runs.

`audit-test` joined the chain deliberately: without it, a branch could pass Sentinel while its "passing" tests prove nothing — the exact false confidence the suite exists to expose. It runs as a batch False-Confidence Audit over the changed tests, and its 🔴 *proven* findings move the verdict (see the sacred-path override below).

The alternative — teaching every skill to also produce a verdict — would mean several different opinions about shippability with no single source of truth. Centralizing that judgment in one place was worth the extra layer of indirection.

## Why a 3-state verdict (PASS / CAUTION / FAIL) instead of pass/fail

Binary pass/fail either ships you something that isn't ready, or blocks you over a `LOW`-severity nit. Real QA judgment isn't binary — most branches are "shippable with known gaps," which is a real, distinct state from "solid" and from "broken." CAUTION exists so the report can be honest about risk without becoming a blocker for every minor gap. This mirrors the actual conversation you'd have in a PR review, not a CI gate.

The one deliberate exception is the **sacred-path override** ([ADR-0007](docs/adr/0007-sentinel-sacred-path-fail-override.md)). On paths the user marks as sacred (`--sacred=<glob>`), "shippable with notes" is the wrong answer to a test that's been *proven* to guard nothing — so there, and only there, Sentinel drops the gradient and issues an un-overridable FAIL. This borrows J-Rig's binary rigor for the paths that earn it while keeping CAUTION everywhere else. It doesn't reintroduce numeric scoring: the override changes *which* categorical state is reached, not how it's expressed ([ADR-0002](docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)).

## Why coverage-review flags loose assertions, not just missing ones

`expect(result).toBeDefined()` passes CI and looks like a real test. It isn't — it can't fail in any way that matters. Line-coverage tools don't catch this; they only see that the line executed, not that anything was verified. This was the actual frustration that started the whole project: AI-generated tests that are syntactically real but semantically empty. `coverage-review` treats a loose assertion as equivalent to a missing one, because functionally it is.

## Why `qa-review` is a separate concern from general code quality

Testability and code quality are orthogonal — ugly code can be perfectly testable, and clean code can hide a `Date.now()` that makes every test flaky. Folding testability into a general code review means it competes for attention with style and structure and usually loses. Giving it its own skill means "can I test this" gets asked explicitly, every time, instead of being an afterthought.

## Tradeoffs, honestly

- **Execution is scoped, not blanket.** Most skills read and reason without running your suite — the report is only as good as what gets read. A few skills deliberately cross that line where reasoning alone can't produce ground truth: `debug-test` runs the failing test to route it, `audit-test` applies a targeted mutation and runs a single test to *prove* false confidence rather than assert it (see [ADR-0001](docs/adr/0001-audit-test-proves-by-execution.md)), and `prune-tests --apply` edits or deletes flagged tests and reruns the affected ones to confirm (see [ADR-0003](docs/adr/0003-prune-tests-proposes-before-deleting.md)). All of it stays surgical and gated — on a clean git tree, always revertible, never a full suite or mutation campaign.
- **Judgment over rules.** Severity labels (HIGH/MEDIUM/LOW) are inherently subjective. This is deliberate — a rigid rules engine would either be too strict to be useful or too lax to catch real gaps. The cost is that verdicts can vary run to run.
- **English output, not structured data.** Reports are markdown, not JSON. Good for reading in a PR or Slack, not (yet) for piping into other tooling. Fine for a personal framework; would need rework for team-wide CI integration.

## What I'd change if this became a team tool instead of a personal one

Make verdicts configurable per-team risk tolerance, and emit structured output alongside the markdown report so it can gate CI, not just inform a human. (`coverage-review` now already *reads* real coverage output when a project emits it, falling back to static inference otherwise — see [ADR-0011](docs/adr/0011-coverage-review-prefers-real-instrumentation.md) — so the remaining team-tool gap is generating coverage on demand, not consuming it.)
