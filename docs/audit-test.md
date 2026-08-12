# audit-test — proves whether a passing test fails when the code breaks

> **Agent instructions:** [`skills/audit-test/SKILL.md`](../skills/audit-test/SKILL.md)
>
> **Run:** `/audit-test test.spec.js code.js`

## What it does

`audit-test` checks a _passing_ test and asks the sharpest question about the tests you already have: **does it fail when the code it covers breaks?** If it does not fail, that is false confidence. It looks like protection, but it guards nothing.

Here is the trap audit-test avoids. AI reasoning about a test sometimes goes wrong, in exactly the same way the test itself is wrong. So audit-test does not stop at reasoning. For a suspect test, audit-test applies the mutation most likely to break the code. It runs just that one test and reports what actually happened. Each finding gets a label: **Confirmed** (a mutation ran and the test stayed green) or **Likely** (reasoning only, because the code did not run). It never invents a score. Whether the mutation matters to real behavior stays a visible human call. This makes audit-test a **challenger, not an oracle**.

audit-test also flags a subtler failure. A mutation alone does not show this failure: a **baseline-lock** (⚠️). This is a _live_ assertion edited to accept a regression. It is the mark a self-healer leaves when it makes a red test green by rewriting the expected value. The assertion still fails against a mutation, so audit-test marks it 🟢. But it checks the _wrong_ value, and it rejects the real fix. audit-test raises this finding from the assertion diff (in `--changed` mode), or from an in-code source of truth that the code now contradicts. A human then confirms the intended value ([ADR-0017](./adr/0017-audit-test-baseline-lock-suspected.md)).

## When to use it

- A test is green and you do not trust it. You want proof that it catches a real bug.
- You review a PR's tests, or one suspicious test, and you want a concrete fix, not a number.
- Run it as the cheap first pass before a heavyweight [mutation campaign](../GLOSSARY.md#mutation-campaign). Fix what it flags first, before you spend Stryker's minutes-to-hours.

## When _not_ to use it

- **You want the missing cases.** Use [`coverage-review`](./coverage-review.md) instead. audit-test judges tests that already pass; it does not propose new ones.
- **You want to delete or merge tests.** Use [`prune-tests`](./prune-tests.md) instead. A false-confidence test usually guards a real behavior, but poorly. The fix is to strengthen it, not remove it.
- **You want a codebase-wide mutation score.** Use StrykerJS instead. audit-test is the per-test judgment tool, not a suite-health metric ([ADR-0004](./adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)).

## Prerequisites

audit-test needs Claude Code. For a **Confirmed** verdict, it also needs a runnable test environment and a **clean git tree**. The deep audit mutates one source file, runs a single test, and reverts the change immediately. Without a clean tree or a runnable environment, audit-test does not guess — it falls back to a reasoned 🟡 **Likely** verdict.

For a Cypress target, a **Confirmed** verdict also needs single-test isolation: a one-test spec file, or the `@cypress/grep` plugin. Without one of these, `cypress run --spec` runs the whole spec file, not one test, and the verdict falls back to 🟡 **Likely**. audit-test adds no network calls of its own.

## Worked example

Fixture: [`fixtures/audit-test/`](../fixtures/audit-test/) ([expected findings](../fixtures/audit-test/expected-findings.md)).

```
/audit-test fixtures/audit-test/booking.spec.js fixtures/audit-test/booking.js
```

The test is named `"rejects overlapping bookings"` and it is green. But it stubs `findOverlapping` to return `[]`, so the overlap path never runs. It only asserts that the code called `save()`. It never exercises the rejection named in its own title.

The verdict is **🔴 Confirmed false-confidence**. Comment out the overlap guard in `booking.js`, run just this test, and it _still passes_ — the execution proof. The taxonomy label is _overmocked / interaction-only_. The finding also matches _focal-unit-never-invoked_. A real test sets `findOverlapping` to return a clash, and asserts that `book(...)` throws with `code === 409`. This run respects clear boundaries. It does not propose new tests — that is [`coverage-review`](./coverage-review.md)'s job. It does not propose deleting the test — that is [`prune-tests`](./prune-tests.md)'s job. The fix here is to strengthen the test.

## Where it fits

audit-test runs _after_ tests exist, next to [`coverage-review`](./coverage-review.md). [`qa-pass`](./qa-pass.md) calls it in batch (`--changed`) over a branch's changed tests, as its False-Confidence Audit. On a `--sacred` path, a confirmed false-confidence test forces an un-overridable FAIL. If a suspect test turns out merely redundant, not false confidence, hand it to [`prune-tests`](./prune-tests.md) instead. For a suite-wide mutation _score_, use Stryker, not this skill.

## Anti-patterns

- **Dressing reasoning up as proof.** If the code does not run, the honest verdict is 🟡 Likely, not 🔴 Confirmed.
- **Running mutations on a dirty tree.** The safety rule refuses to mutate unless `git status` reports a clean tree (or you point at a scratch copy). It reverts every mutation immediately.
- **Deleting the flagged test.** A false-confidence test usually guards a real behavior, but poorly. Strengthen the assertion instead of removing the guard.
- **Reaching for it as a Stryker substitute.** audit-test is a challenger with a taxonomy and a fix, not a defensible suite-wide score.
