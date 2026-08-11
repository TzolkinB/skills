# qa-pass — the orchestrator: one QA read across a branch

> **Agent instructions:** [`skills/qa-pass/SKILL.md`](../skills/qa-pass/SKILL.md) · **Run:** `/qa-pass feature-branch [--sacred=<glob>]`

## What it does

`qa-pass` is the **orchestrator**. It runs no original analysis of its own. It combines the QA skills across a branch — [`test-plan`](./test-plan.md), [`coverage-review`](./coverage-review.md), [`qa-review`](./qa-review.md), [`debug-test`](./debug-test.md) on any failing tests, and [`audit-test`](./audit-test.md) in batch over the changed tests. It reduces their output to a single verdict: 🟢 **PASS** / 🟡 **CAUTION** / 🔴 **FAIL**. Every part serves the same question: do the tests *verify behavior*, or only show green lights? **This is a QA judgment read, not the release gate** — pair it with [`gate`](./gate.md) for the actual ship, canary, or hold decision ([#99](https://github.com/TzolkinB/skills/issues/99)).

The verdict is a categorical judgment, never a numeric score. A confirmed false-confidence finding never earns a PASS verdict. For the paths that matter most — the ones where a hidden gap is not acceptable — you designate `--sacred` globs. These mark the **sacred paths** for this run. A single confirmed finding on a non-sacred path earns a CAUTION verdict, not FAIL. On a sacred path, two things force an **un-overridable FAIL**: a confirmed-hollow test, or an unhandled boundary in that logic. A confirmed-hollow test is one proven, by mutation, to stay green even when the code breaks. Nothing softens this FAIL, even on an otherwise solid branch. The override only fires on confirmed evidence; a reasoned-only (Likely) finding never fires it. `qa-pass` sits above the atomic skills. It is not a peer of them.

## When to use it

- A full-branch QA pass. You want one verdict across the whole branch instead of five separate reports.
- You want the false-confidence audit, coverage, testability, and layer-distribution signals combined into one read, with the critical paths held to a harder bar through `--sacred`.

## When *not* to use it

- **You have one specific question** — is this testable? What is missing? Does this test bite? Run that atomic skill directly, or ask [`qa-compass`](./qa-compass.md) to route you. Running five skills for one answer costs too much.
- **You want the production-risk view or a bug handoff.** [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md) stay out of this chain by design. Call them on their own.

## Prerequisites

Claude Code runs the orchestration itself. `qa-pass` combines the atomic skills, so it inherits their prerequisites. The main one is [`debug-test`](./debug-test.md)'s Playwright tooling, needed only when the branch has a failing test to diagnose. Everything else it runs is local, static analysis, plus [`audit-test`](./audit-test.md)'s surgical mutations on a clean git tree. It adds no network calls beyond the Claude Code session itself.

## Worked example

`qa-pass` takes the output of the other skills, not a single source file, so it has no fixture of its own ([why](../fixtures/README.md)). To watch it in action, run it over a branch that contains the [`audit-test` fixture](../fixtures/audit-test/). Its batch `audit-test` pass flags `"rejects overlapping bookings"` as 🔴 confirmed false-confidence. From there, the verdict moves one of two ways:

- **Non-sacred.** No `--sacred` glob matches the booking code. The confirmed-hollow test holds the branch at **🟡 CAUTION**, not PASS.
- **Sacred.** With `--sacred=src/booking/**`, the same finding fires the override. The verdict becomes an **un-overridable 🔴 FAIL**, and the report names the sacred path that tripped it.

`qa-pass` matches sacred paths through the pairing between a test and its code. Because of this, marking the *source* glob is enough — you do not also glob the test directory. The report then ranks recommendations as BEFORE SHIPPING, FOLLOW-UP, or NICE TO HAVE.

## Where it fits

`qa-pass` is the QA-synthesis step in the [QA flow](./qa-compass.md), just before the release gate. It sits above the atomic skills, not beside them. It combines [`test-plan`](./test-plan.md), [`coverage-review`](./coverage-review.md), [`qa-review`](./qa-review.md), [`debug-test`](./debug-test.md) (on failing tests), and [`audit-test`](./audit-test.md) (batch) into one verdict, which feeds [`gate`](./gate.md)'s ship, canary, or hold decision. [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md) stay outside the chain by design. If you are not sure whether you want the QA read, the release gate, or a single atomic skill, ask [`qa-compass`](./qa-compass.md) to route you.

## Anti-patterns

- **Treating it as a peer skill or a CI gate.** `qa-pass` is an orchestrator and a QA conversation. The three-state verdict exists so it stays that way, not a pass/fail pipeline gate ([ADR-0002](./adr/0002-sentinel-is-judgment-not-release-evidence.md)).
- **Expecting it to threat-model or file bug reports.** Those questions are separate from this QA read. They stay out of the chain by design.
- **Reading a numeric score into the verdict.** The verdict is categorical. More findings, and more severe ones, push toward FAIL, but no percentage sits behind it.
- **Guessing sacred paths for the user.** The override only fires on `--sacred` globs the user sets. With no `--sacred` flag, no override fires — and that is a valid way to run `qa-pass`.
