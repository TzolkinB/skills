<!-- RECORDED NEGATIVE SAMPLE — WRONG route: sends "prove this passing test catches something" to
     /coverage-review (which finds untested paths), not /audit-test (which proves ONE test by
     mutation). The /audit-test token is absent and the route rationale is unsatisfied → FAIL. -->

**You're at:** you want to find gaps in your tests.

**Use:** `/coverage-review`
**Why:** coverage-review finds untested paths across the file.
**Run:** `/coverage-review suspect.spec.ts`

**Next in the flow:** `/prune-tests`.
