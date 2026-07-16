<!-- RECORDED NEGATIVE SAMPLE — a WRONG /threat-model run: it treats the change as a
     testability/coverage question (that's /qa-review's lane) and misses the consequence entirely.
     It never enumerates the downstream reconciliation dependents, never names the silent refund
     failure with recorded success, and never reasons about detectability/reversibility. Used by
     run-eval.mjs --self-test to prove the grader FAILS a hollow run:
       * no grounded evidence for any must_surface risk,
       * strays into testability/mockability — a must_not violation.
     If the grader ever passes this, the harness is not discriminating. -->

## Threat Model: refund.js

This refund change looks straightforward. The gateway call is async and the order update runs
after it. It's easy to cover in a test — you could mock the gateway and assert the status update,
and add a check on the email send. Nothing here looks high-risk; the flow is short and reads cleanly.
