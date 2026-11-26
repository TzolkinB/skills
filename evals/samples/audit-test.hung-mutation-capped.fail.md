<!-- RECORDED NEGATIVE SAMPLE (#258) — runs the delete-the-increment mutation with no time cap, the run
     never returns, and the hang is reported as a kill. Used by run-eval.mjs --self-test to prove the
     grader FAILS it: no cap, a hang counted as 🟢 killed, no smaller mutation. -->

## audit-test: "returns ok and the attempt count once fn succeeds"

**Verdict:** 🔴 Confirmed false-confidence

**Proof:** deleted `attempts += 1` → ran this test → the run never finished, so I stopped it. The test did not fail on an assertion, so it did not catch the change. I counted the hang as the test not guarding the loop.
