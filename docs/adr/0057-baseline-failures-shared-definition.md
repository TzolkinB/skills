# Baseline failures: one shared definition of "pre-existing", caller supplies the list

**Status: Accepted (2026-11-25).** From [#305](https://github.com/TzolkinB/skills/issues/305), found in a pilot on three branches of TzolkinB/loop-playwright where 9 tests were already red on `master`.

## Context

`/debug-test` could read a pre-existing failure as something to heal. `/qa-pass` had no way to say "these failures also fail on the base branch", so a report had to say it by hand. The issue also named `tdd` (not in this repo) and `/gate` (returned HOLD on #32 only because of the 9 old failures).

## Decision

1. **One shared file** ([baseline-failures](../../skills/shared/baseline-failures.md)) defines the labels: pre-existing, new, flaky, unknown. Both skills read it, so they cannot drift apart.
2. **Pre-existing needs the same error, not just the same name.** A test red for a new reason is new. This closes the fail-open path where an old red test hides a real regression.
3. **The caller supplies the baseline.** `/qa-pass` takes `--known-failures=<file>`. `/debug-test` may run one test once on a detached worktree of the merge-base, never the suite. Skills that read evidence do not start running suites.
4. **Visible, never silent.** The pre-existing count is printed on every report, with an owner per entry. Pre-existing failures do not move a verdict in either direction.
5. **`/gate` is out of this decision.** Gate needs a baseline file tied to a commit, a schema bump, and an answer to whether `ship` can ever carry a failure list. That gets its own ADR. `tdd` is outside this repo.

## Consequences

- Cheaper reads of a branch with a known red base. The wrong "healing a bug you did not cause" path closes.
- A known-failures file can become a dumping ground. Entries without an owner are reported as unowned.
- Normalising red is the main risk. Rule 4 is the guard; the better fix is still to quarantine not-yet-buildable tests in the repo itself.

## Inspiration

None. No other tool's code, text or behaviour was used. Clean-room: n/a.
