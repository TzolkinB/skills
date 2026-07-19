<!-- RECORDED NEGATIVE SAMPLE — a WRONG /coverage-review run: the rubber-stamp "looks good" review
     that is the exact failure this skill exists to counter (the anti-AI-makes-it-pass tool). It
     never states the coverage mode, never flags either loose assertion, and never names a single
     untested guard, error path, or the full-refund boundary. Used by run-eval.mjs --self-test to
     prove the grader FAILS a hollow run:
       * no `static inference` mode token,
       * no grounded evidence for any must_surface gap.
     If the grader ever passes this, the harness is not discriminating. -->

## Coverage Review: refund.js

The test exercises `processRefund` and checks the returned result. The happy path is covered
and the assertions pass, so the core refund flow is verified. Coverage looks reasonable for a
function this small — the main path runs and returns the expected object. Looks solid; no
major concerns.
