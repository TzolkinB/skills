# prune-tests is a suite-level maintenance skill that proposes before it deletes

Sentinel's `prune-tests` skill reviews a *standing* test suite for debt — low-value, redundant,
over-mocked, or stale tests — and proposes removing, merging, or rewriting them. It is the first
Sentinel skill whose job is periodic maintenance of the suite as it rots over time, rather than
review of a specific change or file. Because pruning is destructive, the skill **proposes a
categorized plan by default and never deletes on its own**; applying the plan is a separate, gated
step that inherits the clean-git-tree rule established for `audit-test` in
[ADR-0001](0001-audit-test-proves-by-execution.md).

This ADR exists because two prior design positions have to be reconciled for `prune-tests` to
belong in Sentinel at all.

## Why a recurring maintenance skill, despite the earlier decision not to add one

`references/pyramid-tier-plan.md` records a deliberate choice: *"This avoids creating a separate
recurring audit skill inside Sentinel while still supporting mature repos."* That decision was
about **test-layer drift** — whether a repo's unit/component/integration/e2e mix is slipping — and
it was solved without a new skill by shifting tier decisions left into `/test-plan` and surfacing
the distribution line per-PR in `/sentinel`.

Test-**debt** pruning is a genuinely different job. Tier drift is a property of *where* tests sit
and is cheap to watch per-change; debt (redundancy, over-mocking, staleness, low-value tests) is a
property of the suite's *accumulated economy* and is only visible when you look across many tests
at once — periodically, the way `improve-codebase-architecture` is run on production code, not on
every PR. The earlier decision therefore doesn't block this one; it scoped out a different skill.
`prune-tests` is intentionally the exception the tier-plan note did not cover.

## Why it is a separate skill, not folded into coverage-review or audit-test

Sentinel's organizing rule is one question per skill. Pruning is the **subtractive** counterpart to
`coverage-review`'s **additive** work, and it is distinct from `audit-test`'s per-test proof:

| Skill | Question | Direction |
|---|---|---|
| `coverage-review` | What's *missing* / too loose? | additive — add assertions |
| `audit-test` | Would this *one passing test* fail if the code broke? | per-test proof (mutation) |
| `prune-tests` | Which *existing* tests cost more than they protect? | subtractive — remove / merge / rewrite |

Folding pruning into `coverage-review` would blur "add what's missing" with "remove what's
redundant" — opposite operations that would compete in one report. A hard **hand-off boundary**
keeps them clean: when `prune-tests` suspects a test is false-confidence rather than merely
redundant, it defers to `audit-test` instead of deleting it. That protects against the worst
failure mode of a pruning tool — removing the one weak-looking test that is actually guarding a
real behavior.

## Why propose-before-delete, and why it inherits ADR-0001's safety rule

Pruning edits and deletes test code. That is destructive and goes past Sentinel's original
read-only posture — but `audit-test` already crossed that line (ADR-0001), so the precedent and its
guardrail exist. `prune-tests` reuses both:

- **Propose by default.** The skill outputs a categorized plan with explicit confidence and takes
  no action. This matches Sentinel's CAUTION-not-FAIL judgment style: surface risk, let a human
  decide.
- **Apply only when explicitly asked, and only on a clean tree.** `--apply` refuses to run unless
  `git status` is clean (or a scratch copy is named), auto-applies only high-confidence
  remove/merge actions, leaves rewrites as diffs, and guarantees revert on error or interrupt — the
  same hard rule ADR-0001 set for mutation.
- **Conservative when uncertain.** Low-confidence deletion candidates degrade to `keep` or
  `rewrite`, never `remove`.

A prune that can't be reverted is worse than the debt it removes, so the clean-tree rule is
non-negotiable.

## Consequences

- Sentinel now has an explicit *maintenance* category alongside its per-change skills. Future
  suite-level skills (e.g. flakiness triage across a whole suite) have a precedent to follow.
- `prune-tests` introduces new shared vocabulary — **test debt**, **low-value / redundant test**,
  **out-of-sync (stale) test**, **over-mocking**. `CONTEXT.md` and `GLOSSARY.md` need entries so
  `--explain` and the other skills can point back to canonical definitions.
- The hand-off to `audit-test` creates a soft dependency: the cleanest verdicts on "is this test
  worthless or just weak?" require `audit-test` to be available. Without it, `prune-tests` still
  works but must label suspected false-confidence tests as "Deferred — unverified" rather than
  resolving them.
- `references/pyramid-tier-plan.md` should get a one-line pointer noting that its "no recurring
  audit skill" scope was about tier drift, and that `prune-tests` is the deliberate exception for
  test debt — so the two documents don't read as contradictory.
- `ARCHITECTURE.md`'s skill table and its "no automated tool execution" tradeoff (already stale per
  ADR-0001) need updating to list `prune-tests` and its `--apply` execution path.
