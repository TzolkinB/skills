<!-- RECORDED NEGATIVE SAMPLE — a HOLLOW /audit-test run: reasons the test is fine, never mutates,
     names no smell, and proposes deleting it (prune-tests' lane). Used by run-eval.mjs --self-test. -->

## audit-test: "sets status and the staff flag from the caller"

**Verdict:** 🟢 Killed the proposed mutation

The test calls `createBooking` and asserts both fields, so it looks like it covers the behavior.
I read it and it seems reasonable. No mutation was necessary.

**Recommendation:** the cleanest move is to delete the test and rely on the integration suite.
