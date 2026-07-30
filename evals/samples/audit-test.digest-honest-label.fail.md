<!-- RECORDED NEGATIVE SAMPLE — a /audit-test --digest run that ignores the flag and
     launders the evidence. Used by run-eval.mjs --self-test to prove the grader FAILS it:
       * `--digest` ignored — the full report's sections are emitted unchanged, with no
         card, so the token asserts on **Confidence:** and **Next:** both miss,
       * the evidence is dropped to a characterization ("seems overmocked") with no
         mutation, no command, and no observed outcome behind the claim,
       * no denominator — nothing says how much was triaged versus deep-audited.
     If the grader ever passes this, the harness is not discriminating. -->

## audit-test: "rejects overlapping bookings"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** The assertion seems overmocked, and the guard it names is unlikely to be exercised
by this setup.

**Proof:** Reviewed the test against `booking.js`. Given how the repository is stubbed, the test would
not catch a regression in the overlap path.

**A real test would:** assert the rejection instead of the collaborator call.
