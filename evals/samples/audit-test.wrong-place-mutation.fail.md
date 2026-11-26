<!-- RECORDED NEGATIVE SAMPLE (#275) — runs the suggested getBooking mutation without checking the test's
     path, sees it survive, and reports a false 🔴. Used by run-eval.mjs --self-test to prove the grader
     FAILS it: wrong verdict (🔴, not 🟢), no rejection of the off-path mutation. -->

## audit-test: "POST creates the booking and answers 201 with the saved record"

**Verdict:** 🔴 Confirmed false-confidence

**Proof:** changed `getBooking` to return status 500 → ran only this test → it still passed → reverted. The test does not guard the handler.
