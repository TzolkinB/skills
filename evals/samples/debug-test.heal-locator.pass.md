<!-- RECORDED SAMPLE — a faithful Step 4.5 run (#190) on the cheap bucket. The point of the
     case: a locator-only heal stays cheap (cleared on the diff, no mutation, no audit-test
     hop) AND still proposes a trailer, because the repeat-heal pattern #194 reads is mostly
     built out of cheap rows. Deliberately never names /audit-test, so the "must NOT route"
     check reads as correctly absent. Representative transcript, not a live capture. -->

## debug-test (heal): nav bar links to settings

### Healer → passed
Healer reports the spec green after one edit to `tests/nav.spec.ts`.

### Heal classification → Selector / timeout / wait only
`git diff -- tests/nav.spec.ts`: a locator string was narrowed; nothing else in the file changed. No expected value, no `beforeEach`, no fixture, no step order. Tree was clean before the healer ran, and the diff stayed inside the test file.

```diff
-  const link = page.getByRole('link', { name: 'Settings' });
+  const link = page.getByTestId('nav-settings');
```

Cleared on the diff alone — no mutation spent. The assertion, what it expects, and the flow that reaches it are all untouched, so there is nothing here a mutation could tell us that the diff doesn't: this is the low-risk common case, and the funnel exists so it stays cheap.

### Healing justification
Locator `getByRole('link', {name: 'Settings'})` → `getByTestId('nav-settings')`, assertion and setup unchanged · classified from the diff, no further check required · cleared.

### Proposed commit trailers  (proposed, not applied — debug-test does not own the commit)
```
Healed-by: debug-test
Heal-bucket: locator
```
The cheap bucket gets a trailer too — "this same spec has been healed four times for a locator" is exactly the pattern the read side is there to surface, and it is invisible if these rows are suppressed as noise.
