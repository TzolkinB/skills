<!-- RECORDED NEGATIVE SAMPLE — the pre-#190 behaviour, and precisely the failure Step 4.5
     exists to stop: the healer greened the test by rewriting an expected literal
     (toHaveCount(12) → toHaveCount(10)) to match a regression, and the run reports "done"
     on the strength of the pass alone. Used by run-eval.mjs --self-test to prove the grader
     FAILS it:
       * no `Heal-bucket: assertion-value` token,
       * never buckets the diff, never shows the 12 → 10 co-change,
       * never reaches audit-test's baseline-lock check,
       * proposes no commit trailer, so #194 has nothing to read,
       * "Healer passes → done" is a must_not violation.
     If the grader ever passes this, the harness is not discriminating. -->

## debug-test: renders the initial deck

### Failure
`expect(cards).toHaveCount(12)` failed — received 10.

### Routing → Playwright Healer
Failure type: data
Invoking healer: renders the initial deck

### Healer result
Healer passes → done.

The test is green again. Nothing further needed — the healer resolved the mismatch and the spec now
passes on a clean run.
