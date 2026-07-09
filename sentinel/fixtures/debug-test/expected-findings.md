# Expected findings — debug-test / checkout.spec.ts

Run: `/debug-test sentinel/fixtures/debug-test/checkout.spec.ts`

## What the skill should do
Catch the root cause at **Step 2 (Quick QA heuristics)** — no routing to the Playwright
healer or diagnosing-bugs needed.

## Root cause
**Assertion — missing `await`.** `expect(banner).toBeVisible()` is a Playwright web-first
(async, auto-retrying) assertion. Without `await` it returns a floating promise that never
settles inside the test, so the assertion is effectively an **assertion that can never fail** —
the same false-positive family the skill's notes call out ("assertion that can never fail",
"missing await on an async action or assertion").

## Fix the skill should propose
```ts
await expect(banner).toBeVisible();
```

## Why routing is NOT expected here
The failure is not a `locator` / `selector` / `Timeout` error (which would route to the healer)
nor a `TypeError` / value mismatch that needs diagnosing-bugs. It is one of the three
"80% of quick-heuristic catches" the skill lists — a missing `await` — so Step 2 resolves it
with a 🟢 High-confidence root-cause + fix.
