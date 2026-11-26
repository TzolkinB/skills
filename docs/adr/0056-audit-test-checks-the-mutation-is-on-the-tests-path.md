# `audit-test` checks the mutation is on the test's path, and that a kill came from the target

**Status: Accepted (2026-11-25).** From [#275](https://github.com/TzolkinB/skills/issues/275). Adds to, and does
not replace, [ADR-0016](0016-audit-test-reachability-guard.md) (the harness-reachability check).

## Context

In the first real run, on Mosaic PR #129 (2026-10-27), one mutation landed in the `GET` handler while the test
called `POST`. The agent noticed and redid it. Nothing in the skill required the check.

The reachability check (ADR-0016) does not cover this. It applies a maximal mutation "to the same code the test
asserts on" and proves the harness is source-live. A survival from a change in the wrong handler would still pass
it, because the harness *is* live and the probe *is* caught. So a wrong-place mutation can reach a 🔴. The reverse
also holds: a change that breaks module loading can make a test fail for a reason unrelated to its assertion, and
that reads as a 🟢. Both outcomes feed Gate.

## Decision

1. **Before a mutation runs**, name the test's entry call, show the line to change and its enclosing function,
   and confirm that function is on the path the test calls. Off the path is rejected, not run, and not counted
   as a run. A mutation suggested by someone else gets the same check.
2. **After it runs**, a 🟢 needs an assertion failure (or a timeout on expected UI state) in the target test, not
   a syntax, compile or import error or a failure in another test. If the reason for a failure is unclear, run the
   single test once on unmutated code; a test that is already red gets neither 🟢 nor 🔴.
3. **A 🔴 needs both checks** (this one and ADR-0016). Failing either is 🟡.
4. **Cost:** one read per mutation, and an extra run only when the failure reason is unclear. No new schema field;
   the result goes in the finding's Proof line.

## Consequences

- The path check is a model-read step, not a call-graph tool. It can be wrong on dynamic dispatch or heavy
  indirection; the rule then says to fall back to 🟡 rather than guess.
- Gate and the emission are unchanged. Truthful counts matter more because fewer wrong-place runs reach them.
- Reversible: remove `reference/mutation-path-check.md` and its three links in `SKILL.md`.

## Alternatives considered

- **Always run the test on unmutated code first.** Rejected as the default: it adds a run per deep-audited test,
  which is costly for e2e. It stays as the fallback in decision 2.
- **Fold it into the reachability check.** Rejected: that check is about the harness, this one is about where the
  change is. Keeping them apart keeps each short and lets a 🟡 name which one failed.

## Clean-room note

No other tool's code or text was used; no tool is cited.
