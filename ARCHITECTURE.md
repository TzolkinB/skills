# Architecture & Decisions

This document exists for a reason. A feature list — "this plugin has a dozen skills" — does not show engineering judgment. A working plugin does not explain itself. This document is the *why* behind this plugin. It is the part that is actually useful on a resume, or in an interview. It is also the part I want to remember myself, six months from now.

## Why Separate Skills, Instead of One Big Prompt

Each skill answers exactly one question. There are thirteen skills, plus the `/qa-pass` orchestrator:

| Skill | Question it answers |
|---|---|
| `test-plan` | What must a team test, before any code exists? |
| `qa-review` | Is this code testable at all? |
| `coverage-review` | Of what is testable, what is actually covered? |
| `audit-test` | If the code behind this *passing* test breaks, does the test fail? |
| `prune-tests` | Which existing tests cost more than they protect? |
| `threat-model` | If this change is wrong, what breaks in production, and does anyone notice? |
| `debug-test` | When a Playwright test fails, what is the root cause, and how do I fix it? |
| `bug-report` | How do I hand this off cleanly? |
| `e2e-impact` | Which E2E specs does this diff plausibly hit? |
| `audit-orchestrator` | Which tool actually *proves* this suspicious passing test? |
| `contract-guard` | Does the backend response the frontend depends on still match its published contract? |
| `qa-compass` | Given a QA situation, which tool, mine or an external one, is the right choice? |
| `qa-pass` | What is the net QA verdict, across all of the above? |
| `gate` | Given this PR's E2E results and audit-test evidence, is it safe to ship? |

`threat-model` and `bug-report` are real skills, core to this plugin, but independent of it. Neither sits in the `/qa-pass` chain, on purpose. Each answers a question separate from shippability: what breaks in production, or how to hand off a bug. `e2e-impact`, `audit-orchestrator`, and `contract-guard` are likewise standalone, and outside the chain — the newer, app-driven, E2E-focused additions. `qa-compass` is a router, not a chain member. It points at whichever tool fits a situation, one of this plugin's own skills or an external tool. `gate` sits downstream of the whole chain (see below).

One large prompt blurs these questions together. It produces one wall of text, instead of a set of separate commands. Run `/qa-review` in the middle of a code review. Run `/debug-test` when a Playwright test fails right now. Splitting the skills apart keeps each one sharp for its one job. The skills also compose, instead of overlapping. This is the same reason good code keeps one function from validating, saving, and sending email all at once: single responsibility applies to prompts, too.

## Why `debug-test` Orchestrates, Instead of Just Analyzing

`debug-test` differs from the other skills. It does not just read and reason. It runs the test. It routes a UI, locator, or timing failure to the Playwright healer. It escalates a logic failure to Matt Pocock's diagnosing-bugs workflow. This split is deliberate. A failing Playwright test falls into three distinct categories: a selector or timing problem, a logic problem, or a flaky result. Each category needs a fundamentally different tool. A single analysis pass does not handle all three well. That pass either misses the healer's auto-fix, or it applies heavy debugging machinery to a broken locator — something the healer fixes in seconds.

This creates a tradeoff. `debug-test` now depends externally on the Playwright healer agent and on diagnosing-bugs. Both must be available for the escalation paths to work. The fast-heuristics layer, Step 2, is self-contained. It catches most common failures without any external dependency.

## Why `/qa-pass` Orchestrates the Other Skills

Several independent skills solve independent problems. But shipping a branch requires all of them at once, synthesized into one decision. `/qa-pass` is the only skill that does no original analysis of its own. It calls the others in its chain — `test-plan`, `coverage-review`, `qa-review`, `debug-test`, and `audit-test` in batch mode over the changed tests. It reduces their output to one verdict. This is deliberate layering: atomic skills for daily use, and one orchestrator for the "am I safe to merge" moment. `/qa-pass` is not a peer of the skills it runs.

`audit-test` joined the chain on purpose. Without `audit-test`, a branch sometimes passes `/qa-pass` while its "passing" tests prove nothing — the exact false confidence the suite exists to expose. `audit-test` runs as a batch False-Confidence Audit over the changed tests. Its 🔴 *confirmed* findings move the verdict (see the sacred-path override, below).

The alternative is teaching every skill to also produce a verdict. That approach produces several different opinions about whether to ship, with no single source of truth. Centralizing that judgment in one place is worth the extra layer of indirection.

The verdict from `/qa-pass` is QA *judgment*, not release evidence ([ADR-0002](docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)). `/qa-pass` never runs your E2E suite, and never claims to. That job belongs to `gate`, a separate skill downstream of `/qa-pass`, never inside its chain. `gate` ingests a PR's actual Playwright or Cypress results, plus `audit-test`'s evidence, and derives an advisory ship, canary, or hold decision. Gate owns the ship verdict; `/qa-pass` does not.

## Why a 3-State Verdict (PASS / CAUTION / FAIL), Instead of Pass/Fail

A binary pass/fail either ships something that is not ready, or blocks a change over a `LOW`-severity nit. Real QA judgment is not binary. Most branches are "shippable with known gaps" — a real, distinct state, different from "solid" and from "broken." CAUTION exists so the report stays honest about risk, without becoming a blocker for every minor gap. This mirrors the actual conversation a PR review has, not a CI gate.

The one deliberate exception is the **sacred-path override** ([ADR-0007](docs/adr/0007-sentinel-sacred-path-fail-override.md)). On a path the user marks as sacred (`--sacred=<glob>`), "shippable with notes" is the wrong answer to a test *confirmed* to guard nothing. There, and only there, `/qa-pass` drops the gradient and issues an un-overridable FAIL. This borrows J-Rig's binary rigor, for the paths that earn it, while keeping CAUTION everywhere else. It does not reintroduce a numeric score: the override changes *which* categorical state the verdict reaches, not how the verdict is expressed ([ADR-0002](docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)).

## Why `coverage-review` Flags Checks That Never Meaningfully Fail, Not Just Missing Ones

`expect(result).toBeDefined()` passes CI, and looks like a real test. It is not a real test — it never fails in any way that matters. A line-coverage tool does not catch this problem: it sees only that the line executed, not that anything was verified. This was the real frustration that started the whole project: AI-generated tests that are syntactically real, but semantically empty. `coverage-review` treats a check that never meaningfully fails as equal to a missing check, because functionally, it is one.

## Why `qa-review` Is a Separate Concern from General Code Quality

Testability and code quality are independent concerns. Ugly code is sometimes perfectly testable. Clean code sometimes hides a `Date.now()` that makes every test flaky. Folding testability into a general code review means it competes for attention with style and structure, and usually loses. Giving testability its own skill means a reader explicitly asks "is this testable," every time, instead of leaving it as an afterthought.

## Tradeoffs, Honestly

- **Execution is scoped, not blanket.** Most skills read and reason without running your suite. The report is only as good as what the skill reads. A few skills deliberately cross that line, where reasoning alone does not produce ground truth: `debug-test` runs the failing test to route it. `audit-test` applies a targeted mutation, and runs a single test, to *prove* false confidence rather than assert it (see [ADR-0001](docs/adr/0001-audit-test-proves-by-execution.md)). `prune-tests --apply` edits or deletes flagged tests, then reruns the affected tests to confirm (see [ADR-0003](docs/adr/0003-prune-tests-proposes-before-deleting.md)). All of this execution stays surgical and gated, on a clean git tree. It is always revertible, and never a full suite or a mutation campaign.
- **Judgment over rules.** A severity label — HIGH, MEDIUM, or LOW — is inherently subjective. This is deliberate. A rigid rules engine is either too strict to be useful, or too lax to catch real gaps. The cost: a verdict sometimes varies from one run to the next.
- **English output, not structured data, except at the Gate.** `/qa-pass` and the atomic skills report in markdown — good for reading in a PR or in Slack, not for piping into other tooling. `gate` is the exception. It emits a schema-versioned, content-addressed JSON bundle, optionally DSSE-signed, alongside its markdown report. This bundle is purpose-built for the "am I safe to ship" moment, where a machine-readable decision earns its place.

## What Changes If This Becomes a Team Tool

A team tool needs a verdict configurable per team, by risk tolerance. `gate` already emits structured JSON that a CI step is able to consume. But by design, `gate` always exits 0 — it is advisory, and never aborts the build ([ADR-0038](docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md): the design declines verification, rather than deferring it). A hard CI gate is a thin wrapper that reads that JSON — not a change to this suite. (`coverage-review` already *reads* real coverage output, when a project emits it, and falls back to static inference otherwise — see [ADR-0011](docs/adr/0011-coverage-review-prefers-real-instrumentation.md). So the remaining team-tool gap there is generating coverage on demand, not consuming it.)
