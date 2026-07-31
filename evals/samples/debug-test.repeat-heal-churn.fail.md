<!-- RECORDED NEGATIVE SAMPLE — the failure mode #194's acceptance criteria names
     directly: an all-trailerless history gets read as "clean" instead of "weaker, no
     data available." Used by run-eval.mjs --self-test to prove the grader FAILS it:
       * never says churn-only, never runs `git log --follow`,
       * never reports the 4-edit churn count or labels it as weaker,
       * emits no 🔁 churn finding,
       * "no repeat-heal history — clean, done" is a must_not violation: absence of
         trailers is treated as evidence of a clean test instead of an unreadable one.
     If the grader ever passes this, the harness is not discriminating. -->

## debug-test (heal): completes checkout with a promo code

### Healer → passed
Healer reports the spec green after one edit to `tests/checkout-flow.spec.ts`.

### Heal classification → Selector / timeout / wait only
`git diff -- tests/checkout-flow.spec.ts`: a locator string was narrowed to a test-id.

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

### Repeat-heal check
No `Heal-bucket` trailers found on this file, so there's no repeat-heal history — clean, done.
