# Bind a report to its commit via producer-recorded SHA provenance, not a git-timestamp cross-check

**Status: Accepted (2026-07-25).** Supersedes [ADR-0042](0042-gate-rejected-credibility-state-and-freshness-floor.md)
§3's deferral note, which named a git-timestamp cross-check as "a reasonable next step… deferred" for closing
the report-to-commit binding gap (hostile-review finding #3's residual). On re-examination that next step is
**rejected as the mechanism**; the closure is producer-recorded SHA provenance, deferred to v2. No code changes
in this ADR — it records the direction and retires the timestamp idea before someone builds it.

## Context

ADR-0042 shipped `--max-age`, which caps a suite at `canary` when its report's `producer.startedOn` is more
than a supplied window older than the bundle's own `producedOn`. That closes the "stale leftover `results.json`"
case but leaves the general gap open: **nothing binds a report to the specific `--commit` Gate was told to
gate.** A fresh-looking report regenerated moments before a *different* commit's gate run still passes. ADR-0042
§3 pointed at resolving the commit's own timestamp (`git show -s --format=%cI <commit>`) and comparing it to the
report's `startedOn` as the way to close this.

## Decision

Reject the git-timestamp cross-check. Adopt **producer-recorded SHA provenance** as the closure, deferred to v2.

### Why the timestamp cross-check fails — two timelines

1. **It doesn't even catch the target scenario.** The gap is a *fresh* report regenerated for the wrong commit.
   Such a report has `startedOn ≈ now`, which is ≥ **any** commit's timestamp — so it reads as fresh against a
   commit-timestamp comparison exactly as it does against `--max-age`. Timestamps are blind to it.
2. **The only signal it can give collides with a legitimate workflow.** The reverse direction — "the report
   `startedOn` is *earlier* than the commit's timestamp" — would catch an old leftover report gating a newer
   commit. But the ordinary local workflow is *test the working tree, then commit*, which legitimately produces
   `startedOn < commit-time`. Distinguishing the two needs an operator-supplied grace window with no universal
   default — the same wall `--max-age` already hit (ADR-0042 §3), now with a false-positive on every honest
   pre-commit run instead of a clean opt-in.

Timestamps are a flaky proxy for the real question: *did this report actually run against this commit's code?*

### The mature closure — producer-recorded SHA provenance

Measure that question directly. The **producer** — the Playwright/Cypress ingest adapters and the `audit-test`
emission — records the git SHA it executed against (`git rev-parse HEAD` at test time, plus a dirty-worktree
flag) *into* the report. Gate cross-checks that recorded SHA against `--commit`:

- **Recorded SHA ≠ `--commit`** → cap at `canary` (the report is about a different commit than the one gated).
- **No recorded SHA** → unaffected — necessary-not-sufficient, the same discipline as content-addressing
  (ADR-0037 §2) and the examined/executed floors.

This is exact rather than clock-flaky, it actually catches the wrong-commit-fresh-report case (recorded SHA=`D`
≠ gated `C`), and it is the natural maturation of [ADR-0037](0037-gate-evidence-integrity.md)'s "bind the
decision to exact bytes" into "bind the report to the exact commit it ran against" — the in-toto *materials* the
product already gestures at.

### Why v2, not v1

The truth about "what commit did I run against" exists only at the producer, at test time. So the fix is a
producer-side surface — adapter changes + an `audit-test` schema field + a runtime `git rev-parse` in the test
environment — larger, and correctly placed, versus a CLI-side shell-out. It is **not a v1 blocker**: Gate is
advisory (never fails the build) and self-signed (not a third-party trust root), so defeating a motivated
adversary who deliberately gates the wrong commit is outside its honest v1 threat model. What protects v1
trustworthiness is stating the gap plainly and *not* claiming a timestamp check would close it — the opposite
of shipping a flaky check that false-positives honest runs and lets the product claim a binding it lacks.

## Considered options

- **Git-timestamp cross-check in the CLI wrapper** (ADR-0042 §3's deferred next step). Rejected — see the two
  timelines above: blind to the target scenario, and its only real signal false-positives the test-then-commit
  local workflow, needing a defaultless grace window.
- **Producer-recorded SHA provenance.** Chosen, deferred to v2 for the surface-size reason above.

## Consequences

- **The report-to-commit gap stays open through v1, stated plainly** in `docs/roadmap.md` item 3,
  `README.md`'s Roadmap, and `gate/SKILL.md`'s "Report freshness" note — none of which any longer claim a
  git-timestamp check as the closure.
- **`--max-age` (ADR-0042) is unaffected** — it remains the shipped, opt-in freshness floor for the
  stale-leftover case; this ADR only retires the *further* timestamp idea for the distinct commit-binding case.
- **Filed as [#177](https://github.com/TzolkinB/skills/issues/177)**, scoping producer SHA capture across the
  Playwright/Cypress adapters and the `audit-test` emission schema, plus Gate's mismatch-caps-at-`canary`
  cross-check.
