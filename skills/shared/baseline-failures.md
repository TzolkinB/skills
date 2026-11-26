# Baseline failures: "pre-existing" means one thing

Shared by `/debug-test` and `/qa-pass` ([#305](https://github.com/TzolkinB/skills/issues/305), [ADR-0057](../../docs/adr/0057-baseline-failures-shared-definition.md)). A test that is already red on the base branch is not a failure your change caused. These rules say how to tell the two apart.

## What counts as pre-existing

A failing test is **pre-existing** only if both are true:

1. It fails on the **base commit** (the merge-base of this branch and the default branch).
2. It fails there for the **same reason**. Compare the test file, the full test title, the browser or project name, and the first line of the error message.

Same title but a different error is **new**. A test that was red for one reason and is now red for another is hiding a regression. Never match on the test name alone.

| Result on the base commit | Label |
|---|---|
| Fails, same signature | **pre-existing** |
| Fails, different signature | **new** (say what changed) |
| Passes | **new** (a regression from this change) |
| Mixed pass and fail across repeats | **flaky** (route to `/debug-test --flake`) |
| Could not be run | **unknown** (never guess; treat as new) |

## Where the baseline comes from

- **The caller supplies it.** A known-failures file, or a list in the prompt. Each entry has a test title, an error first line, and an owner (an issue link or a name). An entry with no owner is reported as **unowned**.
- **`/debug-test` may run one test once** on the base commit (see its [baseline check](../debug-test/reference/baseline-check.md)). Nothing else here runs a suite.
- Gate is not covered by this file. Gate stays "ingest only" until its own decision.

## Never hide the red

A red base branch is a problem to fix, not a normal state. Every report that uses these rules prints the pre-existing count on its own line, even when it is zero, and names the owner of each entry. A pre-existing failure never lowers a verdict and never raises one. It stays visible.
