# Expected findings — qa-review / pricing.js

Run: `/qa-review fixtures/qa-review/pricing.js`

This fixture is a pure **testability** target (no test file — `qa-review` reads code
only). Every smell below is deliberately planted; a correct run should surface them
grouped by category.

## Testability Issues (should be flagged HIGH/MEDIUM)
- **Hard-coded prod URL** — `API_URL = 'https://api.prod.example.com/pricing'` cannot be
  pointed at a mock server; no dependency injection.
- **`new Date().getHours()` in logic** — the flash-sale branch is time-dependent, so tests
  pass or fail depending on the clock. (See GLOSSARY: Non-determinism.)
- **`Math.random()`** — unseeded promo eligibility; non-deterministic, needs a mock/seed.
- **`fetch(...)` created inline** — the network call is not injectable; can't stub without
  editing the code.
- **`setTimeout(..., 3000)`** — uncontrolled timer makes any test slow or flaky.

## Brittleness Risks
- **`body.includes('rate limit exceeded')`** — fragile string match on an external error
  message that can change without notice.
- **`JSON.parse(body).surcharge`** — assumes response shape with no null/parse guard; will
  throw on unexpected payloads.

## Coupling / Mock Challenges
- The function bundles clock, RNG, network, and a timer, so it can only be exercised with the
  whole world running — it cannot be unit-tested in isolation.

## Not in scope for this skill
- Consequence-of-failure (blast radius) is `threat-model`'s job, not `qa-review`'s — the run
  should NOT rank production impact here.
