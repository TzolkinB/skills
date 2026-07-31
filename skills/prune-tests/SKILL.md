---
name: prune-tests
description: Review a test file or suite for low-value, redundant, over-mocked, or stale tests and propose a conservative prune / merge / rewrite plan — the subtractive counterpart to coverage-review
argument-hint: "[test file or directory path] [--digest] [--explain] [--audit-evidence=<path>]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
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
5. Run a **scenario-boundary check** before proposing any merge **or remove**:
   - only merge within the same scenario class (expected use / edge / failure),
   - only merge when business preconditions match (zero-cost with zero-cost, permission-granted with permission-granted),
   - propose `merge` only when behavior contract, setup meaning, and outcome type are effectively the same.
   - If scenarios differ but both are valuable, prefer `rewrite`/`rename` over `merge`.
   - **Keep separate tests for distinct behavior contracts even when the setup or assertions look similar — matching setup is not matching meaning.** This gate applies to `remove` as much as `merge`: only propose `remove` when another *kept* test subsumes the candidate's behavior contract (Step 3). Duplicated assertions or examples alone are never grounds to remove — a replay/idempotency guard or a boundary case routinely shares surface form with a happy-path test while protecting a distinct invariant.
6. Evaluate **mocking strategy**: prefer real collaborators for *internal* systems (services, model managers, permission classes, serializers, query paths) when integration is cheap; keep mocks only at *external* boundaries (network, third-party APIs, clock/randomness, expensive side effects).
7. Detect **out-of-sync / stale** tests: name says one behavior but assertions prove another; Given/When/Then comments contradict setup; assertions validate payload shapes or status contracts no longer in use; intent duplicates a newer canonical test with stale assumptions.
8. Apply the **hand-off rule** (see below) before categorizing — anything that smells like false-confidence rather than redundancy goes to `audit-test`, not into this report's prune list.
9. If `--audit-evidence=<path>` is present in $ARGUMENTS, ingest it (see **Audit-evidence ingestion** below) before categorizing. This can promote a Step 8 Deferred entry into the new **Confirmed Prune (mutation-backed)** category; it never removes an entry from Deferred without a matching execution-confirmed record, and it never touches any other category.
10. Categorize findings with an explicit prune **confidence** (`high` / `medium` / `low`).
11. Output the plan. **Do not delete or edit tests.** Applying the plan is a separate, gated step — see Apply Mode.
12. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode). Otherwise omit it — default output stays lean.
13. If `--digest` is present in $ARGUMENTS, emit the [shared digest card](../shared/digest-format.md) **instead of** the plan above — the same proposals, trimmed to the three that buy the most, as risk / evidence / action / confidence. This skill's confidence ceiling is **Likely** (a static economy read) — **except** a `Confirmed Prune (mutation-backed)` entry, which carries **Confirmed**: it's grounded in a mutation `audit-test` already ran, not this skill's own static read. A `Deferred` entry is **Unexamined** — deferring it is precisely the admission that nothing here judged it.

## Hand-off rule (boundary with `audit-test` and `coverage-review`)

`prune-tests` judges the suite's **economy** — redundancy, consolidation, over-mocking, drift. It does **not** judge whether a single test genuinely protects its behavior.

- A test that looks like it *never verifies its code* (false-confidence / pseudo-tested) → **defer to `audit-test`**, which proves it by mutation. List it under "Deferred", not "Likely Prune".
- A *gap* (missing path, loose assertion on untested behavior) → that's `coverage-review`'s additive job, not this skill's. Don't add tests here.

This keeps one question per skill and prevents `prune-tests` from deleting a weak-looking test that is actually the only thing guarding a real behavior.

## Audit-evidence ingestion (`--audit-evidence=<path>`)

Optional, and closes the Hand-off rule's loop. Without it, a human runs `/audit-test` on the Deferred
list by hand, reads the verdict, then comes back and re-classifies the entry themselves. This flag lets
a prior `/audit-test --emit-json=<path>` run do that re-classification automatically, by reading the
same `gate-audit-test/v0.x` emission the Gate skill ingests
([schema](../gate/schema/audit-test-emission.v0.schema.json)).

1. Read `<path>` and parse it as JSON. Missing file, unreadable, or invalid JSON → behave **exactly** as
   if the flag were absent: Step 8's Deferred list stands unchanged. Say so in one line rather than
   dropping it silently — a discarded evidence file is a fact worth reporting, the same way a `Deferred`
   entry is itself an admission rather than a clean pass.
2. Validate `schema` is a `gate-audit-test/v0.x` string — the family `/audit-test --emit-json` writes. A
   missing field, a different family, or a future major version this skill doesn't know is a
   **schema-version mismatch**: handle it the same as step 1 — unchanged behavior, plus a one-line note
   naming the mismatch (e.g. "ignored `--audit-evidence`: schema `gate-audit-test/v1.0` is not a
   recognized v0.x emission"). This is a light shape check, not Gate's full trust-boundary arithmetic
   ([ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md)) — that consistency-proving is Gate's job
   at the ship gate, not this proposal-only skill's.
3. **Only `confirmedHollow` promotes, and only by name.** The emission's counts are aggregate; only its
   optional `runs[]` trace names *which* test each count belongs to
   ([ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §3). For each Deferred entry from Step 8,
   look for a `runs[]` record whose `test` identity (`<file>::<test name>`) matches it, with
   `outcome: "survived"` (survived = confirmedHollow, per the schema). A match promotes that entry to
   **Confirmed Prune (mutation-backed)**, carrying the record's `mutation` line as its evidence. No
   match — because `runs[]` is absent from this emission, or no record names this test — leaves the
   entry Deferred exactly as Step 8 left it. If the emission reports `confirmedHollow > 0` but nothing in
   `runs[]` matches a Deferred entry here, say so in one line (real evidence that *something* is hollow,
   just not *this* test) rather than either promoting on a guess or silently dropping the count.
4. `likelyHollow` and `baselineLock` never promote — not as a rule this skill has to enforce, but
   structurally: `audit-test` only ever writes a `runs[]` record for the execution-confirmed subset
   (confirmedSolid/confirmedHollow); a 🟡 or ⚠️ verdict was never mutated, so it can never appear in
   `runs[]` to be matched against. Nothing here needs to special-case them.

## Output Format

```
## Prune Review: [File or Suite]

Tests reviewed: N   |   Proposed: X remove / Y merge / Z rewrite / K keep

### 1. Low-Value / Likely Prune
- **`test name`** — [why it adds little unique confidence: duplicate assertion sets **over the same behavior contract**, perf/timing check in a normal suite, pseudo-concurrency with no real race boundary (*not* a replay/idempotency guard, which is load-bearing), or a test of library/ORM behavior rather than domain behavior]
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

### Confirmed Prune (mutation-backed)
*(only with `--audit-evidence=<path>` — a Deferred entry `audit-test` already proved hollow, by name. Omit this section when nothing promoted, same rule as every other category: don't manufacture an entry.)*
- **`test H`** — was Deferred above; `--audit-evidence=<path>` matched it to a `confirmedHollow` record: [the `runs[]` record's `mutation` line, one line]. Zero protection, execution-confirmed — `audit-test`'s own default advice is to strengthen a hollow test rather than delete it; this category names it as a legitimate removal candidate for a team that isn't going to invest in that fix.
  - confidence: high | action: remove | evidence: `--audit-evidence=<path>` (`gate-audit-test/v0.x`)

**Next:** `/audit-test tests/cart.spec.ts` on the Deferred entries before deciding — don't delete what only it can clear
```

If the suite is already lean, say so plainly and list only "Keep" — do not manufacture prunes to fill the template.

Close every plan — full or `--digest` ([shared card](../shared/digest-format.md)) — with that one-line [`Next:` footer](../shared/next-footers.md); it's the same hand-off the Deferred section makes, generalized so every judgment skill ends with one. Pick the row for the result you actually produced: Deferred entries route to `/audit-test`; a plan with none — including one where `--audit-evidence` already promoted every Deferred entry to Confirmed Prune — routes to `--apply` on a clean tree.

## Apply Mode (`--apply`)

Default output is a proposal only. `--apply` performs the removals/merges/rewrites — this is **destructive**, so it inherits the same safety rule as `audit-test` (see [ADR-0001](../../docs/adr/0001-audit-test-proves-by-execution.md) and [ADR-0003](../../docs/adr/0003-prune-tests-proposes-before-deleting.md)):

1. Refuse to run unless `git status` reports a **clean tree** (or the user points to a scratch copy). Print the reason and stop otherwise.
2. Show the full proposal and require explicit confirmation before touching any file.
3. Apply only `high`-confidence `remove`/`merge` actions automatically; leave `medium`/`low` and all `rewrite`s for the developer to review as a diff. A `Confirmed Prune (mutation-backed)` entry is `high`-confidence by construction — it's execution-confirmed, not this skill's own static read — so it applies the same as any other high-confidence remove.
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
- **`--audit-evidence` only ever promotes toward removal what `audit-test` already proved by execution.** It never manufactures a new false-confidence claim of its own — a `Deferred` entry with no matching `runs[]` record stays exactly as Step 8 left it, and a missing file or schema mismatch degrades to that same unchanged behavior, never a guess.
