# qa-pass — the orchestrator: one QA read across a branch

> **Agent instructions:** [`skills/qa-pass/SKILL.md`](../skills/qa-pass/SKILL.md)
>
> **Run:** `/qa-pass feature-branch [--sacred=<glob>]`

## What it does

`qa-pass` is the **orchestrator**. It runs no original analysis of its own. It combines the QA skills across a branch — [`test-plan`](./test-plan.md), [`coverage-review`](./coverage-review.md), [`qa-review`](./qa-review.md), [`debug-test`](./debug-test.md) on any failing tests, and [`audit-test`](./audit-test.md) in batch over the changed tests. It reduces their output to a single verdict: 🟢 **PASS** / 🟡 **CAUTION** / 🔴 **FAIL**. Every part serves the same question: do the tests _verify behavior_, or only show green lights? **This is a QA judgment read, not the release gate** — pair it with [`gate`](./gate.md) for the actual ship, canary, or hold decision ([#99](https://github.com/TzolkinB/skills/issues/99)).

The verdict is a categorical judgment, never a numeric score. A confirmed false-confidence finding never earns a PASS verdict. For the paths that matter most — the ones where a hidden gap is not acceptable — you designate `--sacred` globs. These mark the **sacred paths** for this run. A single confirmed finding on a non-sacred path earns a CAUTION verdict, not FAIL. On a sacred path, two things force an **un-overridable FAIL**: a confirmed-hollow test, or an unhandled boundary in that logic. A confirmed-hollow test is one proven, by mutation, to stay green even when the code breaks. Nothing softens this FAIL, even on an otherwise solid branch. The override only fires on confirmed evidence; a reasoned-only (Likely) finding never fires it. `qa-pass` sits above the individual skills. It is not a peer of them.

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| You want one verdict across a whole branch, not five separate reports | **`/qa-pass feature-branch`** — this page |
| You want the false-confidence audit, coverage, testability, and layer-distribution signals combined, with the critical paths held to a harder bar | **`/qa-pass --sacred=<glob>`** — this page |
| You have one specific question — is this testable? What's missing? Does this test fail when the code breaks? | Run that individual skill directly, or ask [`qa-compass`](./qa-compass.md) to route you — running five skills for one answer costs too much |
| You want the production-risk view, or a bug handoff | [`threat-model`](./threat-model.md) or [`bug-report`](./bug-report.md) — both stay out of this chain by design |

## Prerequisites

Claude Code runs the orchestration itself. `qa-pass` combines the individual skills, so it inherits their prerequisites. The main one is [`debug-test`](./debug-test.md)'s Playwright tooling, needed only when the branch has a failing test to diagnose. Everything else it runs is local, static analysis, plus [`audit-test`](./audit-test.md)'s surgical mutations on a clean git tree. It adds no network calls beyond the Claude Code session itself.

## Worked example

`qa-pass` takes the output of the other skills, not a single source file, so it has no fixture of its own ([why](../fixtures/README.md)). To watch it in action, run it over a branch that contains the [`audit-test` fixture](../fixtures/audit-test/). Its batch `audit-test` pass flags `"rejects overlapping bookings"` as 🔴 confirmed false-confidence. From there, the verdict moves one of two ways:

- **Non-sacred.** No `--sacred` glob matches the booking code. The confirmed-hollow test holds the branch at **🟡 CAUTION**, not PASS.
- **Sacred.** With `--sacred=src/booking/**`, the same finding fires the override. The verdict becomes an **un-overridable 🔴 FAIL**, and the report names the sacred path that tripped it.

`qa-pass` matches sacred paths through the pairing between a test and its code. Because of this, marking the _source_ glob is enough — you do not also glob the test directory. The report then ranks recommendations as BEFORE SHIPPING, FOLLOW-UP, or NICE TO HAVE.

## It's Working If

- The verdict is always 🟢 PASS / 🟡 CAUTION / 🔴 FAIL — never a numeric score.
- A confirmed false-confidence finding never earns a PASS verdict.
- A single confirmed finding on a non-sacred path caps the verdict at CAUTION, not FAIL.
- On a sacred path, a confirmed-hollow test or an unhandled boundary forces an un-overridable FAIL — nothing softens it, even on an otherwise solid branch.
- The override only fires on confirmed evidence — a reasoned-only (Likely) finding never fires it.
- Sacred-path matching pairs a test with its code, so globbing the source path is enough — you never also need to glob the test directory.

If `qa-pass` ever fires the sacred override on Likely-only evidence, or returns a numeric score instead of a categorical verdict, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does `qa-pass` replace the release gate?**
A: No. It is a QA judgment read, not the ship/canary/hold decision — pair it with [`gate`](./gate.md) for that call ([#99](https://github.com/TzolkinB/skills/issues/99)).

**Q: What happens if I don't pass `--sacred`?**
A: No path is sacred, so the override never fires. Findings still move the verdict along the normal PASS/CAUTION/FAIL gradient — running `qa-pass` with no `--sacred` flag is a valid way to use it.

**Q: Does a 🟡 Likely finding ever force a FAIL?**
A: No. Reasoning-only findings can pull a verdict down to CAUTION, but only a 🔴 Confirmed finding — one where a mutation actually ran and the test stayed green — can fire the sacred-path override.

**Q: Do I need to glob both the source file and its test?**
A: No. `qa-pass` matches sacred paths through the pairing between a test and the code it exercises, so marking the source glob alone is enough.

**Q: What if the False-Confidence Audit itself can't run — no recognized test files, for example?**
A: `qa-pass` reports it as INCONCLUSIVE and caps the verdict at CAUTION — never a clean PASS. The audit is the check the verdict leans on most, so if it never ran, the verdict says so instead of dressing up the rest of the report as confirmed-solid ([ADR-0014](./adr/0014-sacred-path-integrity-discovery-fails-loud.md)).

## Where it fits

`qa-pass` is the QA-synthesis step in the [QA flow](./qa-compass.md), just before the release gate. It sits above the atomic skills, not beside them. It combines [`test-plan`](./test-plan.md), [`coverage-review`](./coverage-review.md), [`qa-review`](./qa-review.md), [`debug-test`](./debug-test.md) (on failing tests), and [`audit-test`](./audit-test.md) (batch) into one verdict, which feeds [`gate`](./gate.md)'s ship, canary, or hold decision. [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md) stay outside the chain by design. If you are not sure whether you want the QA read, the release gate, or a single individual skill, ask [`qa-compass`](./qa-compass.md) to route you.

## Anti-patterns

- **Treating it as a peer skill or a CI gate.** `qa-pass` is an orchestrator and a QA conversation. The three-state verdict exists so it stays that way, not a pass/fail pipeline gate ([ADR-0002](./adr/0002-sentinel-is-judgment-not-release-evidence.md)).
- **Expecting it to threat-model or file bug reports.** Those questions are separate from this QA read. They stay out of the chain by design.
- **Reading a numeric score into the verdict.** The verdict is categorical. More findings, and more severe ones, push toward FAIL, but no percentage sits behind it.
- **Guessing sacred paths for the user.** The override only fires on `--sacred` globs the user sets. With no `--sacred` flag, no override fires — and that is a valid way to run `qa-pass`.
