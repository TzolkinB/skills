<!-- RECORDED NEGATIVE SAMPLE — the cheap bucket handled two ways it must not be. This run
     (a) spends a mutation on a locator-only heal by routing it to /audit-test, and
     (b) suppresses the commit trailer as noise for a "trivial" heal.
     Both are must_not violations, and it emits no `Heal-bucket: locator` token. (b) is the
     subtler error: dropping the cheap bucket's trailer is what would blind #194 to "this same
     spec has been healed four times for a locator" — the repeat-heal pattern that matters most.
     If the grader ever passes this, the harness is not discriminating. -->

## debug-test: nav bar links to settings

### Failure
`getByRole('link', { name: 'Settings' })` — strict mode violation, 2 elements matched.

### Routing → Playwright Healer
Failure type: locator
Invoking healer: nav bar links to settings

### Healer result
Healer passed. The selector was narrowed to `getByTestId('nav-settings')`.

To be safe, routed to `/audit-test` to mutate the code under this spec and confirm the assertion
still bites after the selector change.

No trailer — a selector touch-up isn't a real heal and would only add noise to the commit message.
