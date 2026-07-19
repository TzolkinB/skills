<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of an "AI wrote a pile of tests, what's
     missing?" situation to /coverage-review (the tests already exist; the question is the gaps and
     loose assertions). Used by run-eval.mjs --dry-run offline. -->

**You're at:** the AI generated a batch of tests for your API service and you need to know what they miss.

**Use:** `/coverage-review`
**Why:** the tests already exist — your question is which cases are *missing* and where assertions are loose, which is the one question `/coverage-review` answers.
**Run:** `/coverage-review test/api-service.spec.ts`

**Next in the flow:** if a specific passing test looks untrustworthy, `/audit-test` to prove it by mutation.
