# audit-test — proves whether a passing test fails when the code breaks

> **Agent instructions:** [`skills/audit-test/SKILL.md`](../skills/audit-test/SKILL.md)
>
> **Run:** `/audit-test test.spec.js code.js`

## What it does

`audit-test` checks a _passing_ test and asks the sharpest question about it: **does it fail when the code it covers breaks?** If not, that is false confidence — the test looks like protection, but guards nothing.

AI reasoning about a test can go wrong in exactly the same way the test itself is wrong. So audit-test does not stop at reasoning: for a suspect test, it applies the mutation most likely to break the code, runs just that one test, and reports what happened. Every finding gets one of two labels — **🔴 Confirmed** (a mutation ran and the test stayed green) or **🟡 Likely** (reasoning only, because the code did not run). It never invents a score. Whether the mutation matters to real behavior stays a visible human call — audit-test is a **challenger, not an oracle**.

### Baseline-lock: the failure a mutation alone can't show

A **baseline-lock** (⚠️) is a _live_ assertion edited to accept a regression — the mark a self-healer leaves when it turns a red test green by rewriting the expected value. The assertion still fails against a mutation, so audit-test marks it 🟢. But it checks the _wrong_ value, and rejects the real fix.

audit-test raises this finding from the assertion diff (in `--changed` mode), or from an in-code source of truth that the code now contradicts — not from the mutation. A human then confirms the intended value ([ADR-0017](./adr/0017-audit-test-baseline-lock-suspected.md)).

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| A test is green and you don't trust it — you're reviewing a PR's tests, or one suspicious test, and want a concrete fix, not a number | **`/audit-test`** — this page |
| You want a cheap first pass before a heavyweight [mutation campaign](../GLOSSARY.md#mutation-campaign) | **`/audit-test`** — fix what it flags first, before spending Stryker's minutes-to-hours |
| You want the missing test cases, not a judgment on the ones you have | [`coverage-review`](./coverage-review.md) — audit-test judges tests that already pass; it does not propose new ones |
| You want to delete or merge redundant tests | [`prune-tests`](./prune-tests.md) — a false-confidence test usually guards real behavior, poorly; the fix is to strengthen it, not remove it |
| You want a codebase-wide mutation score | StrykerJS — audit-test is the per-test judgment tool, not a suite-health metric ([ADR-0004](./adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)) |

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

## It's Working If

- A 🔴 Confirmed verdict never appears unless a mutation actually ran and the test stayed green — reasoning alone caps at 🟡 Likely.
- A baseline-lock finding (⚠️) surfaces from an assertion diff or an in-code source of truth, never from a mutation alone.
- Every mutation lands on a clean git tree and reverts immediately after the single test runs.
- A Cypress target without single-test isolation (a one-test spec, or `@cypress/grep`) falls back to 🟡 Likely, never a false 🔴.
- audit-test never proposes new test cases and never deletes or merges a test — those are [`coverage-review`](./coverage-review.md)'s and [`prune-tests`](./prune-tests.md)'s jobs.

If audit-test ever marks 🔴 Confirmed without an execution, or mutates a dirty tree, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does a 🔴 Confirmed verdict mean the test is good now?**
A: No. It proves the test catches the one mutation applied, not that the test is complete. audit-test judges whether an existing test fails when the code breaks; it does not check whether more cases are missing. For that, use [`coverage-review`](./coverage-review.md).

**Q: Does audit-test flag every deliberately pinned assertion as a baseline-lock?**
A: No. The discriminator is _lockstep_: audit-test only raises the finding when the assertion changed together with, and to accommodate, the code change it should have caught — not a standalone deliberate pin, like a characterization test. When that is ambiguous, it presents a question, not a verdict ([ADR-0017](./adr/0017-audit-test-baseline-lock-suspected.md)).

**Q: Does baseline-lock detection work outside `--changed` mode?**
A: Only partially. The assertion-diff signal needs a diff to compare against, so it is `--changed`-mode only. In whole-suite mode, audit-test falls back to the in-code source-of-truth signal — and if neither signal applies, it states the gap plainly rather than raising a finding it can't support ([ADR-0017](./adr/0017-audit-test-baseline-lock-suspected.md)).

**Q: Can audit-test consume Stryker's own survivor report instead of running its own mutation?**
A: Not yet. That ingestion seam — Stryker supplying the proof, audit-test supplying the taxonomy and fix — is deferred, not built ([ADR-0004](./adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)). Today audit-test always runs its own targeted mutation.

## Where it fits

audit-test runs _after_ tests exist, next to [`coverage-review`](./coverage-review.md). [`qa-pass`](./qa-pass.md) calls it in batch (`--changed`) over a branch's changed tests, as its False-Confidence Audit. On a `--sacred` path, a confirmed false-confidence test forces an un-overridable FAIL. If a suspect test turns out merely redundant, not false confidence, hand it to [`prune-tests`](./prune-tests.md) instead. For a suite-wide mutation _score_, use Stryker, not this skill.

## Anti-patterns

- **Dressing reasoning up as proof.** If the code does not run, the honest verdict is 🟡 Likely, not 🔴 Confirmed.
- **Running mutations on a dirty tree.** The safety rule refuses to mutate unless `git status` reports a clean tree (or you point at a scratch copy). It reverts every mutation immediately.
- **Deleting the flagged test.** A false-confidence test usually guards a real behavior, but poorly. Strengthen the assertion instead of removing the guard.
- **Reaching for it as a Stryker substitute.** audit-test is a challenger with a taxonomy and a fix, not a defensible suite-wide score.
