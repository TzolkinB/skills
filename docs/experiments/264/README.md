# Experiment #264 working files (temporary)

> **DELETE THIS FOLDER when issue [#264](https://github.com/TzolkinB/skills/issues/264) is closed.**
> These are raw working reports kept so the work survives while it is in progress. The lasting
> results belong in `docs/orchestration-map.md` (evidence ledger) and in the `audit-test` docs, not here.

What it tests: do passing tests written by an AI test writer (the Playwright generator) actually fail
when the code is broken? The tool used is this repo's `audit-test`, followed by hand.

| File | What it is |
|---|---|
| `round1-report.md` | Round 1: 8 tests from the Memory app (written by the generator, later edited by the owner). 8 of 8 failed as they should. |
| `round2-preregistration.md` | Round 2 plan, written before any test was read: commit, method, what to record. |
| `round2-blind-report.md` | Round 2 (blind): 8 new unedited generator tests. 2 failed before any change; 6 of 6 audited failed as they should. |

A follow-up probe (not in a report file; see the #264 comments) found one hollow assertion in two of the
round 2 tests: the final "click after the game ends, scores unchanged" line passes even with the guards removed.

All runs were done on a copy of the app, on a dev server, with one targeted break per test. Times and counts are
the auditor's own. Treat them as a small, single-app sample. Open work is listed in the #264 issue body.
