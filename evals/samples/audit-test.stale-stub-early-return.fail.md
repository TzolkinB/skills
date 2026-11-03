<!-- RECORDED NEGATIVE SAMPLE — a HOLLOW /audit-test run: reasons the test is fine, never mutates,
     names neither smell, and proposes deleting it (prune-tests' lane). Used by run-eval.mjs
     --self-test to prove the grader FAILS a bad run. -->

## audit-test: "resolves and logs when the email send rejects"

**Verdict:** 🟢 Killed the proposed mutation

The test is named for the failure path and awaits the function, so it looks like it covers it.
I read it and it seems reasonable. No mutation was necessary.

**Recommendation:** the cleanest move is to delete the test and rely on the integration suite.
