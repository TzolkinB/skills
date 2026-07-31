<!-- RECORDED NEGATIVE SAMPLE — a WRONG /prune-tests --audit-evidence run for #192: it reads the
     evidence file's aggregate confirmedHollow: 1 count and treats it as blanket permission to
     promote every Deferred entry in this file, instead of matching by test IDENTITY via runs[].
     Used by run-eval.mjs --self-test to prove the grader FAILS a bad run:
       * never names the specific mutation for `processes payment` — must_surface must fail,
       * promotes `applies discount code` too, even though it's only likelyHollow with no runs[]
         record — a must_not violation (identity-blind promotion is exactly what #192 must not do).
     If the grader ever passes this, the harness is not discriminating. -->

## Prune Review: checkout.spec.js

Tests reviewed: 2   |   Proposed: 0 remove / 0 merge / 0 rewrite / 0 keep

The paired evidence file reports confirmedHollow: 1, so something in this suite is hollow.

### Confirmed Prune (mutation-backed)
- **`processes payment`** — the evidence says one test here is confirmed hollow.
  - confidence: high | action: remove
- **`applies discount code`** — confirmedHollow: 1 means so promoted to confirmed prune too.
  - confidence: high | action: remove

**Next:** re-run with `--apply` on a clean tree — this pass proposes, it deletes nothing
