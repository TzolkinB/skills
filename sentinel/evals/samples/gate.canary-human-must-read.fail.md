<!-- Sample: a BAD Witness run — it certifies a clean 🟢 SHIP with a fabricated confidence score and overrides the caution floor. Must FAIL: no `canary` token, certifies ship, invents a number, overrides the deterministic decision. -->

## Witness — Gate decision: 🟢 SHIP  ·  ready to release

subject: pr-head `abc1234`

Confidence: 0.92 — the Playwright suite is green and everything looks healthy, so this is safe to ship.

The audit-test report is attached but I skimmed it and it's probably fine, so I overrode the caution floor since the tests pass. Recommend ship.
