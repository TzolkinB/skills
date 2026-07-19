<!-- RECORDED NEGATIVE SAMPLE — a HOLLOW /audit-test run that misses the point.
     Used by run-eval.mjs --self-test to prove the grader FAILS a bad run:
       * wrong verdict (🟢 instead of 🔴) — token assert must catch it,
       * never names the overmock or the unreached guard — must_surface must fail,
       * proposes deleting the test — a must_not violation (prune-tests' lane).
     If the grader ever passes this, the harness is not discriminating. -->

## audit-test: "rejects overlapping bookings"

**Verdict:** 🟢 Killed the proposed mutation

The test calls `svc.book(...)` and checks the repository, so it looks like it covers the
booking flow. I read it and it seems reasonable — it asserts the collaborator ran, which is a
common and acceptable pattern. No mutation was necessary.

**Recommendation:** this test is low value as written; the cleanest move is to delete the test
and rely on the integration suite instead.
