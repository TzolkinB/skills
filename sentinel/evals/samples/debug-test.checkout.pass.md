<!-- RECORDED SAMPLE — a faithful /debug-test run on the missing-await checkout fixture.
     Step-2 (quick QA heuristics) catch: root cause found, local fix, no routing. Used by
     run-eval.mjs --dry-run to exercise the grader offline; a representative transcript, not
     a live capture. Deliberately does not name the healer/diagnosing-bugs (it resolves at
     Step 2), so the "must NOT route" checks read as correctly absent. -->

## debug-test: shows confirmation after checkout

### Failure
`expect(banner).toBeVisible()` never enforces — the web-first assertion is a floating, unawaited promise.

### Root Cause
**Assertion** — missing `await` on a Playwright web-first (async, auto-retrying) assertion.
Without `await`, `expect(banner).toBeVisible()` returns a floating promise that never settles inside
the test, so the assertion never actually retries and can never fail — a false positive, not a real check.

```ts
expect(banner).toBeVisible();
```
↓
```ts
await expect(banner).toBeVisible();
```

### Confidence
🟢 High — the retrying assertion is unawaited; adding `await` makes it enforce and retry.
Resolved by the quick QA heuristics at Step 2; no further routing required.
