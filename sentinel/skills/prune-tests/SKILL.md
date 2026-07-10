---
name: prune-tests
description: Review a test file or suite for low-value, redundant, over-mocked, or stale tests and propose a conservative prune / merge / rewrite plan — the subtractive counterpart to coverage-review
argument-hint: "[test file or directory path]"
allowed-tools: [Read, Bash, Glob]
---

**Owns:** which existing tests cost more than they protect — redundancy, over-mocking, drift. The subtractive economy pass.
**Not this:** whether a weak-looking test actually guards its behavior → `/audit-test` (don't delete what only it can prove); missing coverage to add → `/coverage-review`; source testability → `/qa-review`.

`prune-tests` asks the suite-level question its siblings don't: **which existing tests cost more than they protect?** — and proposes removing, merging, or rewriting them. Test suites accumulate debt the same way architecture does, and AI-assisted development is especially prone to it: redundant paths, assertions that can't fail, over-mocking that only verifies the mocks, tests drifted out of sync with the code they name. Left alone, this debt makes the suite slower, noisier, and less trustworthy without adding confidence.

This is a **subtractive** skill, so it is deliberately **conservative**: it *proposes* a categorized plan and deletes nothing by default, and when uncertain it keeps. It does not re-derive whether a test protects its behavior — that's `audit-test`'s job, so suspected false-confidence tests are **handed off** (see Hand-off rule), not judged here.

## Steps

1. Resolve the target from $ARGUMENTS. A file → read it. A directory (or nothing) → `Glob` for `**/*.{spec,test}.*` and review each, or ask the user to narrow scope if the suite is large.
2. Read the target file(s) fully.
3. State each test's **behavior contract** in one sentence ("what real behavior would break if this failed?").
4. Group tests by overlap vs. unique signal.
5. Run a **scenario-boundary check** before proposing any merge:
   - only merge within the same scenario class (expected use / edge / failure),
   - only merge when business preconditions match (zero-cost with zero-cost, permission-granted with permission-granted),
   - propose `merge` only when behavior contract, setup meaning, and outcome type are effectively the same.
   - If scenarios differ but both are valuable, prefer `rewrite`/`rename` over `merge`.
6. Evaluate **mocking strategy**: prefer real collaborators for *internal* systems (services, model managers, permission classes, serializers, query paths) when integration is cheap; keep mocks only at *external* boundaries (network, third-party APIs, clock/randomness, expensive side effects).
7. Detect **out-of-sync / stale** tests: name says one behavior but assertions prove another; Given/When/Then comments contradict setup; assertions validate payload shapes or status contracts no longer in use; intent duplicates a newer canonical test with stale assumptions.
8. Apply the **hand-off rule** (see below) before categorizing — anything that smells like false-confidence rather than redundancy goes to `audit-test`, not into this report's prune list.
9. Categorize findings with an explicit prune **confidence** (`high` / `medium` / `low`).
10. Output the plan. **Do not delete or edit tests.** Applying the plan is a separate, gated step — see Apply Mode.
11. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode). Otherwise omit it — default output stays lean.

## Hand-off rule (boundary with `audit-test` and `coverage-review`)

`prune-tests` judges the suite's **economy** — redundancy, consolidation, over-mocking, drift. It does **not** judge whether a single test genuinely protects its behavior.

- A test that looks like it *never verifies its code* (false-confidence / pseudo-tested) → **defer to `audit-test`**, which proves it by mutation. List it under "Deferred", not "Likely Prune".
- A *gap* (missing path, loose assertion on untested behavior) → that's `coverage-review`'s additive job, not this skill's. Don't add tests here.

This keeps one question per skill and prevents `prune-tests` from deleting a weak-looking test that is actually the only thing guarding a real behavior.

## Output Format

```
## Prune Review: [File or Suite]

Tests reviewed: N   |   Proposed: X remove / Y merge / Z rewrite / K keep

### 1. Low-Value / Likely Prune
- **`test name`** — [why it adds little unique confidence: duplicate assertions, perf/timing check in a normal suite, pseudo-concurrency without a real race boundary, or a test of library/ORM behavior rather than domain behavior]
  - confidence: high | action: remove

### 2. Consolidate or Rewrite
- **`test A` + `test B`** — same behavior contract and matching preconditions, tested through near-identical examples
  - confidence: medium | action: merge
- **`test C`** — name/intent mismatch with its assertions
  - confidence: high | action: rename

### 3. Over-Mocking (Reduce Internal Mocking)
- **`test D`** — mocks an internal service/manager where a real factory + call is cheap; currently verifies the mock, not the behavior
  - confidence: medium | action: rewrite with real collaborator

### 4. Out-of-Sync (Stale) Tests
- **`test E`** — asserts an old response shape / status contract no longer produced by the code it names
  - confidence: high | action: rewrite (or remove if the behavior is gone)

### 5. Keep (Conservative — Anti-Over-Prune)
- **`test F`** — protects a critical business invariant / permission boundary / backward-compat wrapper / real user-impact edge case / cross-layer integration contract
  - action: keep

### Deferred to audit-test
- **`test G`** — looks like it may never verify its code; not a redundancy call. Run `/audit-test` to prove or clear it before deciding.
```

If the suite is already lean, say so plainly and list only "Keep" — do not manufacture prunes to fill the template.

## Apply Mode (`--apply`)

Default output is a proposal only. `--apply` performs the removals/merges/rewrites — this is **destructive**, so it inherits the same safety rule as `audit-test` (see [ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md) and [ADR-0003](../../docs/adr/0003-prune-tests-proposes-before-deleting.md)):

1. Refuse to run unless `git status` reports a **clean tree** (or the user points to a scratch copy). Print the reason and stop otherwise.
2. Show the full proposal and require explicit confirmation before touching any file.
3. Apply only `high`-confidence `remove`/`merge` actions automatically; leave `medium`/`low` and all `rewrite`s for the developer to review as a diff.
4. Guarantee revert on error or interrupt — never leave the tree dirty. After applying, run the affected tests once and report the result.

Never delete a test in the same pass that flags it. Propose first, apply second, and only on a clean tree.

## Explain Mode (`--explain`)

Usage: `/prune-tests tests/booking.spec.ts --explain`

When present, append after the standard report:

```
### Why This Matters
[1-2 plain-language sentences per category on why this class of test debt erodes confidence
generally — e.g. why over-mocking makes a test verify itself, why a stale test is worse than
no test because it looks like protection. Link to GLOSSARY.md terms where applicable,
e.g. "See: Loose Assertion", "See: False Positive Test", "See: Flaky Test".]
```

Keep it concept-level. The plan already says *what* to prune; this says *why the debt matters*.

## Notes

- **Conservative by default.** When scenario equivalence is uncertain, keep. Low-confidence deletion candidates become `keep` or `rewrite`, never `remove` — matching setup is not matching meaning.
