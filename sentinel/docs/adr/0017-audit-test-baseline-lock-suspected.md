# audit-test flags a suspected baseline-lock — a live assertion pinned to the wrong value — as its own finding, not a 🟢

**Status: Proposed.** The gap is proven (EXPERIMENT-0002, 2026-07-11, blinded); the remedy below is
designed, not yet built. This ADR is the mirror of [ADR-0016](0016-audit-test-reachability-guard.md):
0016 refused to let a *stale harness* fabricate a **false 🔴**; this one refuses to let a
*wrong-but-live assertion* earn a **false 🟢**.

## Context

`audit-test`'s 🟢 "killed the proposed mutation" verdict rests on one factual claim: *the mutation
ran and the test failed as it should.* That proves the assertion is **live** — it guards against
*change*. It does **not** prove the assertion pins the **correct** value. A test whose expected value
has been edited to match a regression still kills mutations perfectly — it is just anchored to the
wrong point. Mechanical mutation has no notion of "correct," only "different from current behavior,"
so it structurally cannot see a baseline-lock. This is a limit of the method, not a bug in it.

This was proven, not theorized. In EXPERIMENT-0002 a real regression (`Main.reducer.ts`, deck sliced
to 10) was injected into the `Memory` app, the anchor test went red, and a **blinded** Playwright
Healer "fixed" it by changing the assertion `toHaveCount(12)` → `toHaveCount(10)` to match the broken
app — green-locking the regression. A **blinded** `audit-test` run then showed the two-sidedness:

- Mechanical mutation (`slice(0,10)` → `slice(0,8)`): the test **failed** → assertion has teeth →
  pure mutation reads **🟢 solid**. It misses the lock.
- Only when the auditor, as a **challenger not oracle** ([ADR-0001](0001-audit-test-proves-by-execution.md)),
  mutated the code to *restore its own declared intent* (the full 12-card deck) did the "passing"
  test **fail (expected 10, got 12)** — revealing that it *enforces the regression and would reject a
  fix.* The auditor found intent in the source-of-truth (`robots.ts` = 12 cards; `decks.ts` docs "6
  pairs = 12 cards") and in the assertion diff itself (12 → 10).

So a green from a self-healer — or any AI-authored/edited test — is not evidence the behavior is
correct. And `audit-test`, run mechanically, would bless it.

## Decision

`audit-test` gains a **baseline-lock suspicion** finding, distinct from 🔴 and 🟢, raised when a
test's assertion appears **pinned to a value the code was recently changed to produce**, rather than
to the code's intended behavior. It is *not* folded into 🔴 (the test is not hollow — it guards
something) and *not* silently allowed as 🟢 (what it guards may be wrong).

It is raised from **intent signals, ranked by reliability — never from an invented oracle:**

1. **Assertion diff (primary, changed-test / `--changed` / PR mode).** When the test under audit had
   its expected value **changed in lockstep with — especially weakened to match — the code change it
   is meant to catch**, that is the signature of a green-locked regression (the exact fingerprint a
   self-healer or "make the test pass" agent leaves). Cheap, high-signal, and available precisely
   when it matters: reviewing a PR or an AI-authored/healed change.
2. **In-code intent oracle (secondary).** Source-of-truth constants, types, schemas, or docs that
   the current code contradicts (the `robots.ts` = 12 signal). Powerful when present; **degrades
   honestly** — when no such oracle exists, say so, do not guess.
3. **Human confirmation (always).** The finding is a *challenger's flag* requiring the reviewer (or
   an intent source like the test plan) to confirm the intended value. `audit-test` states the
   suspicion and the evidence; it never asserts the correct value on its own authority
   ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md), [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)).

A confirmed baseline-lock carries a concrete remedy — *"restore the assertion to the intended value
(N), or, if the new behavior is correct, update the code's declared intent to match"* — the mirror of
the 🔴 remedy ("add the missing assertion").

## Considered options

- **Build a general correctness oracle** so mutation can judge "right" vs. "different." Rejected —
  that is an open-ended, AGI-shaped false-precision trap and exactly the numeric/authoritative
  overreach [ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md) and
  [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md) forbid. `audit-test` stays a
  challenger.
- **Document the limit only, raise nothing.** Rejected — a silent false 🟢 is the symmetric twin of
  the false 🔴 that ADR-0016 refused to leave silent. If a stale harness must not fake a 🔴, a
  wrong-but-live assertion must not bank a 🟢.
- **Fold it into 🔴.** Rejected — the test is not hollow; conflating the two loses the distinct
  remedy. "Guards nothing → add an assertion" and "guards the wrong value → restore the assertion"
  are different fixes, and merging them would also mislabel a **characterization test** (a
  deliberate pin of current behavior — already a labeled safety net in SKILL.md) as a defect.

## Consequences

- **A new finding type / qualified label**, distinct from 🔴/🟢, with its own remedy line. It is a
  *suspicion*, resolved by the reviewer or an intent source — never a unilateral verdict.
- **Strongest in changed-test / PR mode**, where the assertion diff exists; that is also the mode the
  slop/heal-policing thesis lives in. In whole-suite mode it relies on an in-code oracle or is not
  raised — an honest, stated gap, not a fabricated pass.
- **Must not fire on an intentional characterization test.** The discriminator is *lockstep*: the
  assertion was changed **together with, and to accommodate,** the code change it should have caught
  — not a standalone deliberate pin. When ambiguous, present as a question, not a verdict.
- **Completes the audit-test honesty pair:** ADR-0016 stops false 🔴 from a stale harness; ADR-0017
  stops false 🟢 from a wrong baseline. Together, a `audit-test` verdict now means what it says in
  both directions.
- **Reinforces the orchestration thesis:** no single stage catches a green-pushing healer — Audit
  *plus* the assertion-diff/intent signal does. This ADR is where that pairing becomes a mechanism.
