# audit-test — would this passing test fail if the code broke?

> **Agent instructions:** [`skills/audit-test/SKILL.md`](../skills/audit-test/SKILL.md) · **Run:** `/audit-test test.spec.js code.js`

## What it does

`audit-test` interrogates a *passing* test and asks the sharpest question about the tests you already have: **would it fail if the code it covers broke?** If it wouldn't, it's false confidence — it looks like protection but guards nothing.

The trap it's built to avoid is that an AI can *reason* a test is fine and be exactly as wrong as the test it's judging. So it doesn't stop at reasoning: for a suspect test it applies the single most-likely-breaking mutation to the source, runs just that one test, and reports what actually happened. Findings are labeled **Confirmed** (a mutation ran and the test stayed green) or **Likely** (reasoned only, because the code couldn't be run) — never an invented score. Whether the mutation was behaviorally meaningful stays a visible human call: this is a **challenger, not an oracle**.

It also flags a subtler failure the mutation alone can't see — a **baseline-lock** (⚠️): a *live* assertion edited to bless a regression (the fingerprint a self-healer leaves when it greens a red test by rewriting the expected value). It still kills mutations, so it reads 🟢 — but it pins the *wrong* value and would reject the real fix. audit-test raises it from the assertion diff (in `--changed` mode) or an in-code source of truth the code now contradicts, for a human to confirm the intended value ([ADR-0017](./adr/0017-audit-test-baseline-lock-suspected.md)).

## When to use it

- A test is green and you don't trust it — you want proof it would actually bite.
- Reviewing a PR's tests, or a single suspicious test, and you want a concrete fix rather than a number.
- As the cheap first pass before a heavyweight [mutation campaign](../GLOSSARY.md#mutation-campaign) — fix what it flags before spending Stryker's minutes-to-hours.

## When *not* to use it

- **You want the missing cases** → [`coverage-review`](./coverage-review.md). audit-test judges tests that already pass; it doesn't propose new ones.
- **You want to delete or merge tests** → [`prune-tests`](./prune-tests.md). A false-confidence test usually guards a real behavior *badly* — the fix is to strengthen it, not remove it.
- **You want a codebase-wide mutation score** → StrykerJS. audit-test is the per-test judgment tool, not a suite-health metric ([ADR-0004](./adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)).

## Prerequisites

Claude Code, plus — for a **Confirmed** verdict — a runnable test environment and a **clean git tree**: the deep audit mutates one source file, runs a single test, and reverts immediately. Without a clean tree or a runnable env it won't guess; it falls back to a reasoned 🟡 **Likely** verdict. It adds no network calls of its own.

## Worked example

Fixture: [`fixtures/audit-test/`](../fixtures/audit-test/) ([expected findings](../fixtures/audit-test/expected-findings.md)).

```
/audit-test fixtures/audit-test/booking.spec.js fixtures/audit-test/booking.js
```

The test is named `"rejects overlapping bookings"` and it's green — but it stubs `findOverlapping` to return `[]` (so the overlap path never runs) and only asserts that `save()` was called. It never exercises the rejection it's named for.

The verdict is **🔴 Confirmed false-confidence**: comment out the overlap guard in `booking.js`, run just this test, and it *still passes* — the execution proof. The taxonomy label is *overmocked / interaction-only*, compounded by *focal-unit-never-invoked*. A real test would set `findOverlapping` to return a clash and assert `book(...)` throws with `code === 409`. Note the boundaries the run respects: it doesn't propose new tests ([`coverage-review`](./coverage-review.md)'s job) and it doesn't propose deleting the test ([`prune-tests`](./prune-tests.md)'s) — the fix is to strengthen it.

## Where it fits

Runs *after* tests exist, next to [`coverage-review`](./coverage-review.md). [`sentinel`](./sentinel.md) calls it in batch (`--changed`) over a branch's changed tests as its False-Confidence Audit — and a confirmed-hollow test on a `--sacred` path forces an un-overridable FAIL. If a suspect test turns out merely redundant rather than hollow, hand it to [`prune-tests`](./prune-tests.md); if you want a suite-wide mutation *score*, that's Stryker, not this.

## Anti-patterns

- **Dressing reasoning up as proof.** If the code can't be run, the honest verdict is 🟡 Likely, not 🔴 Confirmed.
- **Running mutations on a dirty tree.** The safety rule refuses to mutate unless `git status` is clean (or you point at a scratch copy), and it reverts every mutation immediately.
- **Deleting the flagged test.** A hollow test is usually protecting a real behavior poorly; strengthen the assertion instead of removing the guard.
- **Reaching for it as a Stryker substitute.** It's a challenger with a taxonomy and a fix, not a defensible suite-wide score.
