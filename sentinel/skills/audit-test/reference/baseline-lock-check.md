# audit-test — Baseline-lock check (why a 🟢 can still be wrong)

Run this before recording 🟢 for a *changed* test (primarily `--changed` mode). Loaded from Step 4.

A 🟢 proves the assertion is *live* — it fails when the code changes. It does **not** prove the assertion pins the *correct* value. A test edited to match a regression still kills mutations perfectly; it's just anchored to the wrong point. Mutation has no notion of "correct," only "different from now," so it structurally can't see a baseline-lock ([ADR-0017](../../../docs/adr/0017-audit-test-baseline-lock-suspected.md)). The classic source is an AI self-healer or "make the test pass" agent that greens a red test by rewriting its expected value.

Raise **⚠️ Baseline-lock suspected** — never from an invented oracle — from intent signals, in order:

1. **Assertion diff (primary; changed-test / `--changed` mode).** From the same diff you resolved the target with, check whether an assertion's expected value was **changed in lockstep with — especially weakened to match — the code change it should catch** (a count/threshold/enum/status loosened to track new output). That co-change is the fingerprint of a green-locked regression.
2. **In-code intent oracle (secondary; any mode).** If mutating the code to *align it with its own declared intent* — a source-of-truth constant, type, schema, or doc the current code contradicts — makes the "passing" test **fail**, the test pins against intent, not behavior. (This is how a blinded audit caught it in EXPERIMENT-0002: restoring the code's declared 12-card deck failed a test that had been healed to expect 10.)
3. **Neither available** → do **not** raise it. Say the check couldn't run (no diff, no in-code oracle) rather than guess — an honest gap, not a fabricated pass.

**Not a characterization test.** A deliberate pin of current behavior (even quirky) is a labeled safety net, not a baseline-lock. The discriminator is *lockstep*: the assertion was changed **together with, and to accommodate,** the code change it should have caught. When ambiguous, present it as a question, not a verdict — challenger, not oracle.

**Remedy:** *restore the assertion to the intended value (N); or, if the new behavior is correct, update the code's declared intent to match — don't leave the test blessing a value that contradicts the code's own source of truth.*
