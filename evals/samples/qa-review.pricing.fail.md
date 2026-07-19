<!-- RECORDED NEGATIVE SAMPLE — a WRONG /qa-review run: the shallow "looks testable" review that
     is the failure this skill exists to counter. It names none of the planted smells — not the
     wall-clock branch, not the unseeded randomness, not the hard-coded URL / inline network call,
     not the fragile string match or the unguarded parse. Used by run-eval.mjs --self-test to prove
     the grader FAILS a hollow run: no grounded evidence for any must_surface category. If the
     grader ever passes this, the harness is not discriminating. -->

## QA Review: pricing.js

This pricing helper reads clean and is straightforward to exercise. `quotePrice` takes a userId
and a basePrice and returns a price; the body is mostly simple arithmetic with a couple of
conditional discounts. Nothing jumps out as a blocker — you can call it directly and check the
returned value. Looks fine to work with.
