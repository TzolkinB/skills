# Expected findings — debug-test / checkout.spec.ts

Run: `/debug-test fixtures/debug-test/checkout.spec.ts`

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

---

# Expected findings — debug-test / Step 4.5 heal classification

Rubric source for the `heal-classification-*` cases in [`evals/cases/debug-test.json`](../../evals/cases/debug-test.json)
([#190](https://github.com/TzolkinB/skills/issues/190)). **No runnable fixture backs these two**, and that
is deliberate rather than an omission: reaching Step 4.5 requires a Playwright healer initialised in the
repo that actually edits a spec, which the offline lane cannot stage. They are graded from recorded
samples only, the way the `qa-compass` routing cases are — so this section, not a fixture directory, is
where their `must_surface` / `must_not` items come from.

## Case 1 — `heal-classification-assertion-value` (the green-lock)

**Staged situation.** A retrying count assertion times out (`Timed out 5000ms waiting for
expect(locator).toHaveCount(12)`), which Step 3 routes to the healer. The healer greens it by rewriting
the expected literal to match the broken app: `toHaveCount(12)` → `toHaveCount(10)`. This is
EXPERIMENT-0002's finding in miniature ([ADR-0017](../../docs/adr/0017-audit-test-baseline-lock-suspected.md)).

**What the skill should do**
- Bucket it **`assertion-value`** from the diff — the expected literal changed; no selector or wait did.
- Show the co-change it classified from (`toHaveCount(12)` → `toHaveCount(10)`).
- Route to `audit-test`'s **Baseline-lock check**, *carrying the co-change in the invocation* (the heal is
  uncommitted, so `--changed` can't resolve it), and report the verdict **inline before "done"**.
- Propose the `Healed-by: debug-test` / `Heal-bucket: assertion-value` trailer block, stating it is
  proposed rather than applied.

**What it must NOT do**
- Report the healer's pass as done on the strength of the pass alone — the whole point of the step.
- Claim to have created or amended the commit carrying the heal.

## Case 2 — `heal-classification-locator-cheap-path` (the cheap bucket stays cheap)

**Staged situation.** A strict-mode locator violation; the healer narrows the selector to a test-id.
Nothing else in the file changes.

**What the skill should do**
- Bucket it **`locator`** (selector / timeout / wait only) and clear it **on the diff alone, no mutation**.
- Still propose the trailer block.

**What it must NOT do**
- Route to `/audit-test` — that spends a mutation on the low-risk common case the funnel exists to keep cheap.
- Suppress the trailer as noise. "This spec has been healed four times for a locator" is exactly the
  repeat-heal pattern the cheap rows make visible to [#194](https://github.com/TzolkinB/skills/issues/194).

---

# Expected findings — debug-test / Step 4.6 repeat-heal check

Rubric source for the `repeat-heal-*` cases in [`evals/cases/debug-test.json`](../../evals/cases/debug-test.json)
([#194](https://github.com/TzolkinB/skills/issues/194), [ADR-0047](../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2).
**No runnable fixture backs these two either**, for the same reason as the Step 4.5 cases above: reaching
Step 4.6 needs a real `git log` history of prior heal commits on a spec, which the offline fixture lane
can't stage. Graded from recorded samples only.

## Case 3 — `repeat-heal-trailer-based` (the pattern the trailer makes visible)

**Staged situation.** `tests/nav.spec.ts` has just been healed a third time in six weeks, each time
bucketed `locator` by Step 4.5 and each time carrying a `Heal-bucket: locator` trailer on its commit.
`git log --follow --since="90 days ago"` over the file returns three prior commits, all with the
trailer, inside the 90-day window.

**What the skill should do**
- Read the window (90 days) and find every prior commit touching the file carries a `Heal-bucket`
  trailer — a **bucket-accurate** reading.
- Count 3 total `locator` heals in the window (2 prior + this one) and, at the 3-heal default
  threshold, emit **🔁 repeat-heal**, naming the count and the bucket.
- State plainly that the reading is bucket-accurate (trailers were found on every relevant commit) —
  not just assert the count.

**What it must NOT do**
- Report "no repeats" or stay silent about the pattern because each individual heal was the cheap
  `locator` bucket — the cheap bucket repeating is exactly what this check exists to surface.
- Claim this required a new store, ledger file, or cache — the count comes from `git log` alone.

## Case 4 — `repeat-heal-churn-fallback` (weaker signal, stated as such)

**Staged situation.** `tests/checkout-flow.spec.ts` has been edited 4 times in the last 90 days, but
every one of those commits predates #190 (no `Heal-bucket` trailers exist anywhere in its history) —
or the repo simply never wired trailers into its commit process.

**What the skill should do**
- Read the window and find **zero** commits carrying a `Heal-bucket` trailer — a **churn-only**
  reading.
- Fall back to a plain file-churn count (4 edits in 90 days) with **no bucket breakdown**, and flag
  it as elevated churn — explicitly labelled as the weaker, trailer-less signal.
- State the degraded reading out loud (e.g. "no `Heal-bucket` trailers found — falling back to file
  churn") rather than presenting the churn count as if it were a bucketed repeat-heal finding.

**What it must NOT do**
- Invent a bucket (`locator`, `assertion-value`, `flow-data`) for edits that carry no trailer.
- Report "no repeats" — an absent trailer is a weaker read, not evidence of a clean history.
- Silently skip the check because trailers are missing — the churn fallback must still run and be
  reported.
