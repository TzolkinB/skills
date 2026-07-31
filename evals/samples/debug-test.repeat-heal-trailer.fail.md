<!-- RECORDED NEGATIVE SAMPLE — the failure Step 4.6 exists to stop: the same file has
     two prior `locator` heals on record (both trailer-tagged), this is the third, and the
     run reports "No repeats found" anyway instead of reading the history. Used by
     run-eval.mjs --self-test to prove the grader FAILS it:
       * never runs `git log --follow`, never states a 90-day window,
       * never says the reading is bucket-accurate,
       * never counts 3 or names `locator`,
       * emits no 🔁 repeat-heal token,
       * "No repeats found" is a must_not violation — three same-bucket heals on
         one file is exactly the pattern that should have fired.
     If the grader ever passes this, the harness is not discriminating. -->

## debug-test (heal): nav bar links to settings

### Healer → passed
Healer reports the spec green after one edit to `tests/nav.spec.ts`.

### Heal classification → Selector / timeout / wait only
`git diff -- tests/nav.spec.ts`: a locator string was narrowed to a test-id.

```diff
-  const link = page.getByRole('link', { name: 'Billing' });
+  const link = page.getByTestId('nav-billing');
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
No repeats found. Heal cleared, done.
