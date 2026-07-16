<!-- RECORDED SAMPLE — a faithful /qa-review run on the pricing.js fixture (code only, no test
     file). Surfaces the planted testability smells grouped by category — non-determinism, hidden
     deps, brittleness, coupling — and suggests the seams to inject. Used by run-eval.mjs --dry-run
     offline. Deliberately stays in the testability lane: it does NOT rank production blast radius
     (that's /threat-model) and does NOT propose new tests / coverage (that's /coverage-review), so
     the must_not checks read as correctly absent. -->

## QA Review: pricing.js

### Testability Issues (Will Slow You Down)
- [ ] **HIGH** Line 9: `new Date().getHours()` drives the flash-sale branch — time-dependent, so tests pass or fail by the wall clock (non-determinism).
- [ ] **HIGH** Line 5 / 16: hard-coded `API_URL = 'https://api.prod.example.com/pricing'` with an inline `fetch(...)` — the network call is not injectable; you can't point it at a mock server without editing the code.
- [ ] **MEDIUM** Line 13: `Math.random() < 0.1` — unseeded promo eligibility, non-deterministic; needs a seed or injected RNG.
- [ ] **MEDIUM** Line 22: `setTimeout(..., 3000)` — an uncontrolled timer makes any test slow or flaky.

### Brittleness Risks
- [ ] Line 20: `body.includes('rate limit exceeded')` — a fragile string match on an external error message that can change without notice.
- [ ] Line 27: `JSON.parse(body).surcharge` — assumes the response shape with no null/parse guard; throws on an unexpected payload.

### Coupling / Mock Challenges
- [ ] The function bundles clock, RNG, network, and a timer, so it can only be exercised with the whole world running — it can't be unit-tested in isolation.

### Suggestions
1. Inject the API URL and a fetch/client so the network call can be stubbed.
2. Pass time in, or use an injectable clock, instead of `new Date()`.
3. Seed or inject randomness instead of `Math.random()`.
4. Guard `JSON.parse` and the response shape before reading `surcharge`.
