# `audit-test` caps slow runs; throw-first is not a default step

**Status: Accepted (2026-11-25).** From [#258](https://github.com/TzolkinB/skills/issues/258), part of epic #256. Adds to the Safety rule in [ADR-0001](0001-audit-test-proves-by-execution.md). Does not change [ADR-0016](0016-audit-test-reachability-guard.md).

## Context

The issue proposed two cheap helpers, both described as behaviour of mewt (T1, from the 2026-10-22 tool-research passes; not re-checked for this ADR):

1. **Throw first.** Make the covered line throw. If the test still passes, stop; no smaller change is needed.
2. **Stop slow runs.** End a run that takes more than about 2× its normal time.

Before this change `audit-test` had no time limit and no throw step (checked by search of `SKILL.md` and `reference/`). A mutation that loops forever would block the session with the mutation still live in the source.

## Decision

### 1. Slow-run cap: added

Every mutated single-test run is wrapped in a cap of 2× normal time (floor 10 s, 120 s if no normal time is known). The whole process group is killed. A capped run is a hang, not a kill: it never earns 🟢 or 🔴, it records 🟡, and the skill may try one smaller mutation. See [slow-run-cap.md](../../skills/audit-test/reference/slow-run-cap.md).

**Evidence (T3, a demo of the wrapper, not of a model following the skill).** A `node:test` project, mutation `while (true) {}`:

| Run | Result |
|---|---|
| Unmutated, capped | exit 0 |
| Assertion-failing mutation, capped | exit 1 |
| Looping mutation, uncapped | never returns (stopped by hand) |
| Looping mutation, `alarm` + `exec` only | parent killed at the cap, **child kept running at 100% CPU** |
| Looping mutation, process-group kill | exit 124 after 3 s, no process left |

The orphaned child is why the doc requires killing the group. The 2× and 120 s values are starting points, not measured.

### 2. Throw-first: declined as a default step

Throw-first only proves the test touches the code. It cannot show that an assertion is weak. So it does not replace the careful mutation, and the run count is worse:

| Test is | Today | With throw-first |
|---|---|---|
| Solid | 1 run (careful mutation) | 2 runs (throw, then careful mutation) |
| Hollow | 2 runs (careful, then the reachability probe) | 1 run (throw), but the survival still cannot be called 🔴 |

The last point is the reason. A survived throw is ambiguous: a hollow test or a stale build look the same (see [ADR-0016](0016-audit-test-reachability-guard.md)). It would still need its own liveness evidence before 🔴. The #264 experiment (3 tests, T3) agreed: same verdicts, similar times, no saving shown.

A maximal break is already used where it is useful: as the reachability probe after a survival.

**Revisit if** a run shows several careful tries on a test that a single throw would have cleared.

## Consequences

- A hung mutation can no longer block a session. The cost is a wrapper and a normal-time lookup, with no extra test runs.
- `timeout` is not on a stock Mac, so the doc ships a short Perl wrapper.
- Not shown: how often models follow the cap, and whether 2× is right for slow browser tests. Label: Unexamined until run on an E2E test.

## Inspiration

**mewt** (AGPL-3.0): the ideas "throw on the covered line first" and "stop a run that takes about 2× normal time". Taken from the issue's tool-research notes only. No mewt code or text was read or copied; the wrapper and wording here are our own (CLAUDE.md rule 4).
