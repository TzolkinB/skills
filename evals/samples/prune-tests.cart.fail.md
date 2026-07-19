<!-- RECORDED NEGATIVE SAMPLE — a WRONG /prune-tests run: the under-reach "suite is lean, keep all"
     review that misses the real debt. It never spots the redundant pair, never flags the internal
     over-mock, and never catches the stale test whose name contradicts its assertion. Used by
     run-eval.mjs --self-test to prove the grader FAILS a hollow run: no grounded evidence for any
     must_surface category. If the grader ever passes this, the harness is not discriminating. -->

## Prune Review: cart.spec.js

Reviewed 5 tests. Each one checks a distinct cart behavior and reads clean — item totals, a tax
calculation, string handling, and the empty case. Nothing here costs more than it protects; the
suite is already lean, so keep all five.
