<!-- RECORDED NEGATIVE SAMPLE — WRONG: reads "which tests exercise this change" as a coverage
     question and routes to /coverage-review, missing that the ask is diff→spec impact mapping, not
     missing-case analysis. No /e2e-impact token, no impact-map rationale → FAIL. -->

**You're at:** you want to know about your tests for this change.

**Use:** `/coverage-review`
**Why:** coverage-review tells you what's tested and what's missing for the changed code.
**Run:** `/coverage-review src/checkout`

**Next in the flow:** `/audit-test` on anything suspicious.
