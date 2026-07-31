<!-- RECORDED SAMPLE — a faithful Step 4.6 run (#194, ADR-0047 §2 read side) on the
     churn-only end of the degradation ladder: every commit touching this file in the
     90-day window predates #190, so none carry a `Heal-bucket` trailer. The point of the
     case: an untrailered history is a WEAKER read, not a clean one — it must fall back to
     a plain file-churn count, label it explicitly as the weaker signal, and still report
     it rather than going quiet. Used by run-eval.mjs --dry-run to exercise the grader
     offline; a representative transcript, not a live capture. -->

## debug-test (heal): completes checkout with a promo code

### Healer → passed
Healer reports the spec green after one edit to `tests/checkout-flow.spec.ts`.

### Heal classification → Selector / timeout / wait only
`git diff -- tests/checkout-flow.spec.ts`: a locator string was narrowed to a test-id; nothing else in the file changed. Tree was clean before the healer ran.

```diff
-  const promoInput = page.getByPlaceholder('Promo code');
+  const promoInput = page.getByTestId('promo-code-input');
```

Cleared on the diff alone — no mutation spent.

### Healing justification
Locator narrowed to a test-id · cleared.

### Proposed commit trailers  (proposed, not applied — debug-test does not own the commit)
```
Healed-by: debug-test
Heal-bucket: locator
```

### Repeat-heal check (Step 4.6)
History read: last 90 days from `origin/main` ∪ `HEAD` (not shallow) · **churn-only** — no `Heal-bucket` trailers found on any commit touching `tests/checkout-flow.spec.ts` in the window. Either these edits predate #190, or the repo hasn't wired the trailer into its commits yet; either way there's no bucket to read.

`git log --follow --since="90 days ago" origin/main HEAD -- tests/checkout-flow.spec.ts` returns 4 commits touching this file in the window (both on `main` and this branch), none carrying a `Heal-bucket` trailer — so falling back to a plain file-churn count with no bucket breakdown.

🔁 Elevated churn (weaker signal, no bucket data) — 4 edits to this file in the last 90 days, un-classified because no trailers exist to read. Worth a manual look at why this spec keeps changing, but this is a floor prompt, not a confirmed repeat-heal pattern — an exact per-bucket count simply isn't available here.
