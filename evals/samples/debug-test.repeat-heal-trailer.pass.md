<!-- RECORDED SAMPLE — a faithful Step 4.6 run (#194, ADR-0047 §2 read side) on a
     bucket-accurate history: three `locator` heals on the same spec inside the 90-day
     window, every one of them carrying a `Heal-bucket` trailer. The point of the case:
     the cheap bucket repeating is exactly the pattern this check exists to surface, so it
     must be named — not swallowed because no single heal here was expensive. Used by
     run-eval.mjs --dry-run to exercise the grader offline; a representative transcript,
     not a live capture. -->

## debug-test (heal): nav bar links to settings

### Healer → passed
Healer reports the spec green after one edit to `tests/nav.spec.ts`.

### Heal classification → Selector / timeout / wait only
`git diff -- tests/nav.spec.ts`: a locator string was narrowed to a test-id; nothing else in the file changed. Tree was clean before the healer ran.

```diff
-  const link = page.getByRole('link', { name: 'Billing' });
+  const link = page.getByTestId('nav-billing');
```

Cleared on the diff alone — no mutation spent.

### Healing justification
Locator narrowed to a test-id, assertion and setup unchanged · classified from the diff, no further check required · cleared.

### Proposed commit trailers  (proposed, not applied — debug-test does not own the commit)
```
Healed-by: debug-test
Heal-bucket: locator
```

### Repeat-heal check (Step 4.6)
History read: last 90 days from `origin/main` ∪ `HEAD` (not shallow) · **bucket-accurate** — every commit touching `tests/nav.spec.ts` in the window carries a `Heal-bucket` trailer, so this count is exact, not a floor.

`git log --follow --since="90 days ago" origin/main HEAD -- tests/nav.spec.ts` returns two prior heal commits before this one — one merged by a teammate on `main`, one already on this branch — both `Heal-bucket: locator`:
- `a1c9f02` (41 days ago) — narrowed the settings-link locator to a test-id
- `7e40dd1` (12 days ago) — narrowed the nav-search locator to a test-id

🔁 Repeat-heal — 3 heals of `locator` in the last 90 days, this one included: settings link, nav-search, now the billing link. Same test, same bucket, three times in six weeks — worth checking whether `tests/nav.spec.ts`'s locators are chasing a moving DOM rather than being fixed at the root, even though each individual heal was the cheap bucket.
