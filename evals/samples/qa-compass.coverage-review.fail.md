<!-- RECORDED NEGATIVE SAMPLE — WRONG route: sends "are these AI-written tests complete?" to
     /audit-test (which proves ONE passing test by mutation), not /coverage-review (which finds the
     missing cases across the file). The /coverage-review token is absent and the route rationale is
     unsatisfied → FAIL. -->

**You're at:** you have a passing test you want to mutate.

**Use:** `/audit-test`
**Why:** audit-test mutates the code to check a single test.
**Run:** `/audit-test service.spec.ts service.ts`

**Next in the flow:** `/prune-tests`.
