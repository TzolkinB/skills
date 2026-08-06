<!-- RECORDED NEGATIVE SAMPLE — WRONG route: sends a "before I write any code" situation to
     /coverage-review, which is for tests that ALREADY exist. Used by run-eval.mjs --self-test to
     prove the grader FAILS a mis-route: the /test-plan token is absent and the must_surface route
     rationale is unsatisfied. If the grader passes this, it is not discriminating. -->

**You're at:** you want to check test coverage for the checkout feature.

**Use:** `/coverage-review`
**Why:** coverage-review will tell you what is covered on the branch.
**Run:** `/coverage-review checkout`

**Next in the flow:** `/audit-test`.
