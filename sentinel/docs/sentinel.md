# sentinel — the orchestrator: one shippability verdict for a branch

> **Agent instructions:** [`skills/sentinel/SKILL.md`](../skills/sentinel/SKILL.md) · **Run:** `/sentinel feature-branch [--sacred=<glob>]`

## What it does

`sentinel` is the **orchestrator**, and it's the one skill that does no original analysis of its own. It composes the shippability skills across a branch — [`test-plan`](./test-plan.md), [`coverage-review`](./coverage-review.md), [`qa-review`](./qa-review.md), [`debug-test`](./debug-test.md) on any failing tests, and [`audit-test`](./audit-test.md) in batch over the changed tests — and reduces their output to a single decision: 🟢 **PASS** / 🟡 **CAUTION** / 🔴 **FAIL**. The question every part serves is the same one: do the tests *verify behavior*, or just show green lights?

The verdict is a categorical judgment, never a numeric score. A proven false-confidence finding can't be PASS; a lone non-sacred one is CAUTION, not FAIL. For the paths that actually matter, you designate `--sacred` globs and a *proven*-hollow test there — or an unhandled boundary in that logic — fires an **un-overridable FAIL** that an otherwise-solid branch can't soften. It's a layer *above* the atomic skills, not a peer of them.

## When to use it

- The merge/ship gate — you want a full quality pass on a branch and one verdict instead of five separate reports.
- You want the false-confidence audit, coverage, testability, and layer-distribution signals synthesized, with the critical paths held to a harder bar via `--sacred`.

## When *not* to use it

- **You have one specific question** (is this testable? what's missing? does this test bite?) → run that atomic skill directly, or ask [`ask-sentinel`](./ask-sentinel.md) to route you. Orchestrating five skills for one answer is overkill.
- **You want the production-risk view or a bug handoff** → [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md) are deliberately *not* in the chain; call them on their own.

## Worked example

`sentinel` consumes the *output of the other skills* rather than a single source file, so it has no fixture of its own ([why](../fixtures/README.md)) — but you can watch it in action by running it over a branch containing the [`audit-test` fixture](../fixtures/audit-test/). When its batch `audit-test` pass flags `"rejects overlapping bookings"` as 🔴 proven false-confidence, the verdict moves categorically:

- **Non-sacred** (no `--sacred` glob matches the booking code) → the proven-hollow test holds the branch at **🟡 CAUTION** — shippable with notes, not PASS.
- **Sacred** (`--sacred=src/booking/**`) → the same finding fires the override into an **un-overridable 🔴 FAIL**, naming the sacred path that tripped it.

Because sacred paths are matched through the test↔code pairing, designating the *source* glob is enough to make a hollow test of it sacred — you don't have to also glob the test directory. The report then prioritizes recommendations as BEFORE SHIPPING / FOLLOW-UP / NICE TO HAVE.

## Anti-patterns

- **Treating it as a peer skill or a CI gate.** It's an orchestrator and a QA conversation; the 3-state verdict exists precisely so it isn't a binary pipeline gate ([ADR-0002](./adr/0002-sentinel-is-judgment-not-release-evidence.md)).
- **Expecting it to threat-model or file bugs.** Those questions are orthogonal to shippability and out of the chain by design.
- **Reading a numeric score into the verdict.** It's categorical; more and higher-severity findings push toward FAIL, but there's no percentage.
- **Guessing sacred paths for the user.** The override only fires on `--sacred` globs the user designates; no `--sacred`, no override — and that's a valid way to run.
